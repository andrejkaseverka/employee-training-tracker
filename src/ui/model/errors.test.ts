import { describe, expect, it } from 'vitest'
import { safeErrorReport } from './errors.ts'

describe('safeErrorReport', () => {
  it('keeps the error type and code locations but never the message', () => {
    const error = new TypeError('Novák Jan, D001 has no department')
    error.stack = [
      'TypeError: Novák Jan, D001 has no department',
      '    at buildOverview (http://localhost/assets/index.js:1:200)',
      '    at App (http://localhost/assets/index.js:3:40)',
    ].join('\n')
    const report = safeErrorReport(error)
    expect(report).toBe(
      'TypeError\nat buildOverview (http://localhost/assets/index.js:1:200)\nat App (http://localhost/assets/index.js:3:40)',
    )
    expect(report).not.toContain('Novák')
    expect(report).not.toContain('D001')
  })

  it('handles Firefox-style stacks, missing stacks and thrown non-errors', () => {
    const firefox = new RangeError('value 1900-01-01')
    firefox.stack = 'buildOverview@http://localhost/assets/index.js:1:200\n'
    expect(safeErrorReport(firefox)).toBe('RangeError\nbuildOverview@http://localhost/assets/index.js:1:200')

    const bare = new Error('secret')
    delete bare.stack
    expect(safeErrorReport(bare)).toBe('Error')
    expect(safeErrorReport('secret string')).toBe('non-Error value thrown')
  })
})
