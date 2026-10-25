import { IssueCollector, type DataQualityIssue } from './data-quality.ts'
import { comparisonKey, departmentKey, normalizeCode } from './normalize.ts'
import { field, type SourceRow } from './source-row.ts'

/** Who a training is mandatory for (`povinne_pro`). Names are stored as comparison keys. */
export type RequirementRule =
  | { readonly kind: 'all' }
  | { readonly kind: 'departments'; readonly departmentKeys: readonly string[] }
  | { readonly kind: 'positions'; readonly positionKeys: readonly string[] }
  | { readonly kind: 'optional' }

/** How long a completion is valid. `unknown` = the catalogue value could not be read. */
export type Validity =
  | { readonly kind: 'months'; readonly months: number }
  | { readonly kind: 'none' }
  | { readonly kind: 'unknown' }

export interface Training {
  readonly code: string
  readonly name: string
  readonly validity: Validity
  readonly rule: RequirementRule
}

export type Catalog = ReadonlyMap<string, Training>

export interface ValidityParseResult {
  readonly validity: Validity
  /** True when the value was written as text ("2 roky") rather than a number of months. */
  readonly textual: boolean
}

const MONTHS_PER_YEAR = 12
// Units are compared via comparisonKey, so "měsíců", "mesicu" and "MĚSÍCŮ" all match.
const YEAR_UNITS = new Set(['rok', 'roky', 'roků', 'let'].map(comparisonKey))
const MONTH_UNITS = new Set(['měsíc', 'měsíce', 'měsíců'].map(comparisonKey))
const TEXTUAL_VALIDITY = /^(\d+)\s*([a-z]+)$/
const RULE_LIST_SEPARATOR = ';'

/** `24` → 24 months; `2 roky` → 24; `18 měsíců` → 18; `0` / empty → no expiry; anything else → unknown. */
export function parseValidity(raw: string): ValidityParseResult {
  const value = raw.trim()
  if (value === '' || value === '0') return { validity: { kind: 'none' }, textual: false }
  if (/^\d+$/.test(value)) return { validity: { kind: 'months', months: Number(value) }, textual: false }

  const match = TEXTUAL_VALIDITY.exec(comparisonKey(value))
  if (match) {
    const amount = Number(match[1])
    const unit = match[2] ?? ''
    if (YEAR_UNITS.has(unit)) return { validity: { kind: 'months', months: amount * MONTHS_PER_YEAR }, textual: true }
    if (MONTH_UNITS.has(unit)) return { validity: { kind: 'months', months: amount }, textual: true }
  }
  return { validity: { kind: 'unknown' }, textual: false }
}

/** Parses `VSICHNI`, `UTVAR:a;b`, `POZICE:x;y`, `NEPOVINNE`; null when the form is unknown. */
export function parseRequirementRule(raw: string): RequirementRule | null {
  const value = raw.trim()
  const upper = value.toUpperCase()
  if (upper === 'VSICHNI') return { kind: 'all' }
  if (upper === 'NEPOVINNE') return { kind: 'optional' }

  const separator = value.indexOf(':')
  if (separator < 0) return null
  const prefix = upper.slice(0, separator)
  const names = value
    .slice(separator + 1)
    .split(RULE_LIST_SEPARATOR)
    .map((name) => name.trim())
    .filter((name) => name !== '')
  if (names.length === 0) return null

  if (prefix === 'UTVAR') return { kind: 'departments', departmentKeys: names.map(departmentKey) }
  if (prefix === 'POZICE') return { kind: 'positions', positionKeys: names.map(comparisonKey) }
  return null
}

export interface CatalogMappingResult {
  readonly catalog: Catalog
  readonly issues: readonly DataQualityIssue[]
}

export function mapCatalog(rows: readonly SourceRow[]): CatalogMappingResult {
  const issues = new IssueCollector('catalog')
  const catalog = new Map<string, Training>()

  for (const source of rows) {
    const code = normalizeCode(field(source, 'kod'))
    if (code === '') {
      issues.add(source.row, 'missing-value', 'dropped', 'kod')
      continue
    }
    if (catalog.has(code)) {
      issues.add(source.row, 'duplicate-training-code', 'dropped', 'kod')
      continue
    }
    const rule = parseRequirementRule(field(source, 'povinne_pro'))
    if (rule === null) {
      issues.add(source.row, 'unknown-requirement-rule', 'dropped', 'povinne_pro')
      continue
    }
    const { validity, textual } = parseValidity(field(source, 'platnost_mesicu'))
    if (textual) issues.add(source.row, 'textual-validity', 'flagged', 'platnost_mesicu')
    if (validity.kind === 'unknown') issues.add(source.row, 'unparseable-validity', 'flagged', 'platnost_mesicu')

    catalog.set(code, { code, name: field(source, 'nazev') || code, validity, rule })
  }
  return { catalog, issues: issues.issues }
}

/** Facts about an employee that requirement rules look at (comparison keys). */
export interface RequirementSubject {
  readonly departmentKey: string | null
  readonly positionKey: string
}

/**
 * `undeterminable` = the rule depends on the department and the employee has none;
 * the training is then not counted, but the employee is flagged.
 */
export type Requirement = 'required' | 'not-required' | 'undeterminable'

export function requirementFor(training: Training, subject: RequirementSubject): Requirement {
  const { rule } = training
  switch (rule.kind) {
    case 'all':
      return 'required'
    case 'optional':
      return 'not-required'
    case 'positions':
      return rule.positionKeys.includes(subject.positionKey) ? 'required' : 'not-required'
    case 'departments':
      if (subject.departmentKey === null) return 'undeterminable'
      return rule.departmentKeys.includes(subject.departmentKey) ? 'required' : 'not-required'
  }
}
