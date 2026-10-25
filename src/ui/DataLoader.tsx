import type { ChangeEvent, ReactElement } from 'react'
import type { InputFile, RecognisedFile } from '../app/run-analysis.ts'
import { SOURCE_LABELS } from './model/labels.ts'

export function DataLoader(props: {
  readonly busy: boolean
  readonly files: readonly RecognisedFile[]
  readonly problems: readonly string[]
  readonly onFiles: (files: InputFile[]) => void
  readonly onDemo: () => void
}): ReactElement {
  async function handleChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const selected = [...(event.target.files ?? [])]
    // Allow picking the same files again after a fix.
    event.target.value = ''
    if (selected.length === 0) return
    props.onFiles(
      await Promise.all(selected.map(async (file) => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }))),
    )
  }

  return (
    <section className="space-y-3 rounded border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col text-sm">
          <span className="font-semibold">Nahrát 4 CSV exporty</span>
          <span className="text-xs text-gray-600">zaměstnanci, absolvovaná školení, katalog, termíny – najednou, v libovolném pořadí</span>
          <input
            type="file"
            multiple
            accept=".csv,text/csv"
            disabled={props.busy}
            className="mt-1 text-sm"
            onChange={(event) => void handleChange(event)}
          />
        </label>
        <button
          type="button"
          disabled={props.busy}
          className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
          onClick={props.onDemo}
        >
          Načíst ukázková data
        </button>
      </div>
      <p className="text-xs text-gray-600">
        Data se zpracovávají jen v tomto prohlížeči – nic se neodesílá ani neukládá; po obnovení stránky zmizí.
        Ukázková data jsou vymyšlená.
      </p>

      {props.busy && <p className="text-sm">Načítám…</p>}

      {props.files.length > 0 && (
        <ul className="text-xs text-gray-700">
          {props.files.map((file) => (
            <li key={`${file.source}-${file.name}`}>
              {file.name} → <strong>{SOURCE_LABELS[file.source]}</strong> ({file.rowCount} řádků, {file.encoding},
              oddělovač „{file.delimiter}“)
            </li>
          ))}
        </ul>
      )}

      {props.problems.length > 0 && (
        <ul role="alert" className="list-disc space-y-1 rounded bg-red-50 p-3 pl-6 text-sm text-red-900">
          {props.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
