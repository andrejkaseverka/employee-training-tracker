import { useRef, useState, type ReactElement } from 'react'
import { loadDemoFiles } from '../app/demo-files.ts'
import { readUploadedFiles } from '../app/read-uploads.ts'
import { prepareData, readFiles, type InputFile, type PreparedData, type RecognisedFile } from '../app/run-analysis.ts'
import { DEFAULT_CONFIG } from '../domain/config.ts'
import { SelectField } from './components/common.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { EXPIRY_WINDOW_OPTIONS } from './config.ts'
import { DataLoader } from './DataLoader.tsx'
import { reportAppError } from './model/errors.ts'
import { describeFileProblem, ERROR_TEXTS } from './model/labels.ts'
import { Results, type TabId } from './Results.tsx'

type LoadState =
  | { readonly kind: 'empty' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'failed'; readonly files: readonly RecognisedFile[]; readonly problems: readonly string[] }
  | {
      readonly kind: 'ready'
      readonly files: readonly RecognisedFile[]
      readonly prepared: PreparedData
      /** Changes with every load, so tab state (filters) starts fresh for a new dataset. */
      readonly loadId: number
    }

const TODAY = DEFAULT_CONFIG.referenceDate

export function App(): ReactElement {
  const [state, setState] = useState<LoadState>({ kind: 'empty' })
  const [expiringSoonDays, setExpiringSoonDays] = useState<number>(DEFAULT_CONFIG.expiringSoonDays)
  const [tab, setTab] = useState<TabId>('attention')
  const loadCount = useRef(0)

  function load(files: InputFile[]): void {
    const read = readFiles(files)
    if (!read.ok) {
      setState({ kind: 'failed', files: read.files, problems: read.problems.map(describeFileProblem) })
      return
    }
    loadCount.current += 1
    setState({
      kind: 'ready',
      files: read.files,
      prepared: prepareData(read.tables, read.structuralIssues, DEFAULT_CONFIG),
      loadId: loadCount.current,
    })
  }

  async function run(getFiles: () => Promise<InputFile[]>): Promise<void> {
    setState({ kind: 'busy' })
    let files: InputFile[]
    try {
      files = await getFiles()
    } catch (error) {
      reportAppError('soubory nelze přečíst', error)
      setState({ kind: 'failed', files: [], problems: [ERROR_TEXTS.unreadable] })
      return
    }
    try {
      load(files)
    } catch (error) {
      // A bug in our code, not a problem in the files: say so, log only safe details.
      reportAppError('chyba při zpracování dat', error)
      setState({ kind: 'failed', files: [], problems: [ERROR_TEXTS.processing] })
    }
  }

  const prepared = state.kind === 'ready' ? state.prepared : null
  const loadId = state.kind === 'ready' ? state.loadId : 0

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4 text-gray-900">
      <h1 className="text-2xl font-semibold">Přehled školení zaměstnanců</h1>

      <DataLoader
        busy={state.kind === 'busy'}
        files={state.kind === 'ready' || state.kind === 'failed' ? state.files : []}
        problems={state.kind === 'failed' ? state.problems : []}
        onFiles={(files) => void run(() => readUploadedFiles(files))}
        onDemo={() => void run(loadDemoFiles)}
      />

      {prepared && (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <SelectField
              label="„Brzy vyprší“ = platnost končí do"
              value={String(expiringSoonDays)}
              options={EXPIRY_WINDOW_OPTIONS.map((d) => ({ value: String(d), label: `${d} dní` }))}
              onChange={(value) => setExpiringSoonDays(Number(value))}
            />
          </div>
          {/* key: a new dataset remounts the results (fresh filters); resetKey: another window retries after an error. */}
          <ErrorBoundary
            key={loadId}
            resetKey={expiringSoonDays}
            fallback={
              <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-900">
                {ERROR_TEXTS.results}
              </p>
            }
          >
            <Results prepared={prepared} today={TODAY} expiringSoonDays={expiringSoonDays} tab={tab} onTabChange={setTab} />
          </ErrorBoundary>
        </>
      )}
    </main>
  )
}
