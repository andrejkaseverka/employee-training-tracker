import { describe, expect, it } from 'vitest'
import type { Training } from './catalog.ts'
import { mapSessions, parseTimeRange } from './session.ts'
import type { SourceRow } from './source-row.ts'

const catalog = new Map<string, Training>([
  ['KYBER', { code: 'KYBER', name: 'Kyber', validity: { kind: 'months', months: 12 }, rule: { kind: 'all' } }],
])

let counter = 1
const row = (values: Record<string, string>): SourceRow => ({
  row: ++counter,
  values: {
    id_terminu: `S${counter}`,
    kod_skoleni: 'KYBER',
    datum: '2026-10-20',
    cas: '09:00-12:00',
    misto: 'Učebna A',
    kapacita: '20',
    obsazeno: '5',
    cena_na_osobu: '450',
    stav: 'plánováno',
    ...values,
  },
})

const kinds = (rows: SourceRow[]): string[] => mapSessions(rows, catalog).issues.map((issue) => issue.kind)

describe('parseTimeRange', () => {
  it('parses and pads times', () => {
    expect(parseTimeRange('9:00-12:00')).toEqual({ start: '09:00', end: '12:00' })
    expect(parseTimeRange('07:30 - 15:30')).toEqual({ start: '07:30', end: '15:30' })
  })

  it('rejects invalid ranges', () => {
    expect(parseTimeRange('12:00-09:00')).toBeNull()
    expect(parseTimeRange('25:00-26:00')).toBeNull()
    expect(parseTimeRange('dopoledne')).toBeNull()
  })
})

describe('mapSessions', () => {
  it('maps a valid session', () => {
    const { sessions, issues } = mapSessions([row({})], catalog)
    expect(sessions[0]).toMatchObject({
      code: 'KYBER',
      codeKnown: true,
      date: '2026-10-20',
      startTime: '09:00',
      endTime: '12:00',
      freeSeats: 15,
      cancelled: false,
      duplicateOf: null,
    })
    expect(issues).toEqual([])
  })

  it('never reports negative free seats for overbooked sessions', () => {
    const { sessions } = mapSessions([row({ kapacita: '30', obsazeno: '31' })], catalog)
    expect(sessions[0]?.freeSeats).toBe(0)
    expect(kinds([row({ kapacita: '30', obsazeno: '31' })])).toEqual(['overbooked-session'])
  })

  it('keeps problematic sessions but flags them', () => {
    expect(kinds([row({ datum: '31. 9. 2026' })])).toEqual(['invalid-date'])
    expect(kinds([row({ kod_skoleni: 'KYB3R' })])).toEqual(['unknown-training-code'])
    expect(kinds([row({ kapacita: 'hodně' })])).toEqual(['invalid-number'])
    expect(mapSessions([row({ kapacita: 'hodně' })], catalog).sessions[0]?.freeSeats).toBe(0)
  })

  it('recognises cancelled sessions; unknown status counts as cancelled', () => {
    expect(mapSessions([row({ stav: 'zrušeno' })], catalog).sessions[0]?.cancelled).toBe(true)
    expect(mapSessions([row({ stav: 'možná' })], catalog).sessions[0]?.cancelled).toBe(true)
    expect(kinds([row({ stav: 'možná' })])).toEqual(['unknown-status'])
  })

  it('marks sessions identical except for the id as duplicates', () => {
    const first = row({})
    const second = row({ datum: '20. 10. 2026' })
    const { sessions } = mapSessions([first, second], catalog)
    expect(sessions[1]?.duplicateOf).toBe(first.values['id_terminu'])
    expect(kinds([row({}), row({})])).toEqual(['duplicate-session'])
  })

  it('detects duplicates whose time is written differently', () => {
    expect(kinds([row({ cas: '09:00-12:00' }), row({ cas: '9:00 - 12:00' })])).toEqual(['duplicate-session'])
  })
})
