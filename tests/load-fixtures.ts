import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { readFiles, type FilesReadResult } from '../src/app/run-analysis.ts'

// Synthetic fixtures reproducing the export quirks: Windows-1250 + CRLF + multi-line field +
// repeated header (completions), UTF-8 with BOM (employees, sessions), plain UTF-8 (catalog).
export const FIXTURES: readonly string[] = ['absolvovana_skoleni.csv', 'zamestnanci.csv', 'katalog_skoleni.csv', 'terminy_skoleni.csv']

export type ReadFixtures = Extract<FilesReadResult, { ok: true }>

export function readFixtures(): ReadFixtures {
  const read = readFiles(
    FIXTURES.map((name) => ({
      name,
      bytes: new Uint8Array(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)))),
    })),
  )
  if (!read.ok) throw new Error('Fixtures not recognised')
  return read
}
