import type { LocalDate } from './config.ts'
import { compareDates, daysBetween } from './date.ts'
import { sessionsOverlap, type SessionSlot } from './session-offer.ts'

/** Training statuses that ask for action; `undetermined` is reported, never booked. */
export type NeedStatus = 'missing' | 'expired' | 'expiring' | 'undetermined'

/** One mandatory training one employee should attend. */
export interface EnrolmentNeed {
  readonly employeeId: string
  readonly code: string
  readonly status: NeedStatus
  /** Days to the last valid day (negative = expired); null for missing / undetermined. */
  readonly daysLeft: number | null
  readonly validUntil: LocalDate | null
  /** Future start date: only sessions on or after it fit. */
  readonly startsOn: LocalDate | null
  /** Planned end date: only sessions on or before it fit. */
  readonly leavesOn: LocalDate | null
  readonly onParentalLeave: boolean
}

/** A session that is offered (see sessionOffer) with its free seats. */
export interface OfferedSession extends SessionSlot {
  readonly id: string
  readonly code: string
  readonly freeSeats: number
}

export type UnassignedReason =
  | 'parental-leave'
  | 'undetermined-validity'
  | 'leaves-before-expiry'
  /** The training has no session at all in the export. */
  | 'no-session'
  /** The training has sessions, but none is offered (past, cancelled, full, duplicate…). */
  | 'no-offered-session'
  | 'no-session-in-employment'
  | 'capacity-exhausted'
  | 'time-conflict'

export interface Assignment {
  readonly need: EnrolmentNeed
  readonly sessionId: string
  readonly sessionDate: LocalDate
  /** For `expiring`: days from the last valid day to the session when it comes too late; otherwise null. */
  readonly validityGapDays: number | null
}

export interface Unassigned {
  readonly need: EnrolmentNeed
  readonly reason: UnassignedReason
}

export interface AllocationOptions {
  /** Codes with at least one session in the export, offered or not; tells `no-session` from `no-offered-session`. */
  readonly scheduledCodes?: ReadonlySet<string>
}

export interface AllocationResult {
  /** In allocation (priority) order. */
  readonly assignments: readonly Assignment[]
  readonly unassigned: readonly Unassigned[]
  /** Free seats left per session id. */
  readonly remainingSeats: ReadonlyMap<string, number>
}

const STATUS_PRIORITY: Readonly<Record<NeedStatus, number>> = {
  missing: 0,
  expired: 1,
  expiring: 2,
  undetermined: 3,
}

/** Missing → expired (longest overdue first) → expiring (fewest days left first); then employee id and code. */
export function compareNeeds(a: EnrolmentNeed, b: EnrolmentNeed): number {
  return (
    STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] ||
    (a.daysLeft ?? 0) - (b.daysLeft ?? 0) ||
    a.employeeId.localeCompare(b.employeeId) ||
    a.code.localeCompare(b.code)
  )
}

function compareSessions(a: OfferedSession, b: OfferedSession): number {
  return compareDates(a.date, b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.id.localeCompare(b.id)
}

/**
 * Greedy, deterministic allocation: needs in priority order each take the earliest fitting
 * session with a free seat that does not clash with the employee's earlier assignments.
 * People are never moved to make room for others (optimal re-packing is out of scope).
 */
export function allocateEnrolments(
  needs: readonly EnrolmentNeed[],
  sessions: readonly OfferedSession[],
  options: AllocationOptions = {},
): AllocationResult {
  const sessionsByCode = new Map<string, OfferedSession[]>()
  for (const session of [...sessions].sort(compareSessions)) {
    const group = sessionsByCode.get(session.code) ?? []
    group.push(session)
    sessionsByCode.set(session.code, group)
  }
  const remainingSeats = new Map(sessions.map((session) => [session.id, session.freeSeats]))
  const bookedSlots = new Map<string, SessionSlot[]>()
  const handled = new Set<string>()
  const assignments: Assignment[] = []
  const unassigned: Unassigned[] = []

  for (const need of [...needs].sort(compareNeeds)) {
    const needKey = `${need.employeeId}|${need.code}`
    if (handled.has(needKey)) continue
    handled.add(needKey)

    const blocker = blockingReason(need)
    if (blocker !== null) {
      unassigned.push({ need, reason: blocker })
      continue
    }
    const forCode = sessionsByCode.get(need.code) ?? []
    if (forCode.length === 0) {
      unassigned.push({ need, reason: options.scheduledCodes?.has(need.code) ? 'no-offered-session' : 'no-session' })
      continue
    }
    const inEmployment = forCode.filter((session) => withinEmployment(session.date, need))
    if (inEmployment.length === 0) {
      unassigned.push({ need, reason: 'no-session-in-employment' })
      continue
    }
    const withSeats = inEmployment.filter((session) => (remainingSeats.get(session.id) ?? 0) > 0)
    const slots = bookedSlots.get(need.employeeId) ?? []
    const chosen = withSeats.find((session) => !slots.some((slot) => sessionsOverlap(slot, session)))
    if (chosen === undefined) {
      unassigned.push({ need, reason: withSeats.length > 0 ? 'time-conflict' : 'capacity-exhausted' })
      continue
    }

    remainingSeats.set(chosen.id, (remainingSeats.get(chosen.id) ?? 0) - 1)
    bookedSlots.set(need.employeeId, [...slots, chosen])
    assignments.push({ need, sessionId: chosen.id, sessionDate: chosen.date, validityGapDays: validityGap(need, chosen.date) })
  }
  return { assignments, unassigned, remainingSeats }
}

function blockingReason(need: EnrolmentNeed): UnassignedReason | null {
  if (need.onParentalLeave) return 'parental-leave'
  if (need.status === 'undetermined') return 'undetermined-validity'
  if (
    need.status === 'expiring' &&
    need.leavesOn !== null &&
    need.validUntil !== null &&
    compareDates(need.leavesOn, need.validUntil) <= 0
  ) {
    return 'leaves-before-expiry'
  }
  return null
}

function withinEmployment(date: LocalDate, need: EnrolmentNeed): boolean {
  if (need.startsOn !== null && compareDates(date, need.startsOn) < 0) return false
  if (need.leavesOn !== null && compareDates(date, need.leavesOn) > 0) return false
  return true
}

function validityGap(need: EnrolmentNeed, sessionDate: LocalDate): number | null {
  if (need.status !== 'expiring' || need.validUntil === null) return null
  const gap = daysBetween(need.validUntil, sessionDate)
  return gap > 0 ? gap : null
}
