import type { DomainConfig, LocalDate } from '../domain/config.ts'
import { summarizeIssues, type DataQualityIssue, type DataSource, type IssueSummary } from '../domain/data-quality.ts'
import type { SourceRow } from '../domain/source-row.ts'
import type { SourceEncoding } from '../infrastructure/csv/decode.ts'
import type { Delimiter } from '../infrastructure/csv/parse.ts'
import { readCsvFile } from '../infrastructure/csv/read-csv-file.ts'
import { buildTrainingOverview, type TrainingOverview } from '../use-cases/build-training-overview.ts'
import { loadDataset, type Dataset, type RawTables } from '../use-cases/load-dataset.ts'
import { recommendEnrolments, type EnrolmentPlan } from '../use-cases/recommend-enrolments.ts'

/** Composition root: wires CSV reading (infrastructure) to the use-cases. No React, no I/O. */

export const DATA_SOURCES: readonly DataSource[] = ['employees', 'completions', 'catalog', 'sessions']

export interface InputFile {
  readonly name: string
  readonly bytes: Uint8Array
}

export interface RecognisedFile {
  readonly name: string
  readonly source: DataSource
  readonly encoding: SourceEncoding
  readonly delimiter: Delimiter
  readonly rowCount: number
}

export type FileProblem =
  | {
      readonly kind: 'unrecognized'
      readonly fileName: string
      readonly bestGuess: DataSource | null
      readonly missingColumns: readonly string[]
    }
  | { readonly kind: 'duplicate-table'; readonly source: DataSource; readonly fileNames: readonly string[] }
  | { readonly kind: 'missing-table'; readonly source: DataSource }

export type FilesReadResult =
  | {
      readonly ok: true
      readonly files: readonly RecognisedFile[]
      readonly tables: RawTables
      readonly structuralIssues: readonly DataQualityIssue[]
    }
  | { readonly ok: false; readonly files: readonly RecognisedFile[]; readonly problems: readonly FileProblem[] }

/** Recognises each file by its header; exactly one file per table is required. */
export function readFiles(files: readonly InputFile[]): FilesReadResult {
  const recognised: RecognisedFile[] = []
  const problems: FileProblem[] = []
  const rows = new Map<DataSource, readonly SourceRow[]>()
  const namesBySource = new Map<DataSource, string[]>()
  const structuralIssues: DataQualityIssue[] = []

  for (const file of files) {
    const result = readCsvFile(file.bytes)
    if (!result.ok) {
      problems.push({
        kind: 'unrecognized',
        fileName: file.name,
        bestGuess: result.bestGuess,
        missingColumns: result.missingColumns,
      })
      continue
    }
    recognised.push({
      name: file.name,
      source: result.source,
      encoding: result.encoding,
      delimiter: result.delimiter,
      rowCount: result.rows.length,
    })
    namesBySource.set(result.source, [...(namesBySource.get(result.source) ?? []), file.name])
    rows.set(result.source, result.rows)
    structuralIssues.push(...result.issues)
  }

  for (const source of DATA_SOURCES) {
    const names = namesBySource.get(source) ?? []
    if (names.length === 0) problems.push({ kind: 'missing-table', source })
    if (names.length > 1) problems.push({ kind: 'duplicate-table', source, fileNames: names })
  }

  if (problems.length > 0) return { ok: false, files: recognised, problems }
  return {
    ok: true,
    files: recognised,
    tables: {
      employees: rows.get('employees') ?? [],
      completions: rows.get('completions') ?? [],
      catalog: rows.get('catalog') ?? [],
      sessions: rows.get('sessions') ?? [],
    },
    structuralIssues,
  }
}

export interface PreparedData {
  readonly dataset: Dataset
  readonly issueSummary: readonly IssueSummary[]
}

/** Validates and normalises the tables once per upload; data-quality findings as aggregates. */
export function prepareData(
  tables: RawTables,
  structuralIssues: readonly DataQualityIssue[],
  config: DomainConfig,
): PreparedData {
  const loaded = loadDataset(tables, config)
  return { dataset: loaded.dataset, issueSummary: summarizeIssues([...structuralIssues, ...loaded.issues]) }
}

export interface EvaluationOptions {
  readonly today: LocalDate
  readonly expiringSoonDays: number
}

export interface Evaluation {
  readonly overview: TrainingOverview
  readonly plan: EnrolmentPlan
}

/** Overview and enrolment plan; cheap, re-run whenever the "expiring soon" window changes. */
export function evaluate(dataset: Dataset, options: EvaluationOptions): Evaluation {
  const overview = buildTrainingOverview(dataset, options)
  const plan = recommendEnrolments(dataset, overview, { today: options.today })
  return { overview, plan }
}
