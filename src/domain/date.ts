import { EXCEL_EPOCH, EXCEL_SERIAL_DIGITS, type LocalDate } from './config.ts'

export type { LocalDate }

/** Which textual form a date was parsed from. Excel serials are flagged for data quality. */
export type DateSource = 'iso' | 'czech' | 'excel-serial'

export type DateParseResult =
  | { readonly ok: true; readonly date: LocalDate; readonly source: DateSource }
  | { readonly ok: false; readonly reason: 'empty' | 'invalid-format' | 'invalid-day' }

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const CZECH_PATTERN = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/
const EXCEL_SERIAL_PATTERN = new RegExp(`^\\d{${EXCEL_SERIAL_DIGITS}}$`)
const MS_PER_DAY = 86_400_000
const MONTHS_PER_YEAR = 12

/** Builds a LocalDate from calendar parts, or null when the day does not exist (e.g. 31 Sep). */
export function toLocalDate(year: number, month: number, day: number): LocalDate | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > MONTHS_PER_YEAR || day < 1 || day > daysInMonth(year, month)) return null
  const pad = (value: number, width: number): string => String(value).padStart(width, '0')
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}` as LocalDate
}

/** Parses ISO `YYYY-MM-DD`, Czech `d. m. rrrr` and 5-digit Excel serial dates. */
export function parseLocalDate(raw: string): DateParseResult {
  const value = raw.trim()
  if (value === '') return { ok: false, reason: 'empty' }

  const iso = ISO_PATTERN.exec(value)
  if (iso) return fromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]), 'iso')

  const czech = CZECH_PATTERN.exec(value)
  if (czech) return fromParts(Number(czech[3]), Number(czech[2]), Number(czech[1]), 'czech')

  if (EXCEL_SERIAL_PATTERN.test(value)) {
    return { ok: true, date: addDays(EXCEL_EPOCH, Number(value)), source: 'excel-serial' }
  }
  return { ok: false, reason: 'invalid-format' }
}

/** Adds calendar months; the day is clamped to the end of the target month (31 Jan + 1 → 28/29 Feb). */
export function addMonths(date: LocalDate, months: number): LocalDate {
  const { year, month, day } = parts(date)
  const monthIndex = year * MONTHS_PER_YEAR + (month - 1) + months
  const targetYear = Math.floor(monthIndex / MONTHS_PER_YEAR)
  const targetMonth = (monthIndex % MONTHS_PER_YEAR) + 1
  const targetDay = Math.min(day, daysInMonth(targetYear, targetMonth))
  return toLocalDate(targetYear, targetMonth, targetDay) as LocalDate
}

export function addYears(date: LocalDate, years: number): LocalDate {
  return addMonths(date, years * MONTHS_PER_YEAR)
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(toEpochDay(date) * MS_PER_DAY + days * MS_PER_DAY)
  return toLocalDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) as LocalDate
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return toEpochDay(to) - toEpochDay(from)
}

/** ISO dates compare correctly as strings; negative, zero or positive like Array.sort. */
export function compareDates(a: LocalDate, b: LocalDate): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

export function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return compareDates(a, b) >= 0 ? a : b
}

function fromParts(year: number, month: number, day: number, source: DateSource): DateParseResult {
  const date = toLocalDate(year, month, day)
  return date === null ? { ok: false, reason: 'invalid-day' } : { ok: true, date, source }
}

function parts(date: LocalDate): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number)
  return { year: year ?? 0, month: month ?? 1, day: day ?? 1 }
}

function toEpochDay(date: LocalDate): number {
  const { year, month, day } = parts(date)
  return Date.UTC(year, month - 1, day) / MS_PER_DAY
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}
