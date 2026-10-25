import type { LocalDate } from '../../domain/config.ts'
import type { UnassignedReason } from '../../domain/enrolment.ts'
import { TRAINING_STATUSES, type TrainingStatus } from '../../domain/training-status.ts'
import type { Catalog } from '../../domain/catalog.ts'
import type { EmployeeOverview, TrainingOverview } from '../../use-cases/build-training-overview.ts'
import type { EnrolmentPlan } from '../../use-cases/recommend-enrolments.ts'

/** What happens with an item that needs action. */
export type Resolution =
  | {
      readonly kind: 'assigned'
      readonly sessionId: string
      readonly sessionDate: LocalDate
      readonly validityGapDays: number | null
    }
  | { readonly kind: 'unassigned'; readonly reason: UnassignedReason }
  /** Requirement cannot be decided (missing department): nothing to book until the data is fixed. */
  | { readonly kind: 'check-data' }

export interface AttentionItem {
  readonly person: EmployeeOverview
  readonly code: string
  readonly trainingName: string
  /** Null when it is not even known whether the training is mandatory. */
  readonly status: TrainingStatus | null
  readonly daysLeft: number | null
  readonly validUntil: LocalDate | null
  readonly resolution: Resolution
}

/**
 * "What to deal with": every mandatory training that is not valid, plus requirements that
 * cannot be decided. Most urgent first, each with its recommended session or the reason why not.
 */
export function buildAttentionList(overview: TrainingOverview, plan: EnrolmentPlan, catalog: Catalog): AttentionItem[] {
  const resolutions = new Map<string, Resolution>()
  for (const a of plan.assignments) {
    resolutions.set(key(a.need.employeeId, a.need.code), {
      kind: 'assigned',
      sessionId: a.sessionId,
      sessionDate: a.sessionDate,
      validityGapDays: a.validityGapDays,
    })
  }
  for (const u of plan.unassigned) {
    resolutions.set(key(u.need.employeeId, u.need.code), { kind: 'unassigned', reason: u.reason })
  }

  const items: AttentionItem[] = []
  for (const person of overview.employees) {
    for (const training of person.trainings) {
      if (training.status === 'valid') continue
      items.push({
        person,
        code: training.code,
        trainingName: training.trainingName,
        status: training.status,
        daysLeft: training.daysLeft,
        validUntil: training.validUntil,
        resolution: resolutions.get(key(person.employee.id, training.code)) ?? { kind: 'check-data' },
      })
    }
    for (const code of person.undeterminedRequirements) {
      items.push({
        person,
        code,
        trainingName: catalog.get(code)?.name ?? code,
        status: null,
        daysLeft: null,
        validUntil: null,
        resolution: { kind: 'check-data' },
      })
    }
  }
  return items.sort(byUrgency)
}

function key(employeeId: string, code: string): string {
  return `${employeeId}|${code}`
}

/** Status order (unknown requirement last), then fewest days left, then name. */
function byUrgency(a: AttentionItem, b: AttentionItem): number {
  return (
    statusRank(a.status) - statusRank(b.status) ||
    (a.daysLeft ?? Number.NEGATIVE_INFINITY) - (b.daysLeft ?? Number.NEGATIVE_INFINITY) ||
    a.person.employee.lastName.localeCompare(b.person.employee.lastName, 'cs') ||
    a.person.employee.id.localeCompare(b.person.employee.id) ||
    a.code.localeCompare(b.code)
  )
}

function statusRank(status: TrainingStatus | null): number {
  return status === null ? TRAINING_STATUSES.length : TRAINING_STATUSES.indexOf(status)
}
