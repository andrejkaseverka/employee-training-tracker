import type { DataSource } from '../../domain/data-quality.ts'

/** Columns each table must have; files are recognised by their header, not their name. */
export const REQUIRED_COLUMNS: Readonly<Record<DataSource, readonly string[]>> = {
  employees: ['id_zamestnance', 'jmeno', 'prijmeni', 'utvar', 'pozice', 'datum_nastupu', 'datum_ukonceni', 'stav'],
  completions: ['id_zaznamu', 'id_zamestnance', 'kod_skoleni', 'datum_absolvovani', 'platnost_do'],
  catalog: ['kod', 'nazev', 'platnost_mesicu', 'povinne_pro'],
  sessions: ['id_terminu', 'kod_skoleni', 'datum', 'cas', 'kapacita', 'obsazeno', 'stav'],
}

export type TableIdentification =
  | { readonly ok: true; readonly source: DataSource }
  | { readonly ok: false; readonly bestGuess: DataSource | null; readonly missingColumns: readonly string[] }

export function identifyTable(headers: readonly string[]): TableIdentification {
  const present = new Set(headers)
  const candidates = (Object.keys(REQUIRED_COLUMNS) as DataSource[]).map((source) => {
    const required = REQUIRED_COLUMNS[source]
    const missing = required.filter((column) => !present.has(column))
    return { source, missing, matched: required.length - missing.length }
  })

  const complete = candidates
    .filter((candidate) => candidate.missing.length === 0)
    .sort((a, b) => b.matched - a.matched)[0]
  if (complete) return { ok: true, source: complete.source }

  const best = [...candidates].sort((a, b) => b.matched - a.matched)[0]
  if (!best || best.matched === 0) return { ok: false, bestGuess: null, missingColumns: [] }
  return { ok: false, bestGuess: best.source, missingColumns: best.missing }
}
