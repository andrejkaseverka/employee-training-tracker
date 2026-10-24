/**
 * Normalisation of free-text values coming from different source systems.
 * Rule: normalise formatting only, never guess the meaning (no fuzzy matching).
 */

/** Training codes: trim, upper case, spaces/underscores → dash (` bozp_z ` → `BOZP-Z`). */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-')
}

/** Comparison key for names: no diacritics, lower case, single spaces. */
export function comparisonKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Known abbreviations of department names, as comparison keys.
 * Only spelled-out aliases belong here; diacritics and case are handled by comparisonKey.
 */
export const DEPARTMENT_ALIASES: Readonly<Record<string, string>> = {
  studijni: 'studijni oddeleni',
}

/** Department key: comparison key with abbreviations expanded. */
export function departmentKey(raw: string): string {
  const key = comparisonKey(raw)
  return DEPARTMENT_ALIASES[key] ?? key
}

export interface DepartmentDirectory {
  /** Canonical display name for a raw value, or null when the value is empty. */
  readonly resolve: (raw: string) => string | null
  /** Canonical department names, sorted. */
  readonly names: readonly string[]
}

/**
 * Groups raw department values by key; the display name is the most frequent full
 * spelling (abbreviations last, ties → alphabetical). Works for any dataset, no hard-coded list.
 */
export function buildDepartmentDirectory(rawValues: readonly string[]): DepartmentDirectory {
  const spellingsByKey = new Map<string, Map<string, number>>()
  for (const raw of rawValues) {
    const spelling = raw.trim().replace(/\s+/g, ' ')
    if (spelling === '') continue
    const key = departmentKey(spelling)
    const spellings = spellingsByKey.get(key) ?? new Map<string, number>()
    spellings.set(spelling, (spellings.get(spelling) ?? 0) + 1)
    spellingsByKey.set(key, spellings)
  }

  const canonicalByKey = new Map<string, string>()
  for (const [key, spellings] of spellingsByKey) {
    // An abbreviation never becomes the display name while a full spelling exists.
    // On equal frequency, a spelling with diacritics beats its stripped form.
    const isFull = (name: string): number => (comparisonKey(name) === key ? 1 : 0)
    const [best] = [...spellings.entries()].sort(
      ([nameA, countA], [nameB, countB]) =>
        isFull(nameB) - isFull(nameA) ||
        countB - countA ||
        diacriticCount(nameB) - diacriticCount(nameA) ||
        nameA.localeCompare(nameB, 'cs'),
    )
    if (best) canonicalByKey.set(key, best[0])
  }

  return {
    resolve: (raw: string): string | null => {
      if (raw.trim() === '') return null
      return canonicalByKey.get(departmentKey(raw)) ?? null
    },
    names: [...canonicalByKey.values()].sort((a, b) => a.localeCompare(b, 'cs')),
  }
}

function diacriticCount(value: string): number {
  return value.normalize('NFD').match(/\p{Diacritic}/gu)?.length ?? 0
}
