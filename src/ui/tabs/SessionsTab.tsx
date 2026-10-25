import type { ReactElement } from 'react'
import type { Catalog } from '../../domain/catalog.ts'
import type { SessionUsage } from '../../use-cases/recommend-enrolments.ts'
import { Note, Table } from '../components/common.tsx'
import { formatDate, formatTime } from '../model/format.ts'
import { NOT_OFFERED_LABELS } from '../model/labels.ts'

const orDash = (value: number | null): string => (value === null ? '–' : String(value))

export function SessionsTab({ sessions, catalog }: { readonly sessions: readonly SessionUsage[]; readonly catalog: Catalog }): ReactElement {
  const offered = sessions.filter((usage) => usage.offer.offered).length
  return (
    <div className="space-y-3">
      <Note>
        Všechny termíny z exportu v pořadí souboru. Nabízí se {offered} z {sessions.length}; ostatní s důvodem.
      </Note>
      <Table
        head={['ID', 'Školení', 'Datum', 'Čas', 'Místo', 'Kapacita', 'Obsazeno', 'Nabízí se', 'Doporučeno', 'Zbývá']}
        numericColumns={[5, 6, 8, 9]}
      >
        {sessions.map(({ session, offer, assigned, seatsLeft }) => (
          <tr key={`${session.row}`} className={offer.offered ? '' : 'text-gray-500'}>
            <td>{session.id}</td>
            <td>{catalog.get(session.code)?.name ?? session.code}</td>
            <td className="whitespace-nowrap">{formatDate(session.date)}</td>
            <td className="whitespace-nowrap">{formatTime(session.startTime, session.endTime)}</td>
            <td>{session.place}</td>
            <td className="text-right">{orDash(session.capacity)}</td>
            <td className="text-right">{orDash(session.booked)}</td>
            <td>
              {offer.offered
                ? 'ano'
                : `ne – ${NOT_OFFERED_LABELS[offer.reason]}${session.duplicateOf !== null && offer.reason === 'duplicate' ? ` (${session.duplicateOf})` : ''}`}
            </td>
            <td className="text-right">{offer.offered ? assigned : '–'}</td>
            <td className="text-right">{offer.offered ? seatsLeft : '–'}</td>
          </tr>
        ))}
      </Table>
    </div>
  )
}
