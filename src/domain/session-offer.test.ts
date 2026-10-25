import { describe, expect, it } from 'vitest'
import type { LocalDate } from './config.ts'
import type { Session } from './session.ts'
import { sessionOffer, sessionsOverlap } from './session-offer.ts'

const today = '2026-10-01' as LocalDate

const session = (overrides: Partial<Session> = {}): Session => ({
  row: 2,
  id: 'S1',
  code: 'KYBER',
  codeKnown: true,
  date: '2026-10-20' as LocalDate,
  startTime: '09:00',
  endTime: '12:00',
  place: 'Učebna A',
  capacity: 20,
  booked: 5,
  freeSeats: 15,
  cancelled: false,
  duplicateOf: null,
  ...overrides,
})

describe('sessionOffer', () => {
  it('offers a planned future session with free seats', () => {
    expect(sessionOffer(session(), today)).toEqual({ offered: true })
  })

  it.each([
    ['unknown-code', { codeKnown: false }],
    ['invalid-date', { date: null }],
    ['past', { date: '2026-09-30' as LocalDate }],
    ['past', { date: today }],
    ['cancelled', { cancelled: true }],
    ['duplicate', { duplicateOf: 'S0' }],
    ['full', { freeSeats: 0 }],
  ] as const)('does not offer: %s', (reason, overrides) => {
    expect(sessionOffer(session(overrides), today)).toEqual({ offered: false, reason })
  })

  it('reports the first applicable reason (unknown code before cancelled)', () => {
    expect(sessionOffer(session({ codeKnown: false, cancelled: true }), today)).toEqual({
      offered: false,
      reason: 'unknown-code',
    })
  })
})

describe('sessionsOverlap', () => {
  const slot = (date: string, startTime: string | null, endTime: string | null) => ({
    date: date as LocalDate,
    startTime,
    endTime,
  })

  it('detects overlapping time on the same day', () => {
    expect(sessionsOverlap(slot('2026-10-20', '09:00', '12:00'), slot('2026-10-20', '11:00', '13:00'))).toBe(true)
  })

  it('treats touching sessions as not overlapping', () => {
    expect(sessionsOverlap(slot('2026-10-20', '09:00', '12:00'), slot('2026-10-20', '12:00', '13:00'))).toBe(false)
  })

  it('never overlaps on different days', () => {
    expect(sessionsOverlap(slot('2026-10-20', '09:00', '12:00'), slot('2026-10-21', '09:00', '12:00'))).toBe(false)
  })

  it('treats an unreadable time as the whole day', () => {
    expect(sessionsOverlap(slot('2026-10-20', null, null), slot('2026-10-20', '15:00', '16:00'))).toBe(true)
  })
})
