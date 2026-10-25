import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkDist, collectCsvDataUris, headerLine, type BuildFile } from '../scripts/dist-check/dist-check.ts'
import { FIXTURES } from './load-fixtures.ts'

const fixtures: BuildFile[] = FIXTURES.map((name) => ({
  path: name,
  bytes: new Uint8Array(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)))),
}))

const encoder = new TextEncoder()
const APP_JS: BuildFile = { path: 'assets/index.js', bytes: encoder.encode('const x = "data:e,";export{x}') }
const INDEX_HTML: BuildFile = { path: 'index.html', bytes: encoder.encode('<!doctype html><script src="assets/index.js"></script>') }

function asFiles(): BuildFile[] {
  return fixtures.map((fixture) => ({ path: `assets/${fixture.path.replace('.csv', '-abc123.csv')}`, bytes: fixture.bytes }))
}

function dataUri(bytes: Uint8Array, mediaType = 'text/csv'): string {
  return `data:${mediaType};base64,${Buffer.from(bytes).toString('base64')}`
}

function jsWith(content: string): BuildFile {
  return { path: 'assets/chunk.js', bytes: encoder.encode(`const files = [${content}];export{files}`) }
}

function tampered(fixture: BuildFile): Uint8Array {
  const bytes = new Uint8Array(fixture.bytes)
  bytes[bytes.length - 2] = 0x58 // 'X'
  return bytes
}

describe('checkDist', () => {
  it('passes when the build holds exactly the fixtures as files', () => {
    const result = checkDist([INDEX_HTML, APP_JS, ...asFiles()], fixtures)
    expect(result).toEqual({ ok: true, payloadCount: 4, problems: [] })
  })

  it('fails when the fixtures are inlined as base64 data URIs instead of files', () => {
    const uris = fixtures.map((fixture) => `"${dataUri(fixture.bytes)}"`).join(',')
    const result = checkDist([INDEX_HTML, jsWith(uris)], fixtures)
    expect(result.ok).toBe(false)
    expect(result.payloadCount).toBe(0)
    expect(result.problems).toContain('assets/chunk.js (data URI #1): CSV inlined as a data URI; CSVs must be emitted as files.')
  })

  it('fails when a CSV file differs from every fixture', () => {
    const files = asFiles()
    const first = files[0]!
    files[0] = { path: first.path, bytes: tampered(fixtures[0]!) }
    const result = checkDist([INDEX_HTML, ...files], fixtures)
    expect(result.ok).toBe(false)
    expect(result.problems).toContain(`${first.path}: CSV content does not match any demo fixture.`)
  })

  it('fails when an extra base64 CSV is bundled next to the fixtures', () => {
    const extra = encoder.encode('a;b\n1;2\n')
    const result = checkDist([INDEX_HTML, ...asFiles(), jsWith(`"${dataUri(extra, 'application/octet-stream')}"`)], fixtures)
    expect(result.ok).toBe(false)
    expect(result.problems).toEqual(['assets/chunk.js (data URI #1): CSV inlined as a data URI; CSVs must be emitted as files.'])
  })

  it('fails when no CSV is found at all', () => {
    const result = checkDist([INDEX_HTML, APP_JS], fixtures)
    expect(result.ok).toBe(false)
    expect(result.problems).toContain('Expected 4 CSV payloads, found 0.')
  })

  it('fails when CSV content is inlined as a plain string', () => {
    const raw = new TextDecoder('windows-1250').decode(fixtures[0]!.bytes)
    const result = checkDist([INDEX_HTML, ...asFiles(), jsWith(JSON.stringify(raw))], fixtures)
    expect(result.ok).toBe(false)
    expect(result.problems).toContain('assets/chunk.js: contains a CSV header row inline.')
  })

  it('never puts file content into the problems', () => {
    const files = asFiles().map((file) => ({ path: file.path, bytes: encoder.encode('secret-value;x\n') }))
    const report = checkDist(files, fixtures).problems.join('\n')
    expect(report).not.toContain('secret-value')
  })
})

describe('collectCsvDataUris', () => {
  it('ignores image and font data URIs', () => {
    const png = dataUri(new Uint8Array([1, 2, 3]), 'image/png')
    const font = dataUri(new Uint8Array([4, 5, 6]), 'font/woff2')
    expect(collectCsvDataUris([{ path: 'assets/index.css', bytes: encoder.encode(`url(${png}) url(${font})`) }])).toEqual([])
  })
})

describe('headerLine', () => {
  it('strips the BOM and the CRLF line ending', () => {
    const csv = new Uint8Array([0xef, 0xbb, 0xbf, ...encoder.encode('a;b\r\n1;2\r\n')])
    expect(new TextDecoder().decode(headerLine(csv))).toBe('a;b')
  })
})
