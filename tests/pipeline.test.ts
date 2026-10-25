import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/domain/config.ts'
import { summarizeIssues, type DataQualityIssue, type DataSource } from '../src/domain/data-quality.ts'
import { readCsvFile } from '../src/infrastructure/csv/read-csv-file.ts'
import { buildTrainingOverview } from '../src/use-cases/build-training-overview.ts'
import { loadDataset, type RawTables } from '../src/use-cases/load-dataset.ts'
import { recommendEnrolments } from '../src/use-cases/recommend-enrolments.ts'
import type { SourceRow } from '../src/domain/source-row.ts'

// Synthetic fixtures reproducing the export quirks: Windows-1250 + CRLF + multi-line field +
// repeated header (completions), UTF-8 with BOM (employees, sessions), plain UTF-8 (catalog).
const FIXTURES = ['absolvovana_skoleni.csv', 'zamestnanci.csv', 'katalog_skoleni.csv', 'terminy_skoleni.csv']

function loadFixtures(): { tables: RawTables; structuralIssues: DataQualityIssue[]; encodings: Record<string, string> } {
  const rows: Partial<Record<DataSource, readonly SourceRow[]>> = {}
  const structuralIssues: DataQualityIssue[] = []
  const encodings: Record<string, string> = {}
  for (const name of FIXTURES) {
    const bytes = readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)))
    const result = readCsvFile(new Uint8Array(bytes))
    if (!result.ok) throw new Error(`Fixture ${name} not recognised`)
    rows[result.source] = result.rows
    structuralIssues.push(...result.issues)
    encodings[result.source] = `${result.encoding}/${result.delimiter}`
  }
  const { employees = [], completions = [], catalog = [], sessions = [] } = rows
  return { tables: { employees, completions, catalog, sessions }, structuralIssues, encodings }
}

