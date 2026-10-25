/**
 * Named domain configuration. Every threshold used by the domain lives here
 * so that it can be reviewed and changed in one place.
 */

/** ISO calendar date `YYYY-MM-DD` without time or time zone. */
export type LocalDate = string & { readonly __brand: 'LocalDate' }

export interface DomainConfig {
  /** "Today" for all computations – the export date, never the system clock. */
  readonly referenceDate: LocalDate
  /** A valid training expiring within this many days is "expiring soon". */
  readonly expiringSoonDays: number
  /** Completion dates older than this many years are treated as implausible (placeholders such as 1900). */
  readonly maxRecordAgeYears: number
}

/** Date of the data export (assignment). */
export const REFERENCE_DATE = '2026-10-01' as LocalDate

/** Shortest catalogue validity is 12 months; 60 days leaves time to book one of the sessions held every 2–4 weeks. */
export const EXPIRING_SOON_DAYS = 60

/** Roughly one working life; anything older is a placeholder, not a real completion. */
export const MAX_RECORD_AGE_YEARS = 50

/** Day 0 of Excel's serial date system (accounts for the 1900 leap-year bug). */
export const EXCEL_EPOCH = '1899-12-30' as LocalDate

/** Excel serial dates in the exports are plain 5-digit numbers. */
export const EXCEL_SERIAL_DIGITS = 5

export const DEFAULT_CONFIG: DomainConfig = {
  referenceDate: REFERENCE_DATE,
  expiringSoonDays: EXPIRING_SOON_DAYS,
  maxRecordAgeYears: MAX_RECORD_AGE_YEARS,
}
