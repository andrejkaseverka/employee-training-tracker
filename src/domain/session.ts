import type { Catalog } from './catalog.ts'
import type { LocalDate } from './config.ts'
import { IssueCollector, type DataQualityIssue } from './data-quality.ts'
import { parseLocalDate } from './date.ts'
import { comparisonKey, normalizeCode } from './normalize.ts'
import { field, type SourceRow } from './source-row.ts'

/** A scheduled training session. Problems are kept on the session; offering is decided later (phase 3). */
export interface Session {
  readonly row: number
  readonly id: string
  readonly code: string
  readonly codeKnown: boolean
  readonly date: LocalDate | null
  /** `HH:MM`, or null when the time range is unreadable. */
  readonly startTime: string | null
  readonly endTime: string | null
  readonly place: string
  readonly capacity: number | null
  readonly booked: number | null
  /** max(0, capacity − booked); 0 when either number is unknown (never offer seats we cannot vouch for). */
  readonly freeSeats: number
  readonly cancelled: boolean
  /** Id of an earlier session with the same training, date, time and place, or with the same id. */
  readonly duplicateOf: string | null
}

const TIME_RANGE = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/
const HOURS_PER_DAY = 24
const MINUTES_PER_HOUR = 60
const CANCELLED_KEY = 'zruseno'
const PLANNED_KEY = 'planovano'

export interface SessionMappingResult {
  readonly sessions: readonly Session[]
  readonly issues: readonly DataQualityIssue[]
}

export function mapSessions(rows: readonly SourceRow[], catalog: Catalog): SessionMappingResult {
  const issues = new IssueCollector('sessions')
  const sessions: Session[] = []
  const firstByIdentity = new Map<string, string>()
  const seenIds = new Set<string>()

  for (const source of rows) {
    const id = field(source, 'id_terminu')
    if (id === '') {
      issues.add(source.row, 'missing-value', 'dropped', 'id_terminu')
      continue
    }
    const code = normalizeCode(field(source, 'kod_skoleni'))
    const codeKnown = catalog.has(code)
    if (!codeKnown) issues.add(source.row, 'unknown-training-code', 'flagged', 'kod_skoleni')

    const parsedDate = parseLocalDate(field(source, 'datum'))
    if (!parsedDate.ok) issues.add(source.row, 'invalid-date', 'flagged', 'datum')
    const date = parsedDate.ok ? parsedDate.date : null

    const time = parseTimeRange(field(source, 'cas'))
    if (time === null) issues.add(source.row, 'invalid-time', 'flagged', 'cas')

    const capacity = parseCount(field(source, 'kapacita'))
    if (capacity === null) issues.add(source.row, 'invalid-number', 'flagged', 'kapacita')
    const booked = parseCount(field(source, 'obsazeno'))
    if (booked === null) issues.add(source.row, 'invalid-number', 'flagged', 'obsazeno')
    if (capacity !== null && booked !== null && booked > capacity) {
      issues.add(source.row, 'overbooked-session', 'flagged', 'obsazeno')
    }

    const statusKey = comparisonKey(field(source, 'stav'))
    if (statusKey !== CANCELLED_KEY && statusKey !== PLANNED_KEY) {
      issues.add(source.row, 'unknown-status', 'flagged', 'stav')
    }

    const place = field(source, 'misto')
    const timeKey = time === null ? field(source, 'cas') : `${time.start}-${time.end}`
    const identity = [code, date ?? field(source, 'datum'), timeKey, comparisonKey(place)].join('|')
    // A repeated id would merge seat counts downstream, so the later row is never offered.
    const sameContent = firstByIdentity.get(identity) ?? null
    const sameId = seenIds.has(id) ? id : null
    const duplicateOf = sameContent ?? sameId
    if (sameContent === null) firstByIdentity.set(identity, id)
    seenIds.add(id)
    if (sameContent !== null) issues.add(source.row, 'duplicate-session', 'flagged', 'id_terminu')
    else if (sameId !== null) issues.add(source.row, 'duplicate-session-id', 'flagged', 'id_terminu')

    sessions.push({
      row: source.row,
      id,
      code,
      codeKnown,
      date,
      startTime: time?.start ?? null,
      endTime: time?.end ?? null,
      place,
      capacity,
      booked,
      freeSeats: capacity === null || booked === null ? 0 : Math.max(0, capacity - booked),
      // Unknown status is treated as cancelled: do not offer what may not take place.
      cancelled: statusKey !== PLANNED_KEY,
      duplicateOf,
    })
  }
  return { sessions, issues: issues.issues }
}

/** `9:00-12:00` → { start: '09:00', end: '12:00' }; null when invalid or end is not after start. */
export function parseTimeRange(raw: string): { start: string; end: string } | null {
  const match = TIME_RANGE.exec(raw.trim())
  if (!match) return null
  const [startHour, startMinute, endHour, endMinute] = match.slice(1).map(Number)
  if (startHour === undefined || startMinute === undefined || endHour === undefined || endMinute === undefined) {
    return null
  }
  const valid = (hour: number, minute: number): boolean =>
    hour < HOURS_PER_DAY && minute < MINUTES_PER_HOUR
  if (!valid(startHour, startMinute) || !valid(endHour, endMinute)) return null
  if (endHour * MINUTES_PER_HOUR + endMinute <= startHour * MINUTES_PER_HOUR + startMinute) return null
  const format = (hour: number, minute: number): string =>
    `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  return { start: format(startHour, startMinute), end: format(endHour, endMinute) }
}

/** Non-negative whole number, or null. */
function parseCount(raw: string): number | null {
  return /^\d+$/.test(raw) ? Number(raw) : null
}
