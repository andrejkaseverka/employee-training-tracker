import type { ReactElement, ReactNode } from 'react'
import type { TrainingStatus } from '../../domain/training-status.ts'
import { STATUS_LABELS, UNKNOWN_REQUIREMENT_LABEL } from '../model/labels.ts'

const STATUS_CLASSES: Readonly<Record<TrainingStatus, string>> = {
  expired: 'bg-red-100 text-red-900',
  missing: 'bg-orange-100 text-orange-900',
  undetermined: 'bg-purple-100 text-purple-900',
  expiring: 'bg-yellow-100 text-yellow-900',
  valid: 'bg-green-100 text-green-900',
}

export function StatusBadge({ status }: { readonly status: TrainingStatus | null }): ReactElement {
  if (status === null) {
    return <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs whitespace-nowrap text-gray-900">{UNKNOWN_REQUIREMENT_LABEL}</span>
  }
  return <span className={`rounded px-1.5 py-0.5 text-xs whitespace-nowrap ${STATUS_CLASSES[status]}`}>{STATUS_LABELS[status]}</span>
}

export function Table({ head, children }: { readonly head: readonly string[]; readonly children: ReactNode }): ReactElement {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-300 text-left">
            {head.map((title) => (
              <th key={title} className="px-2 py-1 font-semibold">
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-gray-100 [&_td]:px-2 [&_td]:py-1 [&_td]:align-top">{children}</tbody>
      </table>
    </div>
  )
}

export interface Option {
  readonly value: string
  readonly label: string
}

export function SelectField(props: {
  readonly label: string
  readonly value: string
  readonly options: readonly Option[]
  readonly onChange: (value: string) => void
}): ReactElement {
  return (
    <label className="flex flex-col text-xs text-gray-600">
      {props.label}
      <select
        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function SearchField(props: { readonly value: string; readonly onChange: (value: string) => void }): ReactElement {
  return (
    <label className="flex flex-col text-xs text-gray-600">
      Hledat jméno nebo ID
      <input
        type="search"
        className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  )
}

export function Note({ children }: { readonly children: ReactNode }): ReactElement {
  return <p className="text-sm text-gray-600">{children}</p>
}
