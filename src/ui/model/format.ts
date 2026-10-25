import type { LocalDate } from '../../domain/config.ts'

const FEW_MAX = 4

/** ISO date → Czech format "1. 10. 2026". */
export function formatDate(date: LocalDate | null): string {
  if (date === null) return '–'
  const [year, month, day] = date.split('-').map(Number)
  return `${day}. ${month}. ${year}`
}

/** "1 den", "3 dny", "5 dní". */
export function days(count: number): string {
  const n = Math.abs(count)
  if (n === 1) return `${count} den`
  if (n >= 2 && n <= FEW_MAX) return `${count} dny`
  return `${count} dní`
}

/** Remaining validity as text; null days = not applicable. */
export function formatDaysLeft(daysLeft: number | null): string {
  if (daysLeft === null) return ''
  if (daysLeft === 0) return 'končí dnes'
  if (daysLeft > 0) return `zbývá ${days(daysLeft)}`
  const overdue = -daysLeft
  return `prošlo před ${overdue} ${overdue === 1 ? 'dnem' : 'dny'}`
}

export function formatGap(gapDays: number): string {
  return `platnost přerušena ${days(gapDays)}`
}

export function formatTime(start: string | null, end: string | null): string {
  return start === null || end === null ? 'čas neznámý' : `${start}–${end}`
}
