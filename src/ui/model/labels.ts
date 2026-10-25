import type { FileProblem } from '../../app/run-analysis.ts'
import type { ValiditySource } from '../../domain/completion.ts'
import type { DataSource, IssueKind, IssueSeverity } from '../../domain/data-quality.ts'
import type { UnassignedReason } from '../../domain/enrolment.ts'
import type { NotOfferedReason } from '../../domain/session-offer.ts'
import type { TrainingStatus } from '../../domain/training-status.ts'

// Czech UI texts. Records keyed by the domain unions, so a new reason fails the type check until it has a label.

export const STATUS_LABELS: Readonly<Record<TrainingStatus, string>> = {
  expired: 'Prošlé',
  missing: 'Chybí',
  undetermined: 'Nelze určit',
  expiring: 'Brzy vyprší',
  valid: 'Platné',
}

export const UNASSIGNED_LABELS: Readonly<Record<UnassignedReason, string>> = {
  'parental-leave': 'Rodičovská dovolená – nezařazuje se',
  'undetermined-validity': 'Platnost nelze určit – nejdřív ověřit záznam',
  'leaves-before-expiry': 'Odchází dřív, než platnost vyprší',
  'no-session': 'Školení nemá v exportu žádný termín',
  'no-offered-session': 'Termíny existují, ale žádný se nenabízí',
  'no-session-in-employment': 'Žádný termín v době zaměstnání',
  'capacity-exhausted': 'Kapacita vhodných termínů je vyčerpána',
  'time-conflict': 'Časová kolize s jiným přiděleným termínem',
}

export const NOT_OFFERED_LABELS: Readonly<Record<NotOfferedReason, string>> = {
  'unknown-code': 'Neznámý kód školení',
  'invalid-date': 'Neplatné datum',
  past: 'Proběhl před dnem exportu',
  cancelled: 'Zrušen',
  duplicate: 'Duplicita jiného termínu',
  full: 'Plně obsazen',
}

export const SOURCE_LABELS: Readonly<Record<DataSource, string>> = {
  employees: 'Zaměstnanci',
  completions: 'Absolvovaná školení',
  catalog: 'Katalog školení',
  sessions: 'Termíny školení',
}

export const SEVERITY_LABELS: Readonly<Record<IssueSeverity, string>> = {
  dropped: 'Záznam nepoužit',
  flagged: 'Použit, k ověření',
}

export const VALIDITY_SOURCE_LABELS: Readonly<Record<ValiditySource, string>> = {
  record: 'ze záznamu',
  computed: 'dopočteno z katalogu',
  none: 'bez expirace',
  unknown: 'nelze určit',
}

export const ISSUE_LABELS: Readonly<Record<IssueKind, string>> = {
  'repeated-header': 'Opakovaná hlavička uprostřed dat',
  'column-count-mismatch': 'Řádek s jiným počtem sloupců',
  'missing-value': 'Chybí povinná hodnota',
  'invalid-date': 'Neplatné datum',
  'excel-serial-date': 'Datum jako číslo z Excelu (převedeno)',
  'invalid-number': 'Neplatné číslo',
  'duplicate-employee-id': 'Duplicitní ID zaměstnance',
  'unknown-status': 'Neznámý stav zaměstnance',
  'missing-department': 'Chybí útvar',
  'unknown-manager': 'Vedoucí není v seznamu zaměstnanců',
  'duplicate-training-code': 'Duplicitní kód školení',
  'unknown-requirement-rule': 'Nečitelné pravidlo povinnosti',
  'unparseable-validity': 'Nečitelná platnost',
  'textual-validity': 'Platnost zapsaná textem (přečtena)',
  'unknown-training-code': 'Neznámý kód školení',
  'orphan-employee-reference': 'Odkaz na neexistujícího zaměstnance',
  'implausible-date': 'Nevěrohodné datum (výplň)',
  'future-completion': 'Absolvování v budoucnosti',
  'valid-until-before-completion': 'Platnost končí před absolvováním',
  'valid-until-computed': 'Platnost dopočtena z katalogu',
  'validity-differs-from-catalog': 'Platnost se liší od katalogu',
  'duplicate-record-id': 'Duplicitní ID záznamu',
  'duplicate-completion': 'Duplicitní absolvování',
  'completed-after-termination': 'Absolvováno po ukončení pracovního poměru',
  'overbooked-session': 'Termín přeplněný (obsazeno > kapacita)',
  'duplicate-session': 'Duplicitní termín',
  'duplicate-session-id': 'Opakované ID termínu',
  'invalid-time': 'Nečitelný čas',
}

/** One sentence explaining why a set of uploaded files cannot be used. */
export function describeFileProblem(problem: FileProblem): string {
  switch (problem.kind) {
    case 'missing-table':
      return `Chybí soubor s tabulkou „${SOURCE_LABELS[problem.source]}“.`
    case 'duplicate-table':
      return `Tabulka „${SOURCE_LABELS[problem.source]}“ je nahraná vícekrát (${problem.fileNames.join(', ')}).`
    case 'unrecognized': {
      const guess =
        problem.bestGuess === null
          ? 'neodpovídá žádné ze čtyř tabulek'
          : `nejvíc se podobá tabulce „${SOURCE_LABELS[problem.bestGuess]}“, chybí sloupce: ${problem.missingColumns.join(', ')}`
      return `Soubor ${problem.fileName} nebyl rozpoznán – ${guess}.`
    }
  }
}
