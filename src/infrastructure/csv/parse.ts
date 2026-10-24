import Papa from 'papaparse'
import type { SourceRow } from '../../domain/source-row.ts'

export type Delimiter = ',' | ';'

export interface ParsedCsv {
  readonly headers: readonly string[]
  readonly delimiter: Delimiter
  readonly rows: readonly SourceRow[]
  /** Record numbers of header lines repeated inside the data. */
  readonly repeatedHeaderRows: readonly number[]
  /** Record numbers whose field count does not match the header, or that the parser flagged. */
  readonly malformedRows: readonly number[]
}

/** Picks `;` or `,` by counting them in the header line. */
export function detectDelimiter(text: string): Delimiter {
  const headerLine = text.split(/\r?\n/, 1)[0] ?? ''
  const count = (char: string): number => headerLine.split(char).length - 1
  return count(';') > count(',') ? ';' : ','
}

/**
 * Parses CSV text (quoted fields may contain delimiters, quotes and line breaks).
 * Only text is passed to PapaParse – no download or worker mode.
 */
export function parseCsvText(text: string): ParsedCsv {
  const delimiter = detectDelimiter(text)
  const result = Papa.parse<string[]>(text, { delimiter, header: false, skipEmptyLines: false, quoteChar: '"' })
  const [headerCells = [], ...dataRows] = result.data
  const headers = headerCells.map(normalizeHeader)

  const parserErrorRows = new Set<number>()
  for (const error of result.errors) {
    if (error.row !== undefined) parserErrorRows.add(error.row + 1)
  }

  const rows: SourceRow[] = []
  const repeatedHeaderRows: number[] = []
  const malformedRows: number[] = []

  dataRows.forEach((cells, index) => {
    // Record number in the file: header is 1, first data record is 2.
    const rowNumber = index + 2
    if (cells.every((cell) => cell.trim() === '')) return
    if (cells.length === headers.length && cells.every((cell, i) => normalizeHeader(cell) === headers[i])) {
      repeatedHeaderRows.push(rowNumber)
      return
    }
    if (cells.length !== headers.length || parserErrorRows.has(rowNumber)) {
      malformedRows.push(rowNumber)
      return
    }
    const values: Record<string, string> = {}
    headers.forEach((header, i) => {
      values[header] = cells[i] ?? ''
    })
    rows.push({ row: rowNumber, values })
  })

  return { headers, delimiter, rows, repeatedHeaderRows, malformedRows }
}

function normalizeHeader(cell: string): string {
  return cell.replace(/^﻿/, '').trim().toLowerCase()
}
