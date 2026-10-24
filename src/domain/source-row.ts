/** One parsed CSV record as the domain sees it: column name → raw text. */
export interface SourceRow {
  /** 1-based record number in the file (header = 1). */
  readonly row: number
  readonly values: Readonly<Record<string, string>>
}

/** Trimmed value of a column; missing columns read as empty. */
export function field(source: SourceRow, column: string): string {
  return (source.values[column] ?? '').trim()
}
