import { describe, expect, it } from 'vitest'
import { evaluate, prepareData } from '../src/app/run-analysis.ts'
import { DEFAULT_CONFIG } from '../src/domain/config.ts'
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
    expect(items).toHaveLength(expired + missing + expiring + undetermined + 1)
  })

  it('orders by urgency: expired, missing, expiring, then undecidable requirements', () => {
    const statuses = items.map((item) => item.status)
    expect(statuses).toEqual([...statuses].sort((a, b) => rank(a) - rank(b)))
    expect(statuses.at(-1)).toBeNull()
    const expiredDays = items.filter((item) => item.status === 'expired').map((item) => item.daysLeft ?? 0)
    expect(expiredDays).toEqual([...expiredDays].sort((a, b) => a - b))
  })

  it('joins each item with its recommended session or the reason why not', () => {
    expect(resolutionOf('D001', 'KYBER')).toMatchObject({ kind: 'assigned', sessionId: 'T01' })
    expect(resolutionOf('D004', 'BOZP-Z')).toEqual({ kind: 'unassigned', reason: 'parental-leave' })
    expect(resolutionOf('D001', 'PRV-POM')).toEqual({ kind: 'unassigned', reason: 'capacity-exhausted' })
    expect(resolutionOf('D004', 'PRV-POM')).toEqual({ kind: 'check-data' })
  })
})

const RANK: Readonly<Record<string, number>> = { expired: 0, missing: 1, undetermined: 2, expiring: 3, valid: 4 }
function rank(status: string | null): number {
  return status === null ? Object.keys(RANK).length : (RANK[status] ?? 0)
}

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
