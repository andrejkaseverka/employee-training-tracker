import { IssueCollector, type DataQualityIssue, type DataSource } from '../../domain/data-quality.ts'
import type { SourceRow } from '../../domain/source-row.ts'
import { decodeCsvBytes, type SourceEncoding } from './decode.ts'
import { identifyTable } from './identify-table.ts'
import { parseCsvText, type Delimiter } from './parse.ts'

export type CsvFileResult =
  | {
      readonly ok: true
      readonly source: DataSource
      readonly encoding: SourceEncoding
      readonly delimiter: Delimiter
      readonly rows: readonly SourceRow[]
      readonly issues: readonly DataQualityIssue[]
    }
  | {
      readonly ok: false
      readonly error: 'unrecognized-table'
      readonly bestGuess: DataSource | null
      readonly missingColumns: readonly string[]
    }

/** Bytes of one uploaded file → recognised table with rows and structural issues. */
export function readCsvFile(bytes: Uint8Array): CsvFileResult {
  const { text, encoding } = decodeCsvBytes(bytes)
  const parsed = parseCsvText(text)
  const identification = identifyTable(parsed.headers)
  if (!identification.ok) {
    return {
      ok: false,
      error: 'unrecognized-table',
      bestGuess: identification.bestGuess,
      missingColumns: identification.missingColumns,
    }
  }

  const issues = new IssueCollector(identification.source)
  for (const row of parsed.repeatedHeaderRows) issues.add(row, 'repeated-header', 'dropped')
  for (const row of parsed.malformedRows) issues.add(row, 'column-count-mismatch', 'dropped')

  return {
    ok: true,
    source: identification.source,
    encoding,
    delimiter: parsed.delimiter,
    rows: parsed.rows,
    issues: issues.issues,
  }
}
