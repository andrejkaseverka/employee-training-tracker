import { describe, expect, it } from 'vitest'
import type { DataSource } from '../domain/data-quality.ts'
import { REQUIRED_COLUMNS } from '../infrastructure/csv/identify-table.ts'
import { readFiles, type InputFile } from './run-analysis.ts'

const headerOnly = (source: DataSource, name = `${source}.csv`): InputFile => ({
  name,
  bytes: new TextEncoder().encode(`${REQUIRED_COLUMNS[source].join(';')}\r\n`),
})

const ALL: readonly InputFile[] = [
  headerOnly('employees'),
  headerOnly('completions'),
  headerOnly('catalog'),
  headerOnly('sessions'),
]

describe('readFiles', () => {
  it('recognises one file per table regardless of file name and order', () => {
    const result = readFiles([...ALL].reverse().map((file, index) => ({ ...file, name: `soubor-${index}.csv` })))
    expect(result.ok).toBe(true)
    expect(result.files.map((file) => file.source).sort()).toEqual(['catalog', 'completions', 'employees', 'sessions'])
  })

  it('names the missing table', () => {
    const result = readFiles(ALL.slice(0, 3))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.problems).toEqual([{ kind: 'missing-table', source: 'sessions' }])
  })

  it('rejects the same table uploaded twice', () => {
    const result = readFiles([...ALL, headerOnly('catalog', 'kopie.csv')])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.problems).toEqual([
        { kind: 'duplicate-table', source: 'catalog', fileNames: ['catalog.csv', 'kopie.csv'] },
      ])
    }
  })

  it('reports an unrecognised file with the closest table and missing columns', () => {
    const partial: InputFile = { name: 'jine.csv', bytes: new TextEncoder().encode('kod;nazev\r\n') }
    const result = readFiles([...ALL, partial])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.problems).toEqual([
        { kind: 'unrecognized', fileName: 'jine.csv', bestGuess: 'catalog', missingColumns: ['platnost_mesicu', 'povinne_pro'] },
      ])
    }
  })
})
