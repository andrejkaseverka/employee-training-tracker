// Verifies that the build output contains no data except the synthetic demo fixtures.
// Usage: `npm run build && npm run check:dist`. Exits with 1 on any problem.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkDist, type BuildFile } from './dist-check/dist-check.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST_DIR = join(ROOT, 'dist')
const FIXTURES_DIR = join(ROOT, 'tests', 'fixtures')

function readTree(dir: string): BuildFile[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const fullPath = join(entry.parentPath, entry.name)
      return { path: relative(dir, fullPath).split(sep).join('/'), bytes: new Uint8Array(readFileSync(fullPath)) }
    })
}

function main(): number {
  const files = readTree(DIST_DIR)
  const fixtures = readTree(FIXTURES_DIR).filter((file) => file.path.toLowerCase().endsWith('.csv'))
  const result = checkDist(files, fixtures)

  process.stdout.write(
    `check:dist – ${files.length} files scanned, ${result.payloadCount} CSV payloads, ${fixtures.length} demo fixtures.\n`,
  )
  if (result.ok) {
    process.stdout.write('OK: the build contains only the demo fixtures.\n')
    return 0
  }
  for (const problem of result.problems) process.stderr.write(`FAIL: ${problem}\n`)
  return 1
}

process.exitCode = main()
