import { describe, expect, it } from 'vitest'
import { decodeCsvBytes } from './decode.ts'
import { identifyTable } from './identify-table.ts'
import { detectDelimiter, parseCsvText } from './parse.ts'
import { readCsvFile } from './read-csv-file.ts'

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text)
const withBom = (text: string): Uint8Array => new Uint8Array([0xef, 0xbb, 0xbf, ...utf8(text)])
// "Příliš" in Windows-1250: ř = F8, í = ED, š = 9A (F8 is invalid in UTF-8).
const CP1250_PRILIS = new Uint8Array([0x50, 0xf8, 0xed, 0x6c, 0x69, 0x9a])

describe('decodeCsvBytes', () => {
  it('strips a UTF-8 BOM', () => {
    expect(decodeCsvBytes(withBom('kód'))).toEqual({ text: 'kód', encoding: 'utf-8', hadBom: true })
  })

  it('reads UTF-8 without BOM', () => {
    expect(decodeCsvBytes(utf8('Příliš'))).toEqual({ text: 'Příliš', encoding: 'utf-8', hadBom: false })
  })

  it('falls back to Windows-1250 when bytes are not valid UTF-8', () => {
    expect(decodeCsvBytes(CP1250_PRILIS)).toEqual({ text: 'Příliš', encoding: 'windows-1250', hadBom: false })
  })
})

describe('detectDelimiter', () => {
  it('detects semicolon and comma from the header', () => {
    expect(detectDelimiter('a;b;c\r\n1,5;2;3')).toBe(';')
    expect(detectDelimiter('a,b,c\n1;2,3,4')).toBe(',')
  })
})

describe('parseCsvText', () => {
  it('handles quoted fields with delimiters, quotes and line breaks', () => {
    const text = 'id;poznamka\r\n1;"první; řádek\r\ndruhý ""citát"""\r\n2;ok\r\n'
    const parsed = parseCsvText(text)
    expect(parsed.rows).toEqual([
      { row: 2, values: { id: '1', poznamka: 'první; řádek\r\ndruhý "citát"' } },
      { row: 3, values: { id: '2', poznamka: 'ok' } },
    ])
  })

  it('normalises headers (BOM, case, whitespace)', () => {
    expect(parseCsvText('﻿ ID ,Kod\n1,A').headers).toEqual(['id', 'kod'])
  })

  it('skips empty lines and repeated headers, reports malformed rows', () => {
    const text = 'id,kod\n1,A\n\n  ,  \nid,kod\n2\n3,C,extra\n4,D\n'
    const parsed = parseCsvText(text)
    expect(parsed.rows.map((row) => row.values['id'])).toEqual(['1', '4'])
    expect(parsed.repeatedHeaderRows).toEqual([5])
    expect(parsed.malformedRows).toEqual([6, 7])
  })
})

describe('identifyTable', () => {
  it('recognises tables by header', () => {
    expect(identifyTable(['kod', 'nazev', 'platnost_mesicu', 'povinne_pro', 'poznamka'])).toEqual({
      ok: true,
      source: 'catalog',
    })
    expect(
      identifyTable(['id_zaznamu', 'id_zamestnance', 'zamestnanec', 'kod_skoleni', 'datum_absolvovani', 'platnost_do']),
    ).toEqual({ ok: true, source: 'completions' })
  })

  it('reports missing columns of the closest table', () => {
    expect(identifyTable(['kod', 'nazev', 'povinne_pro'])).toEqual({
      ok: false,
      bestGuess: 'catalog',
      missingColumns: ['platnost_mesicu'],
    })
    expect(identifyTable(['foo'])).toEqual({ ok: false, bestGuess: null, missingColumns: [] })
  })
})

describe('readCsvFile', () => {
  it('decodes, parses and identifies a file, reporting structural issues', () => {
    const text = 'kod;nazev;platnost_mesicu;povinne_pro\r\nKYBER;Kyber;12;VSICHNI\r\nkod;nazev;platnost_mesicu;povinne_pro\r\n'
    const result = readCsvFile(withBom(text))
    expect(result).toMatchObject({ ok: true, source: 'catalog', encoding: 'utf-8', delimiter: ';' })
    if (!result.ok) throw new Error('expected success')
    expect(result.rows).toHaveLength(1)
    expect(result.issues).toEqual([{ source: 'catalog', row: 3, kind: 'repeated-header', severity: 'dropped' }])
  })

  it('rejects unknown files', () => {
    expect(readCsvFile(utf8('a,b\n1,2'))).toMatchObject({ ok: false, error: 'unrecognized-table' })
  })
})
