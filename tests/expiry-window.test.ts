import { describe, expect, it } from 'vitest'
import { evaluate, prepareData } from '../src/app/run-analysis.ts'
import { DEFAULT_CONFIG } from '../src/domain/config.ts'
import { EXPIRY_WINDOW_OPTIONS } from '../src/ui/config.ts'
import { readFixtures } from './load-fixtures.ts'

const read = readFixtures()
const { dataset } = prepareData(read.tables, read.structuralIssues, DEFAULT_CONFIG)
const runs = EXPIRY_WINDOW_OPTIONS.map((expiringSoonDays) => ({
  expiringSoonDays,
  ...evaluate(dataset, { today: DEFAULT_CONFIG.referenceDate, expiringSoonDays }),
}))

describe('"expiring soon" window offered in the UI', () => {
  it('only moves trainings between valid and expiring', () => {
    const [first, ...rest] = runs.map((run) => run.overview.statusCounts)
    for (const counts of rest) {
      expect(counts.expired).toBe(first?.expired)
      expect(counts.missing).toBe(first?.missing)
      expect(counts.valid + counts.expiring).toBe((first?.valid ?? 0) + (first?.expiring ?? 0))
    }
  })

  it('counts more expiring trainings and enrolment needs as the window grows', () => {
    const expiring = runs.map((run) => run.overview.statusCounts.expiring)
    expect(expiring).toEqual([...expiring].sort((a, b) => a - b))
    expect(expiring.at(-1)).toBeGreaterThan(expiring[0] ?? 0)

    const needs = runs.map((run) => run.plan.assignments.length + run.plan.unassigned.length)
    expect(needs).toEqual([...needs].sort((a, b) => a - b))
  })
})
