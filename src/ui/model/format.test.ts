import { describe, expect, it } from 'vitest'
import type { LocalDate } from '../../domain/config.ts'
import { days, describeFlags, formatDate, formatDaysLeft, formatGap, formatTime } from './format.ts'

describe('format', () => {
  it('formats ISO dates the Czech way', () => {
    expect(formatDate('2026-10-01' as LocalDate)).toBe('1. 10. 2026')
    expect(formatDate(null)).toBe('–')
  })

  it('declines "day" by number', () => {
    expect([1, 2, 4, 5, 22].map(days)).toEqual(['1 den', '2 dny', '4 dny', '5 dní', '22 dní'])
  })

  it('describes remaining and overdue validity', () => {
    expect(formatDaysLeft(null)).toBe('')
    expect(formatDaysLeft(0)).toBe('končí dnes')
    expect(formatDaysLeft(12)).toBe('zbývá 12 dní')
    expect(formatDaysLeft(-1)).toBe('prošlo před 1 dnem')
    expect(formatDaysLeft(-40)).toBe('prošlo před 40 dny')
  })

  it('formats validity gaps and time ranges', () => {
    expect(formatGap(3)).toBe('platnost přerušena 3 dny')
    expect(formatTime('08:00', '12:00')).toBe('08:00–12:00')
    expect(formatTime(null, null)).toBe('čas neznámý')
  })

  it('lists person flags', () => {
    const none = { startsOn: null, leavesOn: null, onParentalLeave: false, missingDepartment: false }
    expect(describeFlags(none)).toEqual([])
    expect(
      describeFlags({ startsOn: '2026-10-15' as LocalDate, leavesOn: null, onParentalLeave: true, missingDepartment: true }),
    ).toEqual(['nastupuje 15. 10. 2026', 'rodičovská dovolená', 'chybí útvar'])
  })
})
