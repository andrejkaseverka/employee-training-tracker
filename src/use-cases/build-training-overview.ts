import { requirementFor } from '../domain/catalog.ts'
import type { Completion, ValiditySource } from '../domain/completion.ts'
import type { LocalDate } from '../domain/config.ts'
import { overviewScope, type Employee } from '../domain/employee.ts'
import { STATUS_PRIORITY } from '../domain/enrolment.ts'
import {
  evaluateStatus,
  pickEffectiveCompletion,
  TRAINING_STATUSES,
  type TrainingStatus,
} from '../domain/training-status.ts'
import type { Dataset } from './load-dataset.ts'

export interface OverviewOptions {
  readonly today: LocalDate
  readonly expiringSoonDays: number
}

export interface TrainingStatusRow {
  readonly code: string
  readonly trainingName: string
  readonly status: TrainingStatus
  readonly lastCompletedOn: LocalDate | null
  readonly validUntil: LocalDate | null
  readonly validitySource: ValiditySource | null
  readonly daysLeft: number | null
}

export interface EmployeeFlags {
  readonly startsOn: LocalDate | null
  readonly leavesOn: LocalDate | null
  readonly onParentalLeave: boolean
  readonly missingDepartment: boolean
}

export interface EmployeeOverview {
  readonly employee: Employee
  readonly flags: EmployeeFlags
  /** Mandatory trainings only, sorted by urgency. */
  readonly trainings: readonly TrainingStatusRow[]
  /** Codes of department-based trainings that cannot be decided because the department is missing. */
  readonly undeterminedRequirements: readonly string[]
}

export interface TrainingOverview {
  readonly employees: readonly EmployeeOverview[]
  readonly statusCounts: Readonly<Record<TrainingStatus, number>>
  readonly excludedTerminated: number
}

/** Status of every mandatory training for every employee in scope. */
export function buildTrainingOverview(dataset: Dataset, options: OverviewOptions): TrainingOverview {
  const completionsByKey = groupCompletions(dataset.completions)
  const statusCounts = Object.fromEntries(TRAINING_STATUSES.map((status) => [status, 0])) as Record<
    TrainingStatus,
    number
  >
  const employees: EmployeeOverview[] = []
  let excludedTerminated = 0

  for (const employee of dataset.employees.values()) {
    const scope = overviewScope(employee, options.today)
    if (!scope.included) {
      excludedTerminated += 1
      continue
    }

    const trainings: TrainingStatusRow[] = []
    const undeterminedRequirements: string[] = []
    for (const training of dataset.catalog.values()) {
      const requirement = requirementFor(training, employee)
      if (requirement === 'undeterminable') undeterminedRequirements.push(training.code)
      if (requirement !== 'required') continue

      const effective = pickEffectiveCompletion(completionsByKey.get(key(employee.id, training.code)) ?? [])
      const evaluation = evaluateStatus(effective, options.today, options.expiringSoonDays)
      statusCounts[evaluation.status] += 1
      trainings.push({
        code: training.code,
        trainingName: training.name,
        status: evaluation.status,
        lastCompletedOn: effective?.completedOn ?? null,
        validUntil: effective?.validUntil ?? null,
        validitySource: effective?.validitySource ?? null,
        daysLeft: evaluation.daysLeft,
      })
    }

    trainings.sort(byUrgency)
    employees.push({
      employee,
      flags: {
        startsOn: scope.startsInFuture ? employee.startDate : null,
        leavesOn: employee.endDate,
        onParentalLeave: scope.onParentalLeave,
        missingDepartment: employee.department === null,
      },
      trainings,
      undeterminedRequirements,
    })
  }

  employees.sort(
    (a, b) =>
      a.employee.lastName.localeCompare(b.employee.lastName, 'cs') ||
      a.employee.firstName.localeCompare(b.employee.firstName, 'cs') ||
      a.employee.id.localeCompare(b.employee.id),
  )
  return { employees, statusCounts, excludedTerminated }
}

function key(employeeId: string, code: string): string {
  return `${employeeId}|${code}`
}

function groupCompletions(completions: readonly Completion[]): Map<string, Completion[]> {
  const grouped = new Map<string, Completion[]>()
  for (const completion of completions) {
    const groupKey = key(completion.employeeId, completion.code)
    const group = grouped.get(groupKey) ?? []
    group.push(completion)
    grouped.set(groupKey, group)
  }
  return grouped
}

/** Valid trainings come after every status that needs action. */
const VALID_RANK = Math.max(...Object.values(STATUS_PRIORITY)) + 1

function urgencyRank(status: TrainingStatus): number {
  return status === 'valid' ? VALID_RANK : STATUS_PRIORITY[status]
}

/** Shared urgency order (assumption #18), then fewest days left. */
function byUrgency(a: TrainingStatusRow, b: TrainingStatusRow): number {
  const byStatus = urgencyRank(a.status) - urgencyRank(b.status)
  if (byStatus !== 0) return byStatus
  return (a.daysLeft ?? Number.POSITIVE_INFINITY) - (b.daysLeft ?? Number.POSITIVE_INFINITY) || a.code.localeCompare(b.code)
}
