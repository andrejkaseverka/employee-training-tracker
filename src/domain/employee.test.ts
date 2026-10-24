import { describe, expect, it } from 'vitest'
import type { LocalDate } from './config.ts'
import { mapEmployees, normalizeEmail, overviewScope, type Employee } from './employee.ts'
import type { SourceRow } from './source-row.ts'

const TODAY = '2026-10-01' as LocalDate

const row = (rowNumber: number, overrides: Record<string, string>): SourceRow => ({
  row: rowNumber,
  values: {
    id_zamestnance: `T${String(rowNumber).padStart(3, '0')}`,
    jmeno: 'Testovací',
    prijmeni: 'Osoba',
    email: `osoba${rowNumber}@example.test`,
    utvar: 'Knihovna',
    pozice: 'Knihovník',
    vedouci_email: '',
    datum_nastupu: '2020-01-01',
    datum_ukonceni: '',
    stav: 'aktivní',
    rodne_cislo: '000000/0000',
    poznamka: '=HYPERLINK("x")',
    ...overrides,
  },
})

describe('normalizeEmail', () => {
  it('removes whitespace and case', () => {
    expect(normalizeEmail(' Jana.Nova k@Example.TEST ')).toBe('jana.novak@example.test')
  })
})

describe('mapEmployees', () => {
  it('maps fields, normalises department and drops sensitive columns', () => {
    const { employees, issues } = mapEmployees([
      row(2, { utvar: 'Laboratoře' }),
      row(3, { utvar: 'LABORATORE', datum_nastupu: '3. 2. 2021', stav: 'rodičovská' }),
    ])
    const second = employees.get('T003')
    expect(second).toMatchObject({
      department: 'Laboratoře',
      departmentKey: 'laboratore',
      startDate: '2021-02-03',
      status: 'parental-leave',
    })
    expect(Object.keys(second ?? {})).not.toContain('birthNumber')
    expect(JSON.stringify(second)).not.toContain('HYPERLINK')
    expect(JSON.stringify(second)).not.toContain('000000/0000')
    expect(issues).toEqual([])
  })

  it('reports missing ids, duplicate ids, unknown status and missing department', () => {
    const { employees, issues } = mapEmployees([
      row(2, { id_zamestnance: '' }),
      row(3, {}),
      row(4, { id_zamestnance: 'T003' }),
      row(5, { stav: 'neznámý' }),
      row(6, { utvar: '  ' }),
    ])
    expect([...employees.keys()]).toEqual(['T003', 'T006'])
    expect(employees.get('T006')?.department).toBeNull()
    expect(issues.map((issue) => [issue.row, issue.kind, issue.severity])).toEqual([
      [2, 'missing-value', 'dropped'],
      [4, 'duplicate-employee-id', 'dropped'],
      [5, 'unknown-status', 'dropped'],
      [6, 'missing-department', 'flagged'],
    ])
  })

  it('flags invalid dates and unknown managers but keeps the employee', () => {
    const { employees, issues } = mapEmployees([
      row(2, { email: 'sef@example.test' }),
      row(3, { vedouci_email: 'SEF@example.test' }),
      row(4, { vedouci_email: 'nikdo@example.test', datum_nastupu: '31. 9. 2020' }),
    ])
    expect(employees.get('T004')?.startDate).toBeNull()
    expect(issues.map((issue) => [issue.row, issue.kind])).toEqual([
      [4, 'invalid-date'],
      [4, 'unknown-manager'],
    ])
  })
})

describe('overviewScope', () => {
  const employee = (overrides: Partial<Employee>): Employee => ({
    id: 'T001',
    firstName: 'A',
    lastName: 'B',
    email: 'a@example.test',
    department: 'Knihovna',
    departmentKey: 'knihovna',
    position: 'Knihovník',
    positionKey: 'knihovnik',
    managerEmail: null,
    startDate: '2020-01-01' as LocalDate,
    endDate: null,
    status: 'active',
    ...overrides,
  })

  it('includes active employees, also with a planned leave date', () => {
    expect(overviewScope(employee({ endDate: '2026-12-31' as LocalDate }), TODAY)).toEqual({
      included: true,
      startsInFuture: false,
      onParentalLeave: false,
    })
    expect(overviewScope(employee({ endDate: TODAY }), TODAY)).toMatchObject({ included: true })
  })

  it('excludes terminated employees and those whose end date has passed', () => {
    expect(overviewScope(employee({ status: 'terminated' }), TODAY)).toEqual({ included: false, reason: 'terminated' })
    expect(overviewScope(employee({ endDate: '2026-09-30' as LocalDate }), TODAY)).toMatchObject({ included: false })
  })

  it('includes future joiners and parental leave with flags', () => {
    expect(overviewScope(employee({ startDate: '2026-10-02' as LocalDate }), TODAY)).toMatchObject({
      included: true,
      startsInFuture: true,
    })
    expect(overviewScope(employee({ status: 'parental-leave' }), TODAY)).toMatchObject({ onParentalLeave: true })
  })
})
