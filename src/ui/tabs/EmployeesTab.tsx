import { useMemo, useState, type ReactElement } from 'react'
import type { Catalog } from '../../domain/catalog.ts'
import { TRAINING_STATUSES } from '../../domain/training-status.ts'
import type { EmployeeOverview } from '../../use-cases/build-training-overview.ts'
import { Note, SelectField, StatusBadge, Table } from '../components/common.tsx'
import { PersonFilterFields } from '../components/PersonFilterFields.tsx'
import {
  ANY,
  EMPTY_PERSON_FILTER,
  EMPTY_TRAINING_FILTER,
  filterEmployees,
  toStatusFilter,
  type PersonFilter,
  type TrainingFilter,
} from '../model/filters.ts'
import { describeFlags, formatDate, formatDaysLeft, personName } from '../model/format.ts'
import { STATUS_LABELS, VALIDITY_SOURCE_LABELS } from '../model/labels.ts'

export function EmployeesTab(props: {
  readonly employees: readonly EmployeeOverview[]
  readonly catalog: Catalog
  readonly departments: readonly string[]
}): ReactElement {
  const [person, setPerson] = useState<PersonFilter>(EMPTY_PERSON_FILTER)
  const [training, setTraining] = useState<TrainingFilter>(EMPTY_TRAINING_FILTER)
  const visible = useMemo(() => filterEmployees(props.employees, person, training), [props.employees, person, training])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <PersonFilterFields filter={person} departments={props.departments} onChange={setPerson} />
        <SelectField
          label="Školení"
          value={training.code}
          options={[
            { value: ANY, label: 'Všechna' },
            ...[...props.catalog.values()].map((t) => ({ value: t.code, label: `${t.code} – ${t.name}` })),
          ]}
          onChange={(code) => setTraining({ ...training, code })}
        />
        <SelectField
          label="Stav školení"
          value={training.status}
          options={[{ value: ANY, label: 'Vše' }, ...TRAINING_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]}
          onChange={(status) => setTraining({ ...training, status: toStatusFilter(status) })}
        />
      </div>
      <Note>
        Zobrazeno {visible.length} z {props.employees.length} zaměstnanců. Rozbalením řádku se zobrazí jejich povinná školení.
      </Note>
      <ul className="divide-y divide-gray-100 rounded border border-gray-200 bg-white">
        {visible.map((entry) => (
          <li key={entry.employee.id}>
            <details>
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                <strong>{personName(entry.employee)}</strong>
                <span className="text-gray-600">
                  {entry.employee.department ?? 'bez útvaru'} · {entry.employee.position}
                </span>
                <span className="flex flex-wrap gap-1">
                  {entry.trainings.map((row) => (
                    <span key={row.code} title={`${row.trainingName}: ${STATUS_LABELS[row.status]}`} className="flex items-center gap-0.5 text-xs">
                      {row.code} <StatusBadge status={row.status} />
                    </span>
                  ))}
                </span>
                <span className="text-xs text-gray-600">{describeFlags(entry.flags).join(' · ')}</span>
              </summary>
              <div className="px-3 pb-3">
                <Table head={['Školení', 'Stav', 'Absolvováno', 'Platnost do', 'Zdroj platnosti']}>
                  {entry.trainings.map((row) => (
                    <tr key={row.code}>
                      <td>{row.trainingName}</td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                      <td>{formatDate(row.lastCompletedOn)}</td>
                      <td>
                        {row.validitySource === 'none' ? 'bez expirace' : formatDate(row.validUntil)}
                        <div className="text-xs text-gray-600">{formatDaysLeft(row.daysLeft)}</div>
                      </td>
                      <td>{row.validitySource === null ? '–' : VALIDITY_SOURCE_LABELS[row.validitySource]}</td>
                    </tr>
                  ))}
                </Table>
                {entry.undeterminedRequirements.length > 0 && (
                  <Note>
                    Chybí útvar, proto nelze určit povinnost: {entry.undeterminedRequirements.join(', ')}
                  </Note>
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  )
}
