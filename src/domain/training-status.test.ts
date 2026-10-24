import { describe, expect, it } from 'vitest'
import type { LocalDate } from './config.ts'
import type { Completion, ValiditySource } from './completion.ts'
import { evaluateStatus, pickEffectiveCompletion } from './training-status.ts'

const TODAY = '2026-10-01' as LocalDate
const WINDOW = 60

const completion = (
  completedOn: string,
  validUntil: string | null,
  validitySource: ValiditySource = 'record',
): Completion => ({
  row: 2,
  recordId: 'R1',
  employeeId: 'T001',
  code: 'KYBER',
  completedOn: completedOn as LocalDate,
  validUntil: validUntil as LocalDate | null,
  validitySource,
})

const status = (validUntil: string | null, source: ValiditySource = 'record') =>
  evaluateStatus(completion('2025-01-01', validUntil, source), TODAY, WINDOW)

describe('evaluateStatus', () => {
  it('is missing without a completion', () => {
    expect(evaluateStatus(null, TODAY, WINDOW)).toEqual({ status: 'missing', completion: null, daysLeft: null })
  })

  it('is expired from the day after the last valid day', () => {
    expect(status('2026-09-30')).toMatchObject({ status: 'expired', daysLeft: -1 })
  })

  it('is still valid (expiring) on its last valid day', () => {
    expect(status('2026-10-01')).toMatchObject({ status: 'expiring', daysLeft: 0 })
  })

  it('is expiring up to and including the window', () => {
    expect(status('2026-11-30')).toMatchObject({ status: 'expiring', daysLeft: 60 })
    expect(status('2026-12-01')).toMatchObject({ status: 'valid', daysLeft: 61 })
  })

  it('respects a different window', () => {
    expect(evaluateStatus(completion('2025-01-01', '2026-11-30'), TODAY, 30).status).toBe('valid')
  })

  it('treats trainings without expiry as valid', () => {
    expect(status(null, 'none')).toEqual(expect.objectContaining({ status: 'valid', daysLeft: null }))
  })

  it('is undetermined when validity is unknown', () => {
    expect(status(null, 'unknown').status).toBe('undetermined')
  })
})

describe('pickEffectiveCompletion', () => {
  it('returns null for no completions', () => {
    expect(pickEffectiveCompletion([])).toBeNull()
  })

  it('takes the newest completion even if an older one had a later validity', () => {
    const older = completion('2024-01-01', '2027-12-31')
    const newer = completion('2026-01-01', '2027-01-01')
    expect(pickEffectiveCompletion([older, newer])).toBe(newer)
    expect(pickEffectiveCompletion([newer, older])).toBe(newer)
  })

  it('takes the longer validity on the same day', () => {
    const shorter = completion('2026-01-01', '2027-01-01')
    const longer = completion('2026-01-01', '2028-01-01')
    expect(pickEffectiveCompletion([shorter, longer])).toBe(longer)
  })
})
