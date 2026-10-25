import { mapCatalog, type Catalog } from '../domain/catalog.ts'
import { mapCompletions, type Completion } from '../domain/completion.ts'
import type { DomainConfig } from '../domain/config.ts'
import type { DataQualityIssue } from '../domain/data-quality.ts'
import { mapEmployees, type Employee } from '../domain/employee.ts'
import { mapSessions, type Session } from '../domain/session.ts'
import type { SourceRow } from '../domain/source-row.ts'

/** Parsed rows of the four exports, already recognised by table. */
export interface RawTables {
  readonly employees: readonly SourceRow[]
  readonly completions: readonly SourceRow[]
  readonly catalog: readonly SourceRow[]
  readonly sessions: readonly SourceRow[]
}

export interface Dataset {
  readonly employees: ReadonlyMap<string, Employee>
  readonly catalog: Catalog
  readonly completions: readonly Completion[]
  readonly sessions: readonly Session[]
}

export interface LoadedDataset {
  readonly dataset: Dataset
  readonly issues: readonly DataQualityIssue[]
}

/**
 * Validates and normalises the four tables into one in-memory dataset.
 * Pure: runs again on every upload, nothing is stored.
 */
export function loadDataset(tables: RawTables, config: DomainConfig): LoadedDataset {
  const catalog = mapCatalog(tables.catalog)
  const employees = mapEmployees(tables.employees)
  const completions = mapCompletions(tables.completions, {
    catalog: catalog.catalog,
    employees: employees.employees,
    config,
  })
  const sessions = mapSessions(tables.sessions, catalog.catalog)

  return {
    dataset: {
      employees: employees.employees,
      catalog: catalog.catalog,
      completions: completions.completions,
      sessions: sessions.sessions,
    },
    issues: [...employees.issues, ...completions.issues, ...catalog.issues, ...sessions.issues],
  }
}
