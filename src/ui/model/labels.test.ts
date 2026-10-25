import { describe, expect, it } from 'vitest'
import { describeFileProblem } from './labels.ts'

describe('describeFileProblem', () => {
  it('names the missing or duplicated table in Czech', () => {
    expect(describeFileProblem({ kind: 'missing-table', source: 'sessions' })).toBe(
      'Chybí soubor s tabulkou „Termíny školení“.',
    )
    expect(describeFileProblem({ kind: 'duplicate-table', source: 'catalog', fileNames: ['a.csv', 'b.csv'] })).toBe(
      'Tabulka „Katalog školení“ je nahraná vícekrát (a.csv, b.csv).',
    )
  })

  it('explains an unrecognised file with the closest table', () => {
    expect(
      describeFileProblem({ kind: 'unrecognized', fileName: 'x.csv', bestGuess: 'catalog', missingColumns: ['kod'] }),
    ).toBe('Soubor x.csv nebyl rozpoznán – nejvíc se podobá tabulce „Katalog školení“, chybí sloupce: kod.')
    expect(describeFileProblem({ kind: 'unrecognized', fileName: 'x.csv', bestGuess: null, missingColumns: [] })).toBe(
      'Soubor x.csv nebyl rozpoznán – neodpovídá žádné ze čtyř tabulek.',
    )
  })
})
