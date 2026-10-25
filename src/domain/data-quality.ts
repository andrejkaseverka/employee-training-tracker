/**
 * Data-quality findings. Issues carry only the source table, row number, kind and
 * field name – never a record's values – so they are safe to show or log as aggregates.
 */

export type DataSource = 'employees' | 'completions' | 'catalog' | 'sessions'

/** `dropped` = the record is not used; `flagged` = used, but the user should know. */
export type IssueSeverity = 'dropped' | 'flagged'

export type IssueKind =
  // file structure
  | 'repeated-header'
  | 'column-count-mismatch'
  // values
  | 'missing-value'
  | 'invalid-date'
  | 'excel-serial-date'
  | 'invalid-number'
  // employees
  | 'duplicate-employee-id'
  | 'unknown-status'
  | 'missing-department'
  | 'unknown-manager'
  // catalog
  | 'duplicate-training-code'
  | 'unknown-requirement-rule'
  | 'unparseable-validity'
  | 'textual-validity'
  // completions
  | 'unknown-training-code'
  | 'orphan-employee-reference'
  | 'implausible-date'
  | 'future-completion'
  | 'valid-until-before-completion'
  | 'valid-until-computed'
  | 'validity-differs-from-catalog'
  | 'duplicate-record-id'
  | 'duplicate-completion'
  | 'completed-after-termination'
  // sessions
  | 'overbooked-session'
  | 'duplicate-session'
  | 'duplicate-session-id'
  | 'invalid-time'

export interface DataQualityIssue {
  readonly source: DataSource
  /** 1-based record number in the file (header = 1), or null for file-level issues. */
  readonly row: number | null
  readonly kind: IssueKind
  readonly severity: IssueSeverity
  readonly field?: string
}

export interface IssueSummary {
  readonly source: DataSource
  readonly kind: IssueKind
  readonly severity: IssueSeverity
  readonly count: number
}

/** Aggregates issues by source, kind and severity (stable order: by source, then by count desc). */
export function summarizeIssues(issues: readonly DataQualityIssue[]): IssueSummary[] {
  const counts = new Map<string, IssueSummary>()
  for (const issue of issues) {
    const key = `${issue.source}|${issue.kind}|${issue.severity}`
    const current = counts.get(key)
    counts.set(key, {
      source: issue.source,
      kind: issue.kind,
      severity: issue.severity,
      count: (current?.count ?? 0) + 1,
    })
  }
  const sourceOrder: readonly DataSource[] = ['employees', 'completions', 'catalog', 'sessions']
  return [...counts.values()].sort(
    (a, b) => sourceOrder.indexOf(a.source) - sourceOrder.indexOf(b.source) || b.count - a.count,
  )
}

/** Small helper so mappers can collect issues with less noise. */
export class IssueCollector {
  readonly #issues: DataQualityIssue[] = []
  readonly #source: DataSource

  constructor(source: DataSource) {
    this.#source = source
  }

  add(row: number | null, kind: IssueKind, severity: IssueSeverity, field?: string): void {
    this.#issues.push(
      field === undefined
        ? { source: this.#source, row, kind, severity }
        : { source: this.#source, row, kind, severity, field },
    )
  }

  get issues(): readonly DataQualityIssue[] {
    return this.#issues
  }
}
