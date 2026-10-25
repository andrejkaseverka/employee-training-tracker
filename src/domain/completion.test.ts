import { describe, expect, it } from 'vitest'
import type { Training } from './catalog.ts'
import { DEFAULT_CONFIG, type LocalDate } from './config.ts'
import { mapCompletions, type CompletionContext } from './completion.ts'
import type { Employee } from './employee.ts'
import type { SourceRow } from './source-row.ts'

const training = (code: string, validity: Training['validity']): Training => ({
  code,
  name: code,
  validity,
  rule: { kind: 'all' },
})

const employee = (id: string, endDate: string | null = null): Employee => ({
  id,
  firstName: 'A',
  lastName: 'B',
  email: `${id}@example.test`,
  department: 'Knihovna',
  departmentKey: 'knihovna',
  position: 'Knihovník',
  positionKey: 'knihovnik',
  managerEmail: null,
  startDate: '2015-01-01' as LocalDate,
  endDate: endDate as LocalDate | null,
  status: 'active',
})

const context: CompletionContext = {
  catalog: new Map([
    ['KYBER', training('KYBER', { kind: 'months', months: 12 })],
    ['LEAD', training('LEAD', { kind: 'none' })],
    ['ODD', training('ODD', { kind: 'unknown' })],
  ]),
  employees: new Map([
    ['T001', employee('T001')],
    ['T002', employee('T002', '2025-06-30')],
  ]),
  config: DEFAULT_CONFIG,
}

let rowCounter = 1
const row = (values: Record<string, string>): SourceRow => ({
  row: ++rowCounter,
  values: {
    id_zaznamu: `R${rowCounter}`,
    id_zamestnance: 'T001',
    kod_skoleni: 'KYBER',
    datum_absolvovani: '2026-01-15',
    platnost_do: '2027-01-15',
    ...values,
  },
})

const map = (...rows: SourceRow[]) => mapCompletions(rows, context)
const kinds = (result: ReturnType<typeof map>): string[] => result.issues.map((issue) => issue.kind)

describe('mapCompletions – validity', () => {
  it('uses the record value when it is valid', () => {
    const result = map(row({}))
    expect(result.completions[0]).toMatchObject({ validUntil: '2027-01-15', validitySource: 'record' })
    expect(result.issues).toEqual([])
  })

  it('keeps a record value that differs from the catalogue, but flags it', () => {
    const result = map(row({ platnost_do: '2028-01-15' }))
    expect(result.completions[0]).toMatchObject({ validUntil: '2028-01-15', validitySource: 'record' })
    expect(kinds(result)).toEqual(['validity-differs-from-catalog'])
  })

  it('computes validity from the catalogue when the record value is missing', () => {
    const result = map(row({ platnost_do: '' }))
    expect(result.completions[0]).toMatchObject({ validUntil: '2027-01-15', validitySource: 'computed' })
    expect(kinds(result)).toEqual(['valid-until-computed'])
  })

  it('falls back to the catalogue when the record value is before completion or invalid', () => {
    expect(map(row({ platnost_do: '2025-01-01' })).completions[0]?.validitySource).toBe('computed')
    expect(kinds(map(row({ platnost_do: '2025-01-01' })))).toEqual(['valid-until-before-completion', 'valid-until-computed'])
    expect(kinds(map(row({ platnost_do: '31. 9. 2026' })))).toEqual(['invalid-date', 'valid-until-computed'])
  })

  it('treats trainings without expiry as never expiring', () => {
    const result = map(row({ kod_skoleni: 'LEAD', platnost_do: '' }))
    expect(result.completions[0]).toMatchObject({ validUntil: null, validitySource: 'none' })
    expect(result.issues).toEqual([])
  })

  it('marks validity unknown when the catalogue value is unreadable and the record has none', () => {
    expect(map(row({ kod_skoleni: 'ODD', platnost_do: '' })).completions[0]).toMatchObject({
      validUntil: null,
      validitySource: 'unknown',
    })
    expect(map(row({ kod_skoleni: 'ODD', platnost_do: '2027-01-01' })).completions[0]?.validitySource).toBe('record')
  })
})

describe('mapCompletions – dropped records', () => {
  it.each([
    [{ id_zamestnance: '' }, 'missing-value'],
    [{ kod_skoleni: '' }, 'missing-value'],
    [{ kod_skoleni: 'KYB3R' }, 'unknown-training-code'],
    [{ id_zamestnance: 'T999' }, 'orphan-employee-reference'],
    [{ datum_absolvovani: 'včera' }, 'invalid-date'],
    [{ datum_absolvovani: '1. 1. 1900' }, 'implausible-date'],
    [{ datum_absolvovani: '2026-10-02' }, 'future-completion'],
  ])('drops %j as %s', (values, kind) => {
    const result = map(row(values))
    expect(result.completions).toEqual([])
    expect(result.issues).toEqual([expect.objectContaining({ kind, severity: 'dropped' })])
  })

  it('normalises codes before lookup', () => {
    expect(map(row({ kod_skoleni: ' kyber ' })).completions).toHaveLength(1)
  })

  it('accepts completions exactly on the plausibility bounds', () => {
    expect(map(row({ datum_absolvovani: '1976-10-01', platnost_do: '' })).completions).toHaveLength(1)
    expect(map(row({ datum_absolvovani: '1976-09-30', platnost_do: '' })).completions).toHaveLength(0)
    expect(map(row({ datum_absolvovani: '2026-10-01', platnost_do: '' })).completions).toHaveLength(1)
  })

  it('converts Excel serial dates and flags them', () => {
    const result = map(row({ datum_absolvovani: '45658', platnost_do: '' }))
    expect(result.completions[0]?.completedOn).toBe('2025-01-01')
    expect(kinds(result)).toContain('excel-serial-date')
  })

  it('flags completions after the employee left', () => {
    expect(kinds(map(row({ id_zamestnance: 'T002' })))).toEqual(['completed-after-termination'])
  })
})

describe('mapCompletions – duplicates', () => {
  it('keeps the duplicate with the latest validity', () => {
    const result = map(
      row({ platnost_do: '2027-01-15' }),
      row({ platnost_do: '2027-06-30' }),
      row({ platnost_do: '2026-12-31' }),
    )
    expect(result.completions).toHaveLength(1)
    expect(result.completions[0]?.validUntil).toBe('2027-06-30')
    expect(kinds(result).filter((kind) => kind === 'duplicate-completion')).toHaveLength(2)
  })

  it('keeps repeated completions on different dates (renewals)', () => {
    const result = map(row({ datum_absolvovani: '2025-01-10', platnost_do: '' }), row({}))
    expect(result.completions).toHaveLength(2)
  })

  it('flags duplicate record ids without dropping different completions', () => {
    const result = map(
      row({ id_zaznamu: 'DUP', datum_absolvovani: '2025-01-10', platnost_do: '2026-01-10' }),
      row({ id_zaznamu: 'DUP' }),
    )
    expect(result.completions).toHaveLength(2)
    expect(kinds(result)).toEqual(['duplicate-record-id'])
  })
})
