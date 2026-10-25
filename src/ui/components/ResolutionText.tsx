import type { ReactElement } from 'react'
import type { SessionUsage } from '../../use-cases/recommend-enrolments.ts'
import type { Resolution } from '../model/attention.ts'
import { formatDate, formatGap, formatTime } from '../model/format.ts'
import { UNASSIGNED_LABELS } from '../model/labels.ts'

export function ResolutionText(props: {
  readonly resolution: Resolution
  readonly sessions: ReadonlyMap<string, SessionUsage>
}): ReactElement {
  const { resolution } = props
  switch (resolution.kind) {
    case 'assigned': {
      const session = props.sessions.get(resolution.sessionId)?.session
      return (
        <span>
          Přihlásit na <strong>{resolution.sessionId}</strong> {formatDate(resolution.sessionDate)}
          {session && ` ${formatTime(session.startTime, session.endTime)}`}
          {resolution.validityGapDays !== null && (
            <span className="ml-1 rounded bg-yellow-100 px-1 text-xs text-yellow-900">{formatGap(resolution.validityGapDays)}</span>
          )}
        </span>
      )
    }
    case 'unassigned':
      return <span className="text-red-800">{UNASSIGNED_LABELS[resolution.reason]}</span>
    case 'check-data':
      return <span className="text-purple-800">Doplnit útvar v evidenci – nelze určit, zda je školení povinné</span>
  }
}
