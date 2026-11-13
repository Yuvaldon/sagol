import { describe, expect, it } from 'vitest'
import { asResult, fail, parsedRow, rowRejectionOf } from './failure'

describe('a stored row the contracts reject (D-346)', () => {
  it('answers internal, and keeps the table and issue paths beside the answer, without the values', async () => {
    const secret = 'not-a-uuid-secret'
    const result = await asResult(async () => parsedRow('units', { id: secret }))
    expect(result).toEqual({ ok: false, error: { code: 'internal' } })
    if (result.ok) return
    const rejection = rowRejectionOf(result.error)
    expect(rejection?.table).toBe('units')
    expect(rejection?.paths).toContain('id')
    expect(new Set(rejection?.paths).size).toBe(rejection?.paths.length)
    expect(JSON.stringify(result)).not.toContain(secret)
    expect(JSON.stringify(rejection)).not.toContain(secret)
  })

  it('keeps the rejection when a nested call passes its failure on', async () => {
    const inner = await asResult(async () => parsedRow('units', {}))
    const outer = await asResult(async () => (inner.ok ? inner.value : fail(inner.error)))
    expect(outer.ok ? undefined : rowRejectionOf(outer.error)?.table).toBe('units')
  })

  it('has no rejection for any other failure', async () => {
    const other = await asResult(async () => {
      throw new Error('boom')
    })
    expect(other.ok ? 'ok' : rowRejectionOf(other.error)).toBeUndefined()
  })
})
