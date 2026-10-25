import type { Employee } from '../../domain/employee.ts'
import { comparisonKey } from '../../domain/normalize.ts'
import type { TrainingStatus } from '../../domain/training-status.ts'
import type { EmployeeOverview } from '../../use-cases/build-training-overview.ts'

/** Filter value meaning "no filter". */
export const ANY = ''
/** Department filter value for employees without a department. */
export const NO_DEPARTMENT = '(bez útvaru)'

export interface PersonFilter {
  /** Canonical department name, `NO_DEPARTMENT` or `ANY`. */
  readonly department: string
  /** Part of the name or id; diacritics and case are ignored. */
  readonly search: string
}

export interface TrainingFilter {
  readonly status: TrainingStatus | typeof ANY
  readonly code: string
}

export const EMPTY_PERSON_FILTER: PersonFilter = { department: ANY, search: '' }
export const EMPTY_TRAINING_FILTER: TrainingFilter = { status: ANY, code: ANY }

export function matchesPerson(employee: Employee, filter: PersonFilter): boolean {
  if (filter.department === NO_DEPARTMENT && employee.department !== null) return false
  if (filter.department !== ANY && filter.department !== NO_DEPARTMENT && employee.department !== filter.department) {
    return false
  }
  const needle = comparisonKey(filter.search)
  if (needle === '') return true
  // Name in both orders, so "Jan Novák" and "Novák Jan" both match.
  const haystack = comparisonKey(`${employee.firstName} ${employee.lastName} ${employee.firstName} ${employee.id}`)
  return haystack.includes(needle)
}

export function matchesTraining(training: { readonly code: string; readonly status: TrainingStatus | null }, filter: TrainingFilter): boolean {
  return (filter.code === ANY || training.code === filter.code) && (filter.status === ANY || training.status === filter.status)
}

/** People matching the person filter who have at least one mandatory training matching the training filter. */
export function filterEmployees(
  employees: readonly EmployeeOverview[],
  person: PersonFilter,
  training: TrainingFilter,
): EmployeeOverview[] {
  const trainingFilterActive = training.status !== ANY || training.code !== ANY
  return employees.filter(
    (entry) =>
      matchesPerson(entry.employee, person) &&
      (!trainingFilterActive || entry.trainings.some((row) => matchesTraining(row, training))),
  )
}

/** Department options for the filter: canonical names, plus "without department" when someone has none. */
export function departmentOptions(employees: readonly EmployeeOverview[]): string[] {
  const names = new Set<string>()
  let missing = false
  for (const { employee } of employees) {
    if (employee.department === null) missing = true
    else names.add(employee.department)
  }
  const sorted = [...names].sort((a, b) => a.localeCompare(b, 'cs'))
  return missing ? [...sorted, NO_DEPARTMENT] : sorted
}
