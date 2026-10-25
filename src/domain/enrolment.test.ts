import { describe, expect, it } from 'vitest'
import type { LocalDate } from './config.ts'
import { allocateEnrolments, compareNeeds, type EnrolmentNeed, type OfferedSession } from './enrolment.ts'

const d = (iso: string): LocalDate => iso as LocalDate

const need = (overrides: Partial<EnrolmentNeed> = {}): EnrolmentNeed => ({
  employeeId: 'P1',
  code: 'KYBER',
  status: 'missing',
  daysLeft: null,
  validUntil: null,
  startsOn: null,
  leavesOn: null,
  onParentalLeave: false,
  ...overrides,
})

const session = (overrides: Partial<OfferedSession> = {}): OfferedSession => ({
  id: 'S1',
  code: 'KYBER',
  date: d('2026-10-20'),
  startTime: '09:00',
  endTime: '12:00',
  freeSeats: 10,
  ...overrides,
})

const placed = (result: ReturnType<typeof allocateEnrolments>): Record<string, string> =>
  Object.fromEntries(result.assignments.map((a) => [`${a.need.employeeId}|${a.need.code}`, a.sessionId]))

const reasons = (result: ReturnType<typeof allocateEnrolments>): Record<string, string> =>
  Object.fromEntries(result.unassigned.map((u) => [`${u.need.employeeId}|${u.need.code}`, u.reason]))

describe('compareNeeds', () => {
  it('orders missing, then expired by overdue days, then expiring by days left', () => {
    const needs = [
      need({ employeeId: 'A', status: 'expiring', daysLeft: 30 }),
      need({ employeeId: 'B', status: 'expired', daysLeft: -5 }),
      need({ employeeId: 'C', status: 'expiring', daysLeft: 3 }),
      need({ employeeId: 'D', status: 'missing' }),
      need({ employeeId: 'E', status: 'expired', daysLeft: -200 }),
    ]
    expect([...needs].sort(compareNeeds).map((n) => n.employeeId)).toEqual(['D', 'E', 'B', 'C', 'A'])
  })
})

