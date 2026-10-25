import { describe, expect, it } from 'vitest'
import { IssueCollector, summarizeIssues } from './data-quality.ts'

describe('summarizeIssues', () => {
  it('counts issues per source, kind and severity', () => {
    const completions = new IssueCollector('completions')
    completions.add(2, 'duplicate-completion', 'dropped')
    completions.add(3, 'duplicate-completion', 'dropped')
    completions.add(4, 'invalid-date', 'dropped', 'datum_absolvovani')
    const employees = new IssueCollector('employees')
    employees.add(5, 'missing-department', 'flagged', 'utvar')

    expect(summarizeIssues([...completions.issues, ...employees.issues])).toEqual([
      { source: 'employees', kind: 'missing-department', severity: 'flagged', count: 1 },
      { source: 'completions', kind: 'duplicate-completion', severity: 'dropped', count: 2 },
      { source: 'completions', kind: 'invalid-date', severity: 'dropped', count: 1 },
    ])
  })

  it('omits the field when not given', () => {
    const collector = new IssueCollector('catalog')
    collector.add(null, 'repeated-header', 'dropped')
    expect(collector.issues[0]).toEqual({ source: 'catalog', row: null, kind: 'repeated-header', severity: 'dropped' })
  })
})
