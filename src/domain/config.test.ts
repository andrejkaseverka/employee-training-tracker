import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from './config.ts'

describe('DEFAULT_CONFIG', () => {
  it('uses the export date as reference "today"', () => {
    expect(DEFAULT_CONFIG.referenceDate).toBe('2026-10-01')
  })

  it('uses agreed thresholds', () => {
    expect(DEFAULT_CONFIG.expiringSoonDays).toBe(60)
    expect(DEFAULT_CONFIG.maxRecordAgeYears).toBe(50)
  })
})
