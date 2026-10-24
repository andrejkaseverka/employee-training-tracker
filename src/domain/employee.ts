import type { LocalDate } from './config.ts'
import { IssueCollector, type DataQualityIssue } from './data-quality.ts'
import { compareDates, parseLocalDate } from './date.ts'
import { buildDepartmentDirectory, comparisonKey, departmentKey } from './normalize.ts'
import { field, type SourceRow } from './source-row.ts'

export type EmploymentStatus = 'active' | 'terminated' | 'parental-leave'

/**
 * Employee as the domain needs it. Deliberately without the birth number and the
 * free-text note (data minimisation; the note also contains formula-like values).
 */
export interface Employee {
  readonly id: string
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  /** Canonical department name, or null when missing. */
  readonly department: string | null
  readonly departmentKey: string | null
  readonly position: string
  readonly positionKey: string
  readonly managerEmail: string | null
  readonly startDate: LocalDate | null
  readonly endDate: LocalDate | null
  readonly status: EmploymentStatus
}

const STATUS_BY_KEY: Readonly<Record<string, EmploymentStatus>> = {
  aktivni: 'active',
  ukoncen: 'terminated',
  rodicovska: 'parental-leave',
}

/** E-mails: trim, drop inner whitespace, lower case. */
export function normalizeEmail(raw: string): string {
  return raw.replace(/\s+/g, '').toLowerCase()
}

export interface EmployeeMappingResult {
  readonly employees: ReadonlyMap<string, Employee>
  readonly issues: readonly DataQualityIssue[]
}

export function mapEmployees(rows: readonly SourceRow[]): EmployeeMappingResult {
  const issues = new IssueCollector('employees')
  const directory = buildDepartmentDirectory(rows.map((source) => field(source, 'utvar')))
  const employees = new Map<string, Employee>()

  for (const source of rows) {
    const id = field(source, 'id_zamestnance').toUpperCase()
    if (id === '') {
      issues.add(source.row, 'missing-value', 'dropped', 'id_zamestnance')
      continue
    }
    if (employees.has(id)) {
      issues.add(source.row, 'duplicate-employee-id', 'dropped', 'id_zamestnance')
      continue
    }
    const status = STATUS_BY_KEY[comparisonKey(field(source, 'stav'))]
    if (status === undefined) {
      issues.add(source.row, 'unknown-status', 'dropped', 'stav')
      continue
    }

    const department = directory.resolve(field(source, 'utvar'))
    if (department === null) issues.add(source.row, 'missing-department', 'flagged', 'utvar')

    const optionalDate = (column: string): LocalDate | null => {
      const raw = field(source, column)
      if (raw === '') return null
      const parsed = parseLocalDate(raw)
      if (!parsed.ok) {
        issues.add(source.row, 'invalid-date', 'flagged', column)
        return null
      }
      if (parsed.source === 'excel-serial') issues.add(source.row, 'excel-serial-date', 'flagged', column)
      return parsed.date
    }

    const position = field(source, 'pozice')
    const managerEmail = normalizeEmail(field(source, 'vedouci_email'))
    employees.set(id, {
      id,
      firstName: field(source, 'jmeno'),
      lastName: field(source, 'prijmeni'),
      email: normalizeEmail(field(source, 'email')),
      department,
      departmentKey: department === null ? null : departmentKey(department),
      position,
      positionKey: comparisonKey(position),
      managerEmail: managerEmail === '' ? null : managerEmail,
      startDate: optionalDate('datum_nastupu'),
      endDate: optionalDate('datum_ukonceni'),
      status,
    })
  }

  reportUnknownManagers(rows, employees, issues)
  return { employees, issues: issues.issues }
}

function reportUnknownManagers(
  rows: readonly SourceRow[],
  employees: ReadonlyMap<string, Employee>,
  issues: IssueCollector,
): void {
  const knownEmails = new Set([...employees.values()].map((employee) => employee.email))
  // First occurrence wins, matching mapEmployees (later duplicates are dropped).
  const rowById = new Map<string, number>()
  for (const source of rows) {
    const id = field(source, 'id_zamestnance').toUpperCase()
    if (!rowById.has(id)) rowById.set(id, source.row)
  }
  for (const employee of employees.values()) {
    if (employee.managerEmail !== null && !knownEmails.has(employee.managerEmail)) {
      issues.add(rowById.get(employee.id) ?? null, 'unknown-manager', 'flagged', 'vedouci_email')
    }
  }
}

/** Why an employee is (not) part of the training overview on a given day. */
export type OverviewScope =
  | { readonly included: true; readonly startsInFuture: boolean; readonly onParentalLeave: boolean }
  | { readonly included: false; readonly reason: 'terminated' }

/**
 * Terminated employees (by status or by an end date already passed) are left out.
 * Future joiners are included – their obligations start on their start date.
 */
export function overviewScope(employee: Employee, today: LocalDate): OverviewScope {
  const leftAlready = employee.endDate !== null && compareDates(employee.endDate, today) < 0
  if (employee.status === 'terminated' || leftAlready) return { included: false, reason: 'terminated' }
  return {
    included: true,
    startsInFuture: employee.startDate !== null && compareDates(employee.startDate, today) > 0,
    onParentalLeave: employee.status === 'parental-leave',
  }
}
