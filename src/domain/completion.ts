import type { Catalog, Training } from './catalog.ts'
import type { DomainConfig, LocalDate } from './config.ts'
import { IssueCollector, type DataQualityIssue } from './data-quality.ts'
import { addMonths, addYears, compareDates, parseLocalDate } from './date.ts'
import type { Employee } from './employee.ts'
import { normalizeCode } from './normalize.ts'
import { field, type SourceRow } from './source-row.ts'

/**
 * Where `validUntil` comes from:
 * `record` = the record's own `platnost_do` (authoritative), `computed` = completion + catalogue months,
 * `none` = the training does not expire, `unknown` = catalogue validity unreadable and no record value.
 */
export type ValiditySource = 'record' | 'computed' | 'none' | 'unknown'

export interface Completion {
  readonly row: number
  readonly recordId: string
  readonly employeeId: string
  readonly code: string
  readonly completedOn: LocalDate
  /** Last day of validity, or null when it does not expire / cannot be determined (see validitySource). */
  readonly validUntil: LocalDate | null
  readonly validitySource: ValiditySource
}

export interface CompletionContext {
  readonly catalog: Catalog
  readonly employees: ReadonlyMap<string, Employee>
  readonly config: DomainConfig
}

export interface CompletionMappingResult {
  readonly completions: readonly Completion[]
  readonly issues: readonly DataQualityIssue[]
}

export function mapCompletions(rows: readonly SourceRow[], context: CompletionContext): CompletionMappingResult {
  const issues = new IssueCollector('completions')
  const today = context.config.referenceDate
  const oldestPlausible = addYears(today, -context.config.maxRecordAgeYears)
  const mapped: Completion[] = []

  for (const source of rows) {
    const employeeId = field(source, 'id_zamestnance').toUpperCase()
    const code = normalizeCode(field(source, 'kod_skoleni'))
    if (employeeId === '') {
      issues.add(source.row, 'missing-value', 'dropped', 'id_zamestnance')
      continue
    }
    if (code === '') {
      issues.add(source.row, 'missing-value', 'dropped', 'kod_skoleni')
      continue
    }
    const training = context.catalog.get(code)
    if (training === undefined) {
      issues.add(source.row, 'unknown-training-code', 'dropped', 'kod_skoleni')
      continue
    }
    const employee = context.employees.get(employeeId)
    if (employee === undefined) {
      issues.add(source.row, 'orphan-employee-reference', 'dropped', 'id_zamestnance')
      continue
    }

    const completed = parseLocalDate(field(source, 'datum_absolvovani'))
    if (!completed.ok) {
      issues.add(source.row, 'invalid-date', 'dropped', 'datum_absolvovani')
      continue
    }
    if (completed.source === 'excel-serial') issues.add(source.row, 'excel-serial-date', 'flagged', 'datum_absolvovani')
    const completedOn = completed.date
    if (compareDates(completedOn, oldestPlausible) < 0) {
      issues.add(source.row, 'implausible-date', 'dropped', 'datum_absolvovani')
      continue
    }
    if (compareDates(completedOn, today) > 0) {
      issues.add(source.row, 'future-completion', 'dropped', 'datum_absolvovani')
      continue
    }
    if (employee.endDate !== null && compareDates(completedOn, employee.endDate) > 0) {
      issues.add(source.row, 'completed-after-termination', 'flagged', 'datum_absolvovani')
    }

    const { validUntil, validitySource } = resolveValidUntil(source, training, completedOn, issues)
    mapped.push({
      row: source.row,
      recordId: field(source, 'id_zaznamu'),
      employeeId,
      code,
      completedOn,
      validUntil,
      validitySource,
    })
  }

  reportDuplicateRecordIds(mapped, issues)
  return { completions: deduplicate(mapped, issues), issues: issues.issues }
}

/** Record value first (if it is a valid date not before completion), catalogue as fallback. */
function resolveValidUntil(
  source: SourceRow,
  training: Training,
  completedOn: LocalDate,
  issues: IssueCollector,
): { validUntil: LocalDate | null; validitySource: ValiditySource } {
  const raw = field(source, 'platnost_do')
  const catalogValue = catalogValidUntil(training, completedOn)

  if (raw !== '') {
    const parsed = parseLocalDate(raw)
    if (!parsed.ok) {
      issues.add(source.row, 'invalid-date', 'flagged', 'platnost_do')
    } else if (compareDates(parsed.date, completedOn) < 0) {
      issues.add(source.row, 'valid-until-before-completion', 'flagged', 'platnost_do')
    } else {
      if (parsed.source === 'excel-serial') issues.add(source.row, 'excel-serial-date', 'flagged', 'platnost_do')
      if (catalogValue.validitySource === 'computed' && catalogValue.validUntil !== parsed.date) {
        issues.add(source.row, 'validity-differs-from-catalog', 'flagged', 'platnost_do')
      }
      return { validUntil: parsed.date, validitySource: 'record' }
    }
  }

  if (catalogValue.validitySource === 'computed') {
    issues.add(source.row, 'valid-until-computed', 'flagged', 'platnost_do')
  }
  return catalogValue
}

function catalogValidUntil(
  training: Training,
  completedOn: LocalDate,
): { validUntil: LocalDate | null; validitySource: ValiditySource } {
  switch (training.validity.kind) {
    case 'months':
      return { validUntil: addMonths(completedOn, training.validity.months), validitySource: 'computed' }
    case 'none':
      return { validUntil: null, validitySource: 'none' }
    case 'unknown':
      return { validUntil: null, validitySource: 'unknown' }
  }
}

function reportDuplicateRecordIds(completions: readonly Completion[], issues: IssueCollector): void {
  const seen = new Set<string>()
  for (const completion of completions) {
    if (completion.recordId === '') continue
    if (seen.has(completion.recordId)) issues.add(completion.row, 'duplicate-record-id', 'flagged', 'id_zaznamu')
    seen.add(completion.recordId)
  }
}

/** Same employee + training + completion date = one completion; the latest validity wins. */
function deduplicate(completions: readonly Completion[], issues: IssueCollector): Completion[] {
  const kept = new Map<string, Completion>()
  for (const completion of completions) {
    const key = `${completion.employeeId}|${completion.code}|${completion.completedOn}`
    const current = kept.get(key)
    if (current === undefined) {
      kept.set(key, completion)
      continue
    }
    const winner = compareValidity(completion, current) > 0 ? completion : current
    const loser = winner === completion ? current : completion
    kept.set(key, winner)
    issues.add(loser.row, 'duplicate-completion', 'dropped')
  }
  return [...kept.values()]
}

/** Orders validity: unknown < dated (by date) < never expires. */
export function compareValidity(a: Completion, b: Completion): number {
  const rank = (completion: Completion): number =>
    completion.validitySource === 'unknown' ? 0 : completion.validUntil === null ? 2 : 1
  const byRank = rank(a) - rank(b)
  if (byRank !== 0 || a.validUntil === null || b.validUntil === null) return byRank
  return compareDates(a.validUntil, b.validUntil)
}
