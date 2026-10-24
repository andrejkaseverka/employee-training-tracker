import { describe, expect, it } from 'vitest'
import { mapCatalog, parseRequirementRule, parseValidity, requirementFor, type Training } from './catalog.ts'
import { comparisonKey, departmentKey } from './normalize.ts'
import type { SourceRow } from './source-row.ts'

describe('parseValidity', () => {
  it.each([
    ['24', { kind: 'months', months: 24 }, false],
    ['2 roky', { kind: 'months', months: 24 }, true],
    ['1 rok', { kind: 'months', months: 12 }, true],
    ['5 let', { kind: 'months', months: 60 }, true],
    ['18 měsíců', { kind: 'months', months: 18 }, true],
    ['6 mesicu', { kind: 'months', months: 6 }, true],
    ['3 MĚSÍCE', { kind: 'months', months: 3 }, true],
    ['2roky', { kind: 'months', months: 24 }, true],
    ['0', { kind: 'none' }, false],
    ['', { kind: 'none' }, false],
    ['asi dva', { kind: 'unknown' }, false],
    ['2 týdny', { kind: 'unknown' }, false],
    ['-12', { kind: 'unknown' }, false],
  ])('parses %j', (raw, validity, textual) => {
    expect(parseValidity(raw)).toEqual({ validity, textual })
  })
})

describe('parseRequirementRule', () => {
  it('parses all four forms', () => {
    expect(parseRequirementRule('VSICHNI')).toEqual({ kind: 'all' })
    expect(parseRequirementRule('NEPOVINNE')).toEqual({ kind: 'optional' })
    expect(parseRequirementRule('UTVAR:Laboratoře;Správa budov')).toEqual({
      kind: 'departments',
      departmentKeys: ['laboratore', 'sprava budov'],
    })
    expect(parseRequirementRule('POZICE:Technik údržby')).toEqual({
      kind: 'positions',
      positionKeys: ['technik udrzby'],
    })
  })

  it('rejects unknown forms', () => {
    expect(parseRequirementRule('NEKDO')).toBeNull()
    expect(parseRequirementRule('ROLE:Vedoucí')).toBeNull()
    expect(parseRequirementRule('UTVAR:')).toBeNull()
  })
})

describe('requirementFor', () => {
  const training = (rule: Training['rule']): Training => ({
    code: 'X',
    name: 'X',
    validity: { kind: 'months', months: 12 },
    rule,
  })
  const subject = (department: string | null, position: string) => ({
    departmentKey: department === null ? null : departmentKey(department),
    positionKey: comparisonKey(position),
  })
  const labs = training({ kind: 'departments', departmentKeys: [departmentKey('Laboratoře')] })
  const maintenance = training({ kind: 'positions', positionKeys: [comparisonKey('Technik údržby')] })

  it('applies department rules regardless of spelling', () => {
    expect(requirementFor(labs, subject('LABORATORE', 'Laborant'))).toBe('required')
    expect(requirementFor(labs, subject('Knihovna', 'Laborant'))).toBe('not-required')
  })

  it('cannot decide department rules without a department', () => {
    expect(requirementFor(labs, subject(null, 'Laborant'))).toBe('undeterminable')
  })

  it('still applies "all" and position rules without a department', () => {
    expect(requirementFor(training({ kind: 'all' }), subject(null, 'Referent'))).toBe('required')
    expect(requirementFor(maintenance, subject(null, 'Technik údržby'))).toBe('required')
  })

  it('matches positions exactly ("Technik" is not "Technik údržby")', () => {
    expect(requirementFor(maintenance, subject('Správa budov', 'Technik'))).toBe('not-required')
  })

  it('never requires optional trainings', () => {
    expect(requirementFor(training({ kind: 'optional' }), subject('Knihovna', 'Knihovník'))).toBe('not-required')
  })
})

describe('mapCatalog', () => {
  const row = (rowNumber: number, values: Record<string, string>): SourceRow => ({ row: rowNumber, values })

  it('maps trainings and reports problems', () => {
    const { catalog, issues } = mapCatalog([
      row(2, { kod: 'kyber', nazev: 'Kybernetika', platnost_mesicu: '12', povinne_pro: 'VSICHNI' }),
      row(3, { kod: 'ZDVIH', nazev: 'Zdvih', platnost_mesicu: '2 roky', povinne_pro: 'POZICE:Technik údržby' }),
      row(4, { kod: 'KYBER', nazev: 'Duplicitní', platnost_mesicu: '12', povinne_pro: 'VSICHNI' }),
      row(5, { kod: 'X', nazev: 'X', platnost_mesicu: 'asi dva', povinne_pro: 'VSICHNI' }),
      row(6, { kod: 'Y', nazev: 'Y', platnost_mesicu: '12', povinne_pro: 'NEKDO' }),
    ])

    expect([...catalog.keys()]).toEqual(['KYBER', 'ZDVIH', 'X'])
    expect(catalog.get('ZDVIH')?.validity).toEqual({ kind: 'months', months: 24 })
    expect(catalog.get('X')?.validity).toEqual({ kind: 'unknown' })
    expect(issues.map((issue) => [issue.row, issue.kind])).toEqual([
      [3, 'textual-validity'],
      [4, 'duplicate-training-code'],
      [5, 'unparseable-validity'],
      [6, 'unknown-requirement-rule'],
    ])
  })
})
