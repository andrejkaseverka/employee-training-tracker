import type { ReactElement } from 'react'
import { ANY, type PersonFilter } from '../model/filters.ts'
import { SearchField, SelectField } from './common.tsx'

export function PersonFilterFields(props: {
  readonly filter: PersonFilter
  readonly departments: readonly string[]
  readonly onChange: (filter: PersonFilter) => void
}): ReactElement {
  const { filter, onChange } = props
  return (
    <>
      <SelectField
        label="Útvar"
        value={filter.department}
        options={[{ value: ANY, label: 'Všechny' }, ...props.departments.map((name) => ({ value: name, label: name }))]}
        onChange={(department) => onChange({ ...filter, department })}
      />
      <SearchField value={filter.search} onChange={(search) => onChange({ ...filter, search })} />
    </>
  )
}
