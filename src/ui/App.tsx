import { useMemo, useState, type ReactElement } from 'react'
import { loadDemoFiles } from '../app/demo-files.ts'
import {
  evaluate,
  prepareData,
  readFiles,
  type InputFile,
  type PreparedData,
  type RecognisedFile,
} from '../app/run-analysis.ts'
import { DEFAULT_CONFIG } from '../domain/config.ts'
import type { SessionUsage } from '../use-cases/recommend-enrolments.ts'
import { SelectField } from './components/common.tsx'
import { EXPIRY_WINDOW_OPTIONS } from './config.ts'
import { DataLoader } from './DataLoader.tsx'
import { buildAttentionList } from './model/attention.ts'
import { departmentOptions } from './model/filters.ts'
import { describeFileProblem } from './model/labels.ts'
import { indexSessions } from './model/sessions.ts'
import { SummaryBar } from './SummaryBar.tsx'
import { AttentionTab } from './tabs/AttentionTab.tsx'
import { DataQualityTab } from './tabs/DataQualityTab.tsx'
import { EmployeesTab } from './tabs/EmployeesTab.tsx'
import { EnrolmentTab } from './tabs/EnrolmentTab.tsx'
import { SessionsTab } from './tabs/SessionsTab.tsx'

type LoadState =
  | { readonly kind: 'empty' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'failed'; readonly files: readonly RecognisedFile[]; readonly problems: readonly string[] }
  | { readonly kind: 'ready'; readonly files: readonly RecognisedFile[]; readonly prepared: PreparedData }

type TabId = 'attention' | 'employees' | 'enrolment' | 'sessions' | 'quality'

const TODAY = DEFAULT_CONFIG.referenceDate

export function App(): ReactElement {
  const [state, setState] = useState<LoadState>({ kind: 'empty' })
  const [expiringSoonDays, setExpiringSoonDays] = useState<number>(DEFAULT_CONFIG.expiringSoonDays)
  const [tab, setTab] = useState<TabId>('attention')

  function load(files: InputFile[]): void {
    const read = readFiles(files)
    if (!read.ok) {
      setState({ kind: 'failed', files: read.files, problems: read.problems.map(describeFileProblem) })
      return
    }
    setState({ kind: 'ready', files: read.files, prepared: prepareData(read.tables, read.structuralIssues, DEFAULT_CONFIG) })
  }

  async function run(getFiles: () => Promise<InputFile[]> | InputFile[]): Promise<void> {
    setState({ kind: 'busy' })
    try {
      load(await getFiles())
    } catch {
      // No details: the error could carry file content.
      setState({ kind: 'failed', files: [], problems: ['Soubory se nepodařilo načíst.'] })
    }
  }

  const prepared = state.kind === 'ready' ? state.prepared : null
  const evaluation = useMemo(
    () => (prepared === null ? null : evaluate(prepared.dataset, { today: TODAY, expiringSoonDays })),
    [prepared, expiringSoonDays],
  )
  const attention = useMemo(
    () => (evaluation && prepared ? buildAttentionList(evaluation.overview, evaluation.plan, prepared.dataset.catalog) : []),
    [evaluation, prepared],
  )
  const sessions = useMemo(() => (evaluation ? indexSessions(evaluation.plan) : new Map<string, SessionUsage>()), [evaluation])
  const departments = useMemo(() => (evaluation ? departmentOptions(evaluation.overview.employees) : []), [evaluation])

  const tabs: readonly { readonly id: TabId; readonly label: string }[] = [
    { id: 'attention', label: `Co řešit (${attention.length})` },
    { id: 'employees', label: 'Zaměstnanci' },
    { id: 'enrolment', label: 'Doporučení přihlášek' },
    { id: 'sessions', label: 'Termíny' },
    { id: 'quality', label: 'Kvalita dat' },
  ]

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4 text-gray-900">
      <h1 className="text-2xl font-semibold">Přehled školení zaměstnanců</h1>

      <DataLoader
        busy={state.kind === 'busy'}
        files={state.kind === 'ready' || state.kind === 'failed' ? state.files : []}
        problems={state.kind === 'failed' ? state.problems : []}
        onFiles={(files) => void run(() => files)}
        onDemo={() => void run(loadDemoFiles)}
      />

      {evaluation && prepared && (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <SelectField
              label="„Brzy vyprší“ = platnost končí do"
              value={String(expiringSoonDays)}
              options={EXPIRY_WINDOW_OPTIONS.map((d) => ({ value: String(d), label: `${d} dní` }))}
              onChange={(value) => setExpiringSoonDays(Number(value))}
            />
          </div>
          <SummaryBar evaluation={evaluation} today={TODAY} />

          <nav role="tablist" className="flex flex-wrap gap-1 border-b border-gray-300">
            {tabs.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`rounded-t px-3 py-1.5 text-sm ${tab === id ? 'bg-blue-700 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>

          <div role="tabpanel">
            {tab === 'attention' && <AttentionTab items={attention} sessions={sessions} departments={departments} />}
            {tab === 'employees' && (
              <EmployeesTab
                employees={evaluation.overview.employees}
                catalog={prepared.dataset.catalog}
                departments={departments}
              />
            )}
            {tab === 'enrolment' && (
              <EnrolmentTab
                plan={evaluation.plan}
                employees={prepared.dataset.employees}
                catalog={prepared.dataset.catalog}
              />
            )}
            {tab === 'sessions' && <SessionsTab sessions={evaluation.plan.sessions} catalog={prepared.dataset.catalog} />}
            {tab === 'quality' && <DataQualityTab issues={prepared.issueSummary} />}
          </div>
        </>
      )}
    </main>
  )
}
