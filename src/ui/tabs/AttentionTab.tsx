import { useMemo, useState, type ReactElement } from 'react'
import { TRAINING_STATUSES } from '../../domain/training-status.ts'
import type { SessionUsage } from '../../use-cases/recommend-enrolments.ts'
import { Note, SelectField, StatusBadge, Table } from '../components/common.tsx'
import { PersonFilterFields } from '../components/PersonFilterFields.tsx'
import { ResolutionText } from '../components/ResolutionText.tsx'
import type { AttentionItem } from '../model/attention.ts'
import { ANY, EMPTY_PERSON_FILTER, matchesPerson, type PersonFilter } from '../model/filters.ts'
import { describeFlags, formatDate, formatDaysLeft, personName } from '../model/format.ts'
import { STATUS_LABELS } from '../model/labels.ts'

const UNKNOWN_REQUIREMENT = 'unknown-requirement'

export function AttentionTab(props: {
  readonly items: readonly AttentionItem[]
  readonly sessions: ReadonlyMap<string, SessionUsage>
  readonly departments: readonly string[]
}): ReactElement {
  const [person, setPerson] = useState<PersonFilter>(EMPTY_PERSON_FILTER)
  const [status, setStatus] = useState<string>(ANY)

  const visible = useMemo(
    () =>
      props.items.filter(
        (item) =>
          matchesPerson(item.person.employee, person) &&
          (status === ANY || (status === UNKNOWN_REQUIREMENT ? item.status === null : item.status === status)),
      ),
    [props.items, person, status],
  )

  return (
    <div className="space-y-3">
      <Note>
        Všechna povinná školení, která nejsou platná, seřazená od nejnaléhavějšího, s doporučeným termínem nebo důvodem,
        proč přihlásit nejde.
      </Note>
      <div className="flex flex-wrap gap-3">
        <PersonFilterFields filter={person} departments={props.departments} onChange={setPerson} />
        <SelectField
          label="Stav"
          value={status}
          options={[
            { value: ANY, label: 'Vše' },
            ...TRAINING_STATUSES.filter((s) => s !== 'valid').map((s) => ({ value: s, label: STATUS_LABELS[s] })),
            { value: UNKNOWN_REQUIREMENT, label: 'Povinnost nejasná' },
          ]}
          onChange={setStatus}
        />
      </div>
      <Note>
        Zobrazeno {visible.length} z {props.items.length}
      </Note>
      <Table head={['Stav', 'Zaměstnanec', 'Útvar', 'Školení', 'Platnost do', 'Co udělat']}>
        {visible.map((item) => (
          <tr key={`${item.person.employee.id}|${item.code}`}>
            <td>
              <StatusBadge status={item.status} />
            </td>
            <td>
              {personName(item.person.employee)}
              <div className="text-xs text-gray-600">{describeFlags(item.person.flags).join(' · ')}</div>
            </td>
            <td>{item.person.employee.department ?? '–'}</td>
            <td>{item.trainingName}</td>
            <td className="whitespace-nowrap">
              {formatDate(item.validUntil)}
              <div className="text-xs text-gray-600">{formatDaysLeft(item.daysLeft)}</div>
            </td>
            <td>
              <ResolutionText resolution={item.resolution} sessions={props.sessions} />
            </td>
          </tr>
        ))}
      </Table>
    </div>
  )
}
