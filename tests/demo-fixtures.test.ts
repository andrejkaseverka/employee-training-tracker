import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FIXTURES, readFixtures } from './load-fixtures.ts'

// The demo button bundles every tests/fixtures/*.csv (src/app/demo-files.ts). An extra CSV there
// would make the deployed demo fail with "table uploaded twice" while the other tests stay green.
describe('demo dataset', () => {
  it('consists of exactly the four fixture files, one per table', () => {
    const csvFiles = readdirSync(fileURLToPath(new URL('./fixtures/', import.meta.url))).filter((name) =>
      name.toLowerCase().endsWith('.csv'),
    )
    expect(csvFiles.sort()).toEqual([...FIXTURES].sort())
    expect(readFixtures().files).toHaveLength(FIXTURES.length)
  })
})
