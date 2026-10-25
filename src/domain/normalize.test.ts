import { describe, expect, it } from 'vitest'
import { buildDepartmentDirectory, comparisonKey, departmentKey, normalizeCode } from './normalize.ts'

describe('normalizeCode', () => {
  it.each([
    ['BOZP-Z', 'BOZP-Z'],
    [' BOZP-Z ', 'BOZP-Z'],
    ['bozp-z', 'BOZP-Z'],
    ['BOZP_Z', 'BOZP-Z'],
    ['BOZP Z', 'BOZP-Z'],
    ['POZ  OCH', 'POZ-OCH'],
  ])('normalises %j to %j', (raw, expected) => {
    expect(normalizeCode(raw)).toBe(expected)
  })

  it('does not repair typos (no guessing)', () => {
    expect(normalizeCode('KYB3R')).toBe('KYB3R')
    expect(normalizeCode('GDPR-2')).toBe('GDPR-2')
  })
})

describe('comparisonKey', () => {
  it('removes diacritics, case and extra whitespace', () => {
    expect(comparisonKey('  SPRÁVA   budov ')).toBe('sprava budov')
    expect(comparisonKey('Laboratoře')).toBe(comparisonKey('Laboratore'))
  })
})

describe('departmentKey', () => {
  it('expands known abbreviations', () => {
    expect(departmentKey('Studijní')).toBe('studijni oddeleni')
    expect(departmentKey('Studijní oddělení')).toBe('studijni oddeleni')
  })

  it('ignores inherited object keys', () => {
    expect(departmentKey('constructor')).toBe('constructor')
    expect(departmentKey('toString')).toBe('tostring')
    expect(departmentKey('__proto__')).toBe('__proto__')
  })
})

describe('buildDepartmentDirectory', () => {
  const directory = buildDepartmentDirectory([
    'Správa budov',
    'Správa budov',
    'SPRÁVA BUDOV',
    'správa budov',
    'Sprava budov',
    'Studijní oddělení',
    'Studijní',
    'Studijni oddeleni',
    '',
  ])

  it('maps every spelling to the most frequent one', () => {
    expect(directory.resolve('SPRÁVA BUDOV')).toBe('Správa budov')
    expect(directory.resolve('sprava budov')).toBe('Správa budov')
    expect(directory.resolve('Studijní')).toBe('Studijní oddělení')
  })

  it('returns null for empty or unseen values', () => {
    expect(directory.resolve('  ')).toBeNull()
    expect(directory.resolve('Neexistující útvar')).toBeNull()
  })

  it('lists canonical names', () => {
    expect(directory.names).toEqual(['Správa budov', 'Studijní oddělení'])
  })

  it('prefers the spelling with diacritics on equal frequency', () => {
    const tie = buildDepartmentDirectory(['Personalni oddeleni', 'Personální oddělení'])
    expect(tie.names).toEqual(['Personální oddělení'])
  })

  it('keeps the more frequent spelling even without diacritics', () => {
    const frequent = buildDepartmentDirectory(['Laboratore', 'Laboratore', 'Laboratoře'])
    expect(frequent.names).toEqual(['Laboratore'])
  })

  it('breaks remaining ties alphabetically', () => {
    const tie = buildDepartmentDirectory(['Knihovna', 'KNIHOVNA'])
    expect(tie.names).toEqual(['Knihovna'])
  })
})
