import { describe, expect, it } from 'vitest'
import type { LocalDate } from './config.ts'
import { addDays, addMonths, addYears, compareDates, daysBetween, parseLocalDate, toLocalDate } from './date.ts'

const d = (value: string): LocalDate => value as LocalDate

describe('parseLocalDate', () => {
  it('parses ISO dates', () => {
    expect(parseLocalDate('2025-03-07')).toEqual({ ok: true, date: '2025-03-07', source: 'iso' })
  })

  it('parses Czech dates with and without spaces', () => {
    expect(parseLocalDate('7. 3. 2025')).toEqual({ ok: true, date: '2025-03-07', source: 'czech' })
    expect(parseLocalDate('07.03.2025')).toEqual({ ok: true, date: '2025-03-07', source: 'czech' })
  })

  it('trims surrounding whitespace', () => {
    expect(parseLocalDate('  2025-03-07 ')).toMatchObject({ ok: true, date: '2025-03-07' })
  })

  it('converts 5-digit Excel serial dates and flags the source', () => {
    // 45658 is 2025-01-01 in Excel's 1900 date system.
    expect(parseLocalDate('45658')).toEqual({ ok: true, date: '2025-01-01', source: 'excel-serial' })
  })

  it('rejects days that do not exist', () => {
    expect(parseLocalDate('31. 9. 2026')).toEqual({ ok: false, reason: 'invalid-day' })
    expect(parseLocalDate('2025-02-29')).toEqual({ ok: false, reason: 'invalid-day' })
    expect(parseLocalDate('2025-13-01')).toEqual({ ok: false, reason: 'invalid-day' })
  })

  it('accepts 29 February in a leap year', () => {
    expect(parseLocalDate('29. 2. 2024')).toMatchObject({ ok: true, date: '2024-02-29' })
  })

  it('reports empty and unknown formats', () => {
    expect(parseLocalDate('')).toEqual({ ok: false, reason: 'empty' })
    expect(parseLocalDate('   ')).toEqual({ ok: false, reason: 'empty' })
    expect(parseLocalDate('2025/03/07')).toEqual({ ok: false, reason: 'invalid-format' })
    expect(parseLocalDate('1234')).toEqual({ ok: false, reason: 'invalid-format' })
  })
})

describe('addMonths', () => {
  it('adds months across year boundary', () => {
    expect(addMonths(d('2025-11-15'), 3)).toBe('2026-02-15')
  })

  it('clamps to the end of a shorter month', () => {
    expect(addMonths(d('2025-01-31'), 1)).toBe('2025-02-28')
    expect(addMonths(d('2024-01-31'), 1)).toBe('2024-02-29')
  })

  it('supports negative months', () => {
    expect(addMonths(d('2026-03-31'), -1)).toBe('2026-02-28')
  })

  it('adds years via months (leap day)', () => {
    expect(addYears(d('2024-02-29'), 1)).toBe('2025-02-28')
    expect(addYears(d('2026-10-01'), -50)).toBe('1976-10-01')
  })
})

describe('day arithmetic', () => {
  it('adds days', () => {
    expect(addDays(d('2026-09-30'), 1)).toBe('2026-10-01')
    expect(addDays(d('2026-10-01'), -1)).toBe('2026-09-30')
  })

  it('computes days between dates', () => {
    expect(daysBetween(d('2026-10-01'), d('2026-11-30'))).toBe(60)
    expect(daysBetween(d('2026-10-01'), d('2026-09-30'))).toBe(-1)
  })

  it('compares dates', () => {
    expect(compareDates(d('2026-01-01'), d('2026-01-02'))).toBe(-1)
    expect(compareDates(d('2026-01-02'), d('2026-01-02'))).toBe(0)
  })

  it('builds dates from parts', () => {
    expect(toLocalDate(2026, 9, 31)).toBeNull()
    expect(toLocalDate(2026, 9, 30)).toBe('2026-09-30')
  })
})
