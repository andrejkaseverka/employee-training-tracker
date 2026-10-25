import { useId, useMemo, type ReactElement } from 'react'
import { evaluate, type PreparedData } from '../app/run-analysis.ts'
import type { LocalDate } from '../domain/config.ts'
import { buildAttentionList } from './model/attention.ts'
import { departmentOptions } from './model/filters.ts'
import { indexSessions } from './model/sessions.ts'
import { SummaryBar } from './SummaryBar.tsx'
import { AttentionTab } from './tabs/AttentionTab.tsx'
import { DataQualityTab } from './tabs/DataQualityTab.tsx'
import { EmployeesTab } from './tabs/EmployeesTab.tsx'
import { EnrolmentTab } from './tabs/EnrolmentTab.tsx'
import { SessionsTab } from './tabs/SessionsTab.tsx'

export type TabId = 'attention' | 'employees' | 'enrolment' | 'sessions' | 'quality'

/**
 * Everything computed from a loaded dataset. A separate component so that an error while
 * computing or rendering is caught by the surrounding error boundary instead of blanking the page.
 */
export function Results(props: {
  readonly prepared: PreparedData
  readonly today: LocalDate
  readonly expiringSoonDays: number
  readonly tab: TabId
  readonly onTabChange: (tab: TabId) => void
}): ReactElement {
  const { prepared, today, expiringSoonDays, tab } = props
  const evaluation = useMemo(
    () => evaluate(prepared.dataset, { today, expiringSoonDays }),
    [prepared, today, expiringSoonDays],
  )
  const attention = useMemo(
    () => buildAttentionList(evaluation.overview, evaluation.plan, prepared.dataset.catalog),
    [evaluation, prepared],
  )
  const sessions = useMemo(() => indexSessions(evaluation.plan), [evaluation])
  const departments = useMemo(() => departmentOptions(evaluation.overview.employees), [evaluation])
  const idPrefix = useId()
  const panelId = `${idPrefix}-panel`

  const tabs: readonly { readonly id: TabId; readonly label: string }[] = [
    { id: 'attention', label: `Co řešit (${attention.length})` },
    { id: 'employees', label: 'Zaměstnanci' },
    { id: 'enrolment', label: 'Doporučení přihlášek' },
    { id: 'sessions', label: 'Termíny' },
    { id: 'quality', label: 'Kvalita dat' },
  ]

  return (
    <>
      <SummaryBar evaluation={evaluation} today={today} />

      <div role="tablist" className="flex flex-wrap gap-1 border-b border-gray-300">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            id={`${idPrefix}-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={panelId}
            className={`rounded-t px-3 py-1.5 text-sm ${tab === id ? 'bg-blue-700 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            onClick={() => props.onTabChange(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={panelId} aria-labelledby={`${idPrefix}-tab-${tab}`}>
        {tab === 'attention' && <AttentionTab items={attention} sessions={sessions} departments={departments} />}
        {tab === 'employees' && (
          <EmployeesTab employees={evaluation.overview.employees} catalog={prepared.dataset.catalog} departments={departments} />
        )}
        {tab === 'enrolment' && (
          <EnrolmentTab plan={evaluation.plan} employees={prepared.dataset.employees} catalog={prepared.dataset.catalog} />
        )}
        {tab === 'sessions' && <SessionsTab sessions={evaluation.plan.sessions} catalog={prepared.dataset.catalog} />}
        {tab === 'quality' && <DataQualityTab issues={prepared.issueSummary} />}
      </div>
    </>
  )
}