describe('allocateEnrolments', () => {
  it('assigns the earliest session with a free seat', () => {
    const result = allocateEnrolments(
      [need()],
      [session({ id: 'LATE', date: d('2026-11-20') }), session({ id: 'EARLY', date: d('2026-10-10') })],
    )
    expect(placed(result)).toEqual({ 'P1|KYBER': 'EARLY' })
    expect(result.remainingSeats.get('EARLY')).toBe(9)
  })

  it('gives the last seat to the higher priority and moves the next to a later session', () => {
    const result = allocateEnrolments(
      [need({ employeeId: 'EXP', status: 'expired', daysLeft: -10 }), need({ employeeId: 'MIS' })],
      [session({ id: 'ONE', freeSeats: 1 }), session({ id: 'TWO', date: d('2026-12-01') })],
    )
    expect(placed(result)).toEqual({ 'MIS|KYBER': 'ONE', 'EXP|KYBER': 'TWO' })
  })

  it('reports capacity-exhausted when every fitting session is full', () => {
    const result = allocateEnrolments(
      [need({ employeeId: 'A' }), need({ employeeId: 'B' })],
      [session({ freeSeats: 1 })],
    )
    expect(placed(result)).toEqual({ 'A|KYBER': 'S1' })
    expect(reasons(result)).toEqual({ 'B|KYBER': 'capacity-exhausted' })
    expect(result.remainingSeats.get('S1')).toBe(0)
  })

  it('reports no-session when the training has no offered session', () => {
    expect(reasons(allocateEnrolments([need({ code: 'ZDVIH' })], [session()]))).toEqual({ 'P1|ZDVIH': 'no-session' })
  })

  it('reports no-offered-session when the training is scheduled but none of its sessions is offered', () => {
    const result = allocateEnrolments([need({ code: 'ZDVIH' })], [session()], { scheduledCodes: new Set(['ZDVIH']) })
    expect(reasons(result)).toEqual({ 'P1|ZDVIH': 'no-offered-session' })
  })

  it('respects the start date of a future joiner', () => {
    const result = allocateEnrolments(
      [need({ startsOn: d('2026-10-15') })],
      [session({ id: 'BEFORE', date: d('2026-10-10') }), session({ id: 'ON', date: d('2026-10-15') })],
    )
    expect(placed(result)).toEqual({ 'P1|KYBER': 'ON' })
  })

  it('respects the end date of a leaving employee', () => {
    const result = allocateEnrolments([need({ leavesOn: d('2026-10-15') })], [session({ date: d('2026-10-20') })])
    expect(reasons(result)).toEqual({ 'P1|KYBER': 'no-session-in-employment' })
  })

  it('does not book people on parental leave or with undetermined validity', () => {
    const result = allocateEnrolments(
      [need({ employeeId: 'PAR', onParentalLeave: true }), need({ employeeId: 'UND', status: 'undetermined' })],
      [session()],
    )
    expect(reasons(result)).toEqual({ 'PAR|KYBER': 'parental-leave', 'UND|KYBER': 'undetermined-validity' })
    expect(result.remainingSeats.get('S1')).toBe(10)
  })

  it('skips an expiring training of someone leaving before it expires', () => {
    const result = allocateEnrolments(
      [need({ status: 'expiring', daysLeft: 40, validUntil: d('2026-11-10'), leavesOn: d('2026-11-10') })],
      [session()],
    )
    expect(reasons(result)).toEqual({ 'P1|KYBER': 'leaves-before-expiry' })
  })

  it('books an expiring training after its end and reports the gap', () => {
    const result = allocateEnrolments(
      [need({ status: 'expiring', daysLeft: 9, validUntil: d('2026-10-10') })],
      [session({ date: d('2026-10-20') })],
    )
    expect(result.assignments[0]?.validityGapDays).toBe(10)
  })

  it('reports no gap when the session is on or before the last valid day', () => {
    const result = allocateEnrolments(
      [need({ status: 'expiring', daysLeft: 19, validUntil: d('2026-10-20') })],
      [session({ date: d('2026-10-20') })],
    )
    expect(result.assignments[0]?.validityGapDays).toBeNull()
  })

  it('avoids a time clash with an earlier assignment of the same person', () => {
    const result = allocateEnrolments(
      [need({ code: 'BOZP-Z' }), need({ code: 'KYBER', status: 'expired', daysLeft: -1 })],
      [
        session({ id: 'BOZP', code: 'BOZP-Z', startTime: '10:00', endTime: '12:00' }),
        session({ id: 'KYB-CLASH' }),
        session({ id: 'KYB-LATER', date: d('2026-10-27') }),
      ],
    )
    expect(placed(result)).toEqual({ 'P1|BOZP-Z': 'BOZP', 'P1|KYBER': 'KYB-LATER' })
  })

  it('reports time-conflict when the only free seat clashes', () => {
    const result = allocateEnrolments(
      [need({ code: 'BOZP-Z' }), need({ code: 'KYBER', status: 'expired', daysLeft: -1 })],
      [session({ id: 'BOZP', code: 'BOZP-Z' }), session({ id: 'KYB' })],
    )
    expect(reasons(result)).toEqual({ 'P1|KYBER': 'time-conflict' })
  })

  it('assigns at most once per employee and training', () => {
    const result = allocateEnrolments([need(), need()], [session()])
    expect(result.assignments).toHaveLength(1)
    expect(result.unassigned).toHaveLength(0)
  })

  it('is deterministic regardless of input order', () => {
    const needs = [
      need({ employeeId: 'A' }),
      need({ employeeId: 'B', status: 'expired', daysLeft: -3 }),
      need({ employeeId: 'C', status: 'expiring', daysLeft: 5, validUntil: d('2026-10-06') }),
    ]
    const sessions = [session({ id: 'X', freeSeats: 1 }), session({ id: 'Y', freeSeats: 1, date: d('2026-11-01') })]
    const forward = allocateEnrolments(needs, sessions)
    const reversed = allocateEnrolments([...needs].reverse(), [...sessions].reverse())
    expect(placed(reversed)).toEqual(placed(forward))
    expect(reasons(reversed)).toEqual(reasons(forward))
    expect(placed(forward)).toEqual({ 'A|KYBER': 'X', 'B|KYBER': 'Y' })
    expect(reasons(forward)).toEqual({ 'C|KYBER': 'capacity-exhausted' })
  })
})
