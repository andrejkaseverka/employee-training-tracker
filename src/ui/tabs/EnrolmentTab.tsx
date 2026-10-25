import type { ReactElement } from 'react'
import type { Catalog } from '../../domain/catalog.ts'
import type { Employee } from '../../domain/employee.ts'
import type { Assignment } from '../../domain/enrolment.ts'
import type { EnrolmentPlan } from '../../use-cases/recommend-enrolments.ts'
import { Note, StatusBadge, Table } from '../components/common.tsx'
import { formatDate, formatDaysLeft, formatGap, formatTime, personName } from '../model/format.ts'
import { UNASSIGNED_LABELS } from '../model/labels.ts'

export function EnrolmentTab(props: {
  readonly plan: EnrolmentPlan
  readonly employees: ReadonlyMap<string, Employee>
  readonly catalog: Catalog
}): ReactElement {
  const { plan } = props
  const nameOf = (id: string): string => {
    const employee = props.employees.get(id)
    return employee ? personName(employee) : id
  }
  const trainingName = (code: string): string => props.catalog.get(code)?.name ?? code

  const bySession = new Map<string, Assignment[]>()
  for (const assignment of plan.assignments) {
    bySession.set(assignment.sessionId, [...(bySession.get(assignment.sessionId) ?? []), assignment])
  }
  const usedSessions = plan.sessions
    .filter((usage) => usage.offer.offered && bySession.has(usage.session.id))
    .sort((a, b) => (a.session.date ?? '').localeCompare(b.session.date ?? '') || a.session.id.localeCompare(b.session.id))

  return (
    <div className="space-y-6">
      <Note>
        Pořadí: chybí → prošlé (nejdéle prošlé první) → brzy vyprší (nejméně dní první); každý dostane nejbližší vhodný
        termín s volným místem, bez časové kolize. Kapacita termínů se nepřekračuje.
      </Note>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Přihlásit na termíny ({plan.assignments.length})</h2>
        {usedSessions.map(({ session, assigned, seatsLeft }) => (
          <div key={session.id} className="rounded border border-gray-200 bg-white p-3">
            <h3 className="text-sm font-semibold">
              {session.id} · {trainingName(session.code)} · {formatDate(session.date)} {formatTime(session.startTime, session.endTime)}
              {session.place !== '' && ` · ${session.place}`}
            </h3>
            <p className="text-xs text-gray-600">
              Doporučeno {assigned}, po přihlášení zbývá {seatsLeft} volných míst
            </p>
            <ul className="mt-1 text-sm">
              {(bySession.get(session.id) ?? []).map((a) => (
                <li key={`${a.need.employeeId}|${a.need.code}`} className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={a.need.status} /> {nameOf(a.need.employeeId)}
                  <span className="text-xs text-gray-600">{formatDaysLeft(a.need.daysLeft)}</span>
                  {a.validityGapDays !== null && (
                    <span className="rounded bg-yellow-100 px-1 text-xs text-yellow-900">{formatGap(a.validityGapDays)}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Nelze přihlásit ({plan.unassigned.length})</h2>
        {plan.unassigned.length === 0 ? (
          <Note>Všechny potřeby jsou přiděleny.</Note>
        ) : (
          <Table head={['Zaměstnanec', 'Školení', 'Stav', 'Důvod']}>
            {plan.unassigned.map((u) => (
              <tr key={`${u.need.employeeId}|${u.need.code}`}>
                <td>{nameOf(u.need.employeeId)}</td>
                <td>{trainingName(u.need.code)}</td>
                <td>
                  <StatusBadge status={u.need.status} />
                </td>
                <td>{UNASSIGNED_LABELS[u.reason]}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      {plan.undeterminedRequirements.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Povinnost nelze určit ({plan.undeterminedRequirements.length})</h2>
          <Note>Školení povinná podle útvaru u lidí bez útvaru – po doplnění útvaru se objeví v doporučení.</Note>
          <Table head={['Zaměstnanec', 'Školení']}>
            {plan.undeterminedRequirements.map((r) => (
              <tr key={`${r.employeeId}|${r.code}`}>
                <td>{nameOf(r.employeeId)}</td>
                <td>{trainingName(r.code)}</td>
              </tr>
            ))}
          </Table>
        </section>
      )}
    </div>
  )
}