describe('pipeline on synthetic fixtures', () => {
  const { tables, structuralIssues, encodings } = loadFixtures()
  const loaded = loadDataset(tables, DEFAULT_CONFIG)
  const overview = buildTrainingOverview(loaded.dataset, {
    today: DEFAULT_CONFIG.referenceDate,
    expiringSoonDays: DEFAULT_CONFIG.expiringSoonDays,
  })
  const issueCounts = Object.fromEntries(
    summarizeIssues([...structuralIssues, ...loaded.issues]).map((s) => [`${s.source}:${s.kind}`, s.count]),
  )
  const statusOf = (employeeId: string): Record<string, string> =>
    Object.fromEntries(
      overview.employees
        .find((entry) => entry.employee.id === employeeId)
        ?.trainings.map((training) => [training.code, training.status]) ?? [],
    )

  it('recognises every file with its own encoding and delimiter', () => {
    expect(encodings).toEqual({
      completions: 'windows-1250/;',
      employees: 'utf-8/,',
      catalog: 'utf-8/,',
      sessions: 'utf-8/;',
    })
  })

  it('reads the multi-line quoted field intact', () => {
    const note = tables.completions.find((row) => row.values['id_zaznamu'] === 'A003')?.values['poznamka']
    expect(note).toBe('Poznámka na více řádků;\r\ns oddělovačem a "uvozovkami"')
  })

  it('reports data-quality issues as aggregates', () => {
    expect(issueCounts).toEqual({
      'employees:missing-department': 1,
      'employees:unknown-manager': 1,
      'completions:repeated-header': 1,
      'completions:valid-until-computed': 2,
      'completions:excel-serial-date': 1,
      'completions:implausible-date': 1,
      'completions:future-completion': 1,
      'completions:orphan-employee-reference': 1,
      'completions:unknown-training-code': 1,
      'completions:duplicate-record-id': 1,
      'completions:duplicate-completion': 1,
      'catalog:textual-validity': 1,
      'sessions:duplicate-session': 1,
      'sessions:invalid-date': 1,
      'sessions:unknown-training-code': 1,
      'sessions:overbooked-session': 1,
    })
  })

  it('excludes terminated employees and keeps future joiners', () => {
    expect(overview.excludedTerminated).toBe(1)
    expect(overview.employees.map((entry) => entry.employee.id).sort()).toEqual([
      'D001',
      'D002',
      'D003',
      'D004',
      'D005',
      'D006',
      'D008',
    ])
    expect(overview.employees.find((entry) => entry.employee.id === 'D005')?.flags.startsOn).toBe('2026-10-15')
  })

  it('computes the status of each mandatory training', () => {
    expect(statusOf('D001')).toEqual({ 'BOZP-Z': 'valid', KYBER: 'expiring', 'PRV-POM': 'expired' })
    expect(statusOf('D002')).toEqual({ 'BOZP-Z': 'valid', KYBER: 'expired', 'PRV-POM': 'missing' })
    expect(statusOf('D003')).toEqual({ 'BOZP-Z': 'valid', KYBER: 'expired', 'PRV-POM': 'valid', ZDVIH: 'valid' })
    expect(statusOf('D004')).toEqual({ 'BOZP-Z': 'expired', KYBER: 'missing' })
    expect(statusOf('D005')).toEqual({ 'BOZP-Z': 'missing', KYBER: 'missing' })
    expect(statusOf('D006')).toEqual({ 'BOZP-Z': 'valid', KYBER: 'missing', LEAD: 'valid' })
    expect(statusOf('D008')).toEqual({ 'BOZP-Z': 'valid', KYBER: 'valid', 'PRV-POM': 'missing' })
  })

  it('flags department-based trainings that cannot be decided', () => {
    const noDepartment = overview.employees.find((entry) => entry.employee.id === 'D004')
    expect(noDepartment?.flags).toMatchObject({ missingDepartment: true, onParentalLeave: true })
    expect(noDepartment?.undeterminedRequirements).toEqual(['PRV-POM'])
  })

  it('counts statuses', () => {
    expect(overview.statusCounts).toEqual({ valid: 9, expiring: 1, expired: 4, missing: 6, undetermined: 0 })
  })

  describe('enrolment recommendation', () => {
    const plan = recommendEnrolments(loaded.dataset, overview, { today: DEFAULT_CONFIG.referenceDate })
    const placed = Object.fromEntries(
      plan.assignments.map((a) => [`${a.need.employeeId}|${a.need.code}`, a.sessionId]),
    )
    const unplaced = Object.fromEntries(plan.unassigned.map((u) => [`${u.need.employeeId}|${u.need.code}`, u.reason]))

    it('books every training that is not valid, or explains why not', () => {
      expect(plan.assignments.length + plan.unassigned.length).toBe(
        overview.statusCounts.missing + overview.statusCounts.expired + overview.statusCounts.expiring,
      )
    })

    it('assigns by priority, start date and without time clashes', () => {
      expect(placed).toEqual({
        'D002|PRV-POM': 'T09',
        'D005|BOZP-Z': 'T07',
        // T01 clashes with T07 on the same morning.
        'D005|KYBER': 'T08',
        'D006|KYBER': 'T01',
        'D003|KYBER': 'T01',
        'D002|KYBER': 'T01',
        'D001|KYBER': 'T01',
      })
    })

    it('explains unassigned trainings', () => {
      expect(unplaced).toEqual({
        'D004|KYBER': 'parental-leave',
        'D004|BOZP-Z': 'parental-leave',
        'D008|PRV-POM': 'capacity-exhausted',
        'D001|PRV-POM': 'capacity-exhausted',
      })
    })

    it('lists requirements that cannot be decided, outside the booking counts', () => {
      expect(plan.undeterminedRequirements).toEqual([{ employeeId: 'D004', code: 'PRV-POM' }])
    })

    it('never exceeds free seats and explains sessions not offered', () => {
      const usage = Object.fromEntries(
        plan.sessions.map((s) => [s.session.id, s.offer.offered ? `${s.assigned}/${s.seatsLeft}` : s.offer.reason]),
      )
      expect(usage).toEqual({
        T01: '4/11',
        T02: 'duplicate',
        T03: 'invalid-date',
        T04: 'unknown-code',
        T05: 'full',
        T06: 'cancelled',
        T07: '1/0',
        T08: '1/2',
        T09: '1/0',
      })
    })
  })

  it('keeps sensitive columns out of the domain model', () => {
    const serialized = JSON.stringify([...loaded.dataset.employees.values()])
    expect(serialized).not.toContain('HYPERLINK')
    expect(serialized).not.toContain('@SUM')
  })
})
