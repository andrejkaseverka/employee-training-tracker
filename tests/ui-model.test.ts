import { describe, expect, it } from 'vitest'
import { evaluate, prepareData } from '../src/app/run-analysis.ts'
import { DEFAULT_CONFIG } from '../src/domain/config.ts'
import type { NeedStatus } from '../src/domain/enrolment.ts'
import { buildAttentionList } from '../src/ui/model/attention.ts'
import {
  ANY,
  departmentOptions,
  EMPTY_PERSON_FILTER,
  EMPTY_TRAINING_FILTER,
  filterEmployees,
  NO_DEPARTMENT,
} from '../src/ui/model/filters.ts'
import { readFixtures } from './load-fixtures.ts'

const read = readFixtures()
const { dataset } = prepareData(read.tables, read.structuralIssues, DEFAULT_CONFIG)
const { overview, plan } = evaluate(dataset, {
  today: DEFAULT_CONFIG.referenceDate,
  expiringSoonDays: DEFAULT_CONFIG.expiringSoonDays,
})

describe('attention list', () => {
  const items = buildAttentionList(overview, plan, dataset.catalog)
  const resolutionOf = (employeeId: string, code: string): unknown =>
    items.find((item) => item.person.employee.id === employeeId && item.code === code)?.resolution

  it('lists every training that is not valid plus requirements that cannot be decided', () => {
    const { expired, missing, expiring, undetermined } = overview.statusCounts
    const undecidable = overview.employees.flatMap((entry) => entry.undeterminedRequirements).length
    expect(undecidable).toBeGreaterThan(0)
    expect(items).toHaveLength(expired + missing + expiring + undetermined + undecidable)
  })

  it('orders like the enrolment priority: missing, expired, expiring, undetermined, then undecidable requirements', () => {
    const groups = items.map((item) => item.status).filter((status, index, all) => index === 0 || all[index - 1] !== status)
    expect(groups).toEqual(URGENCY_ORDER.filter((status) => groups.includes(status)))
    expect(groups).toEqual(expect.arrayContaining(['missing', 'expired', 'expiring', null]))
    for (const status of ['expired', 'expiring'] as const) {
      const daysLeft = items.filter((item) => item.status === status).map((item) => item.daysLeft ?? 0)
      expect(daysLeft).toEqual([...daysLeft].sort((a, b) => a - b))
    }
  })

  it('gives every training with a known status a recommendation from the plan', () => {
    for (const item of items.filter((entry) => entry.status !== null)) {
      expect(['assigned', 'unassigned']).toContain(item.resolution.kind)
    }
  })

  it('joins each item with its recommended session or the reason why not', () => {
    expect(resolutionOf('D001', 'KYBER')).toMatchObject({ kind: 'assigned', sessionId: 'T01' })
    expect(resolutionOf('D004', 'BOZP-Z')).toEqual({ kind: 'unassigned', reason: 'parental-leave' })
    expect(resolutionOf('D001', 'PRV-POM')).toEqual({ kind: 'unassigned', reason: 'capacity-exhausted' })
    expect(resolutionOf('D004', 'PRV-POM')).toEqual({ kind: 'check-data' })
  })
})

// Assumption #18, written out on purpose instead of imported, so the test does not mirror the code.
const URGENCY_ORDER: readonly (NeedStatus | null)[] = ['missing', 'expired', 'expiring', 'undetermined', null]

describe('employee filters', () => {
  const ids = (person = EMPTY_PERSON_FILTER, training = EMPTY_TRAINING_FILTER): string[] =>
    filterEmployees(overview.employees, person, training).map((entry) => entry.employee.id)

  it('finds people by name without diacritics, in either order', () => {
    expect(ids({ department: ANY, search: 'testova' })).toEqual(['D001'])
    expect(ids({ department: ANY, search: 'Testová Alena' })).toEqual(['D001'])
    expect(ids({ department: ANY, search: 'alena testova' })).toEqual(['D001'])
  })

  it('filters by canonical department, including people without one', () => {
    expect(ids({ department: 'Laboratoře', search: '' }).sort()).toEqual(['D001', 'D002'])
    expect(ids({ department: NO_DEPARTMENT, search: '' })).toEqual(['D004'])
    expect(departmentOptions(overview.employees).at(-1)).toBe(NO_DEPARTMENT)
  })

  it('keeps people with at least one training matching both status and code', () => {
    expect(ids(EMPTY_PERSON_FILTER, { status: 'expired', code: 'KYBER' }).sort()).toEqual(['D002', 'D003'])
    expect(ids(EMPTY_PERSON_FILTER, { status: 'expiring', code: ANY })).toEqual(['D001'])
  })
})
