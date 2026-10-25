import type { InputFile } from './run-analysis.ts'

// Only the synthetic fixtures are bundled; the original exports are never part of the build.
// Loaded as bytes (not `?raw`), because one fixture is Windows-1250 and must go through the same decoding as an upload.
const DEMO_FILE_URLS = import.meta.glob<string>('../../tests/fixtures/*.csv', {
  query: '?url',
  import: 'default',
  eager: true,
})

export async function loadDemoFiles(): Promise<InputFile[]> {
  return Promise.all(
    Object.entries(DEMO_FILE_URLS).map(async ([path, url]) => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Demo file ${path} could not be loaded (${response.status})`)
      return { name: path.split('/').at(-1) ?? path, bytes: new Uint8Array(await response.arrayBuffer()) }
    }),
  )
}
