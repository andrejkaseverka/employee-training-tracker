// Pure checks for the build output: the only data allowed in `dist/` are the synthetic demo fixtures.
// No file system access here, so the rules can be tested on in-memory files.

export interface BuildFile {
  /** Path relative to the build directory, with forward slashes. */
  readonly path: string
  readonly bytes: Uint8Array
}

export interface CsvPayload {
  /** Where the payload was found, e.g. `assets/x.csv` or `assets/index.js (data URI #1)`. */
  readonly source: string
  readonly bytes: Uint8Array
}

export interface DistCheckResult {
  readonly ok: boolean
  readonly payloadCount: number
  /** Human-readable problems; they name files only, never their content. */
  readonly problems: readonly string[]
}

const CSV_EXTENSION = '.csv'

/** Text files in which data could be embedded inline. */
const TEXT_EXTENSIONS: readonly string[] = ['.js', '.mjs', '.html', '.css', '.json', '.svg', '.map']

/** Data-URI media types that could carry a CSV; images and fonts are left out. Empty = no type given. */
const CSV_CAPABLE_MEDIA_TYPES: ReadonlySet<string> = new Set([
  '',
  'text/csv',
  'text/plain',
  'application/csv',
  'application/vnd.ms-excel',
  'application/octet-stream',
])

const BASE64_DATA_URI = /data:([\w.+-]+\/[\w.+-]+)?((?:;[\w.+-]+=[^;,"'\s]*)*);base64,([A-Za-z0-9+/]+=*)/g

const UTF8_BOM: readonly number[] = [0xef, 0xbb, 0xbf]
const LINE_FEED = 0x0a
const CARRIAGE_RETURN = 0x0d

function hasExtension(path: string, extensions: readonly string[]): boolean {
  const lower = path.toLowerCase()
  return extensions.some((extension) => lower.endsWith(extension))
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, index) => byte === b[index])
}

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  if (needle.length === 0) return 0
  outer: for (let start = 0; start + needle.length <= haystack.length; start++) {
    for (let offset = 0; offset < needle.length; offset++) {
      if (haystack[start + offset] !== needle[offset]) continue outer
    }
    return start
  }
  return -1
}

/** First line of a CSV without a BOM and line ending, i.e. its header row. */
export function headerLine(csv: Uint8Array): Uint8Array {
  const start = UTF8_BOM.every((byte, index) => csv[index] === byte) ? UTF8_BOM.length : 0
  let end = csv.indexOf(LINE_FEED, start)
  if (end === -1) end = csv.length
  if (end > start && csv[end - 1] === CARRIAGE_RETURN) end--
  return csv.subarray(start, end)
}

/** CSV files emitted as standalone assets. */
export function collectCsvFiles(files: readonly BuildFile[]): CsvPayload[] {
  return files
    .filter((file) => hasExtension(file.path, [CSV_EXTENSION]))
    .map((file) => ({ source: file.path, bytes: file.bytes }))
}

/** CSV-capable base64 data URIs in text files; fixtures must never be inlined this way. */
export function collectCsvDataUris(files: readonly BuildFile[]): CsvPayload[] {
  const payloads: CsvPayload[] = []
  const decoder = new TextDecoder('latin1')
  for (const file of files) {
    if (!hasExtension(file.path, TEXT_EXTENSIONS)) continue
    let uriIndex = 0
    for (const match of decoder.decode(file.bytes).matchAll(BASE64_DATA_URI)) {
      const mediaType = (match[1] ?? '').toLowerCase()
      if (!CSV_CAPABLE_MEDIA_TYPES.has(mediaType)) continue
      uriIndex++
      payloads.push({
        source: `${file.path} (data URI #${uriIndex})`,
        bytes: new Uint8Array(Buffer.from(match[3] ?? '', 'base64')),
      })
    }
  }
  return payloads
}

/**
 * The build may contain exactly the demo fixtures as standalone CSV files: every CSV file must be
 * byte-identical to a fixture, every fixture must be present, no CSV may be inlined as a data URI
 * (Vite is configured not to), and no fixture header may appear inlined in a text file
 * (that would mean CSV content was bundled as a string, e.g. via `?raw`).
 */
export function checkDist(files: readonly BuildFile[], fixtures: readonly BuildFile[]): DistCheckResult {
  const problems: string[] = []
  if (fixtures.length === 0) problems.push('No fixtures to compare against.')

  for (const dataUri of collectCsvDataUris(files)) {
    problems.push(`${dataUri.source}: CSV inlined as a data URI; CSVs must be emitted as files.`)
  }

  const payloads = collectCsvFiles(files)
  for (const payload of payloads) {
    if (!fixtures.some((fixture) => bytesEqual(fixture.bytes, payload.bytes))) {
      problems.push(`${payload.source}: CSV content does not match any demo fixture.`)
    }
  }
  for (const fixture of fixtures) {
    if (!payloads.some((payload) => bytesEqual(fixture.bytes, payload.bytes))) {
      problems.push(`Demo fixture ${fixture.path} is missing from the build.`)
    }
  }
  if (payloads.length !== fixtures.length) {
    problems.push(`Expected ${fixtures.length} CSV payloads, found ${payloads.length}.`)
  }

  const headers = fixtures.map((fixture) => headerLine(fixture.bytes)).filter((header) => header.length > 0)
  for (const file of files) {
    if (!hasExtension(file.path, TEXT_EXTENSIONS)) continue
    if (headers.some((header) => indexOfBytes(file.bytes, header) !== -1)) {
      problems.push(`${file.path}: contains a CSV header row inline.`)
    }
  }

  return { ok: problems.length === 0, payloadCount: payloads.length, problems }
}
