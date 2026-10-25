import type { ReactElement } from 'react'
import type { Evaluation } from '../app/run-analysis.ts'
import type { LocalDate } from '../domain/config.ts'
import { TRAINING_STATUSES } from '../domain/training-status.ts'
import { StatusBadge } from './components/common.tsx'
import { formatDate } from './model/format.ts'

export function SummaryBar({ evaluation, today }: { readonly evaluation: Evaluation; readonly today: LocalDate }): ReactElement {
  const { overview, plan } = evaluation
  const gaps = plan.assignments.filter((assignment) => assignment.validityGapDays !== null).length
  return (
    <section className="grid gap-3 rounded border border-gray-200 bg-white p-4 text-sm sm:grid-cols-3">
      <div>
        <div className="text-xs text-gray-600">Stav k {formatDate(today)} (datum exportu)</div>
        <div>
          <strong>{overview.employees.length}</strong> zaměstnanců v přehledu
        </div>
        <div className="text-xs text-gray-600">{overview.excludedTerminated} ukončených vynecháno</div>
      </div>
      <div>
        <div className="text-xs text-gray-600">Povinná školení</div>
        <ul className="flex flex-wrap gap-2">
          {TRAINING_STATUSES.map((status) => (
            <li key={status} className="flex items-center gap-1">
              <StatusBadge status={status} /> <strong>{overview.statusCounts[status]}</strong>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="text-xs text-gray-600">Doporučení přihlášek</div>
        <div>
          <strong>{plan.assignments.length}</strong> přiděleno, <strong>{plan.unassigned.length}</strong> nezařazeno
        </div>
        <div className="text-xs text-gray-600">
          {gaps} s přerušenou platností · {plan.undeterminedRequirements.length} povinností nelze určit
        </div>
      </div>
    </section>
  )
}
