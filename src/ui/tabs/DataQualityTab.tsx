import type { ReactElement } from 'react'
import type { IssueSummary } from '../../domain/data-quality.ts'
import { Note, Table } from '../components/common.tsx'
import { ISSUE_LABELS, SEVERITY_LABELS, SOURCE_LABELS } from '../model/labels.ts'

export function DataQualityTab({ issues }: { readonly issues: readonly IssueSummary[] }): ReactElement {
  return (
    <div className="space-y-3">
      <Note>
        Co se při načtení opravilo, vyřadilo nebo stojí za ověření ve zdrojových systémech. Jen souhrnné počty.
      </Note>
      {issues.length === 0 ? (
        <Note>Žádné problémy nenalezeny.</Note>
      ) : (
        <Table head={['Tabulka', 'Problém', 'Dopad', 'Počet']} numericColumns={[3]}>
          {issues.map((issue) => (
            <tr key={`${issue.source}|${issue.kind}|${issue.severity}`}>
              <td>{SOURCE_LABELS[issue.source]}</td>
              <td>{ISSUE_LABELS[issue.kind]}</td>
              <td>{SEVERITY_LABELS[issue.severity]}</td>
              <td className="text-right">{issue.count}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
