import type { LocalDate } from '../domain/config.ts'
import {
  allocateEnrolments,
  type Assignment,
  type EnrolmentNeed,
  type OfferedSession,
  type Unassigned,
  type UnassignedReason,
} from '../domain/enrolment.ts'
import type { Session } from '../domain/session.ts'
import { sessionOffer, type SessionOffer } from '../domain/session-offer.ts'
import type { TrainingOverview } from './build-training-overview.ts'
import type { Dataset } from './load-dataset.ts'

export interface EnrolmentOptions {
  readonly today: LocalDate
}

export interface SessionUsage {
  readonly session: Session
  readonly offer: SessionOffer
  /** Recommended enrolments on this session. */
  readonly assigned: number
  /** Free seats after the recommendation (0 for sessions not offered). */
  readonly seatsLeft: number
}

export interface EnrolmentPlan {
  readonly assignments: readonly Assignment[]
  readonly unassigned: readonly Unassigned[]
  /** Every session from the export, in file order, with why it is (not) offered. */
  readonly sessions: readonly SessionUsage[]
  readonly unassignedCounts: Readonly<Record<UnassignedReason, number>>
  /** Department-based trainings that cannot be decided (missing department): neither booked nor counted above. */
  readonly undeterminedRequirements: readonly UndeterminedRequirement[]
}

export interface UndeterminedRequirement {
  readonly employeeId: string
  readonly code: string
}

const UNASSIGNED_REASONS: readonly UnassignedReason[] = [
  'parental-leave',
  'undetermined-validity',
  'leaves-before-expiry',
  'no-session',
  'no-offered-session',
  'no-session-in-employment',
  'capacity-exhausted',
  'time-conflict',
]

/** Who to book on which session: every mandatory training that is not valid, against offered sessions. */
export function recommendEnrolments(
  dataset: Dataset,
  overview: TrainingOverview,
  options: EnrolmentOptions,
): EnrolmentPlan {
  const needs: EnrolmentNeed[] = []
  const undeterminedRequirements: UndeterminedRequirement[] = []
  for (const entry of overview.employees) {
    for (const code of entry.undeterminedRequirements) {
      undeterminedRequirements.push({ employeeId: entry.employee.id, code })
    }
    for (const training of entry.trainings) {
      if (training.status === 'valid') continue
      needs.push({
        employeeId: entry.employee.id,
        code: training.code,
        status: training.status,
        daysLeft: training.daysLeft,
        validUntil: training.validUntil,
        startsOn: entry.flags.startsOn,
        leavesOn: entry.flags.leavesOn,
        onParentalLeave: entry.flags.onParentalLeave,
      })
    }
  }

  const offers = dataset.sessions.map((session) => ({ session, offer: sessionOffer(session, options.today) }))
  const offered: OfferedSession[] = []
  for (const { session, offer } of offers) {
    if (!offer.offered || session.date === null) continue
    offered.push({
      id: session.id,
      code: session.code,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      freeSeats: session.freeSeats,
    })
  }

  const scheduledCodes = new Set(dataset.sessions.filter((session) => session.codeKnown).map((session) => session.code))
  const result = allocateEnrolments(needs, offered, { scheduledCodes })
  const assignedBySession = new Map<string, number>()
  for (const assignment of result.assignments) {
    assignedBySession.set(assignment.sessionId, (assignedBySession.get(assignment.sessionId) ?? 0) + 1)
  }
  const unassignedCounts = Object.fromEntries(UNASSIGNED_REASONS.map((reason) => [reason, 0])) as Record<
    UnassignedReason,
    number
  >
  for (const entry of result.unassigned) unassignedCounts[entry.reason] += 1

  return {
    assignments: result.assignments,
    unassigned: result.unassigned,
    sessions: offers.map(({ session, offer }) => ({
      session,
      offer,
      assigned: offer.offered ? (assignedBySession.get(session.id) ?? 0) : 0,
      seatsLeft: offer.offered ? (result.remainingSeats.get(session.id) ?? 0) : 0,
    })),
    unassignedCounts,
    undeterminedRequirements,
  }
}
