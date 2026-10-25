import type { LocalDate } from './config.ts'
import { compareDates } from './date.ts'
import type { Session } from './session.ts'

/** Why a session is not offered for enrolment. */
export type NotOfferedReason = 'unknown-code' | 'invalid-date' | 'past' | 'cancelled' | 'duplicate' | 'full'

export type SessionOffer = { readonly offered: true } | { readonly offered: false; readonly reason: NotOfferedReason }

/**
 * A session is offered when it can really take another person: known training, valid date
 * strictly after today (booking on the export day is too late), planned, not a duplicate, free seats.
 */
export function sessionOffer(session: Session, today: LocalDate): SessionOffer {
  if (!session.codeKnown) return { offered: false, reason: 'unknown-code' }
  if (session.date === null) return { offered: false, reason: 'invalid-date' }
  if (compareDates(session.date, today) <= 0) return { offered: false, reason: 'past' }
  if (session.cancelled) return { offered: false, reason: 'cancelled' }
  if (session.duplicateOf !== null) return { offered: false, reason: 'duplicate' }
  if (session.freeSeats <= 0) return { offered: false, reason: 'full' }
  return { offered: true }
}

/** Time slot of a session; a session with an unreadable time occupies the whole day. */
export interface SessionSlot {
  readonly date: LocalDate
  readonly startTime: string | null
  readonly endTime: string | null
}

/** Same day and overlapping time (`HH:MM` strings compare correctly). Touching ends do not overlap. */
export function sessionsOverlap(a: SessionSlot, b: SessionSlot): boolean {
  if (a.date !== b.date) return false
  if (a.startTime === null || a.endTime === null || b.startTime === null || b.endTime === null) return true
  return a.startTime < b.endTime && b.startTime < a.endTime
}
