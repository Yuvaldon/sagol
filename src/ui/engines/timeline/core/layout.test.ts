import { describe, expect, it } from 'vitest'
import { spansOf } from './layout'

describe('runs of days', () => {
  it('finds each run of the wanted flag', () => {
    const flags = [false, false, true, true, false, true, false]
    expect(spansOf(flags, false)).toEqual([
      { start: 0, length: 2 },
      { start: 4, length: 1 },
      { start: 6, length: 1 },
    ])
    expect(spansOf(flags, true)).toEqual([
      { start: 2, length: 2 },
      { start: 5, length: 1 },
    ])
  })

  it('is empty when no day has the flag, and one run when all do', () => {
    expect(spansOf([true, true], false)).toEqual([])
    expect(spansOf([true, true], true)).toEqual([{ start: 0, length: 2 }])
  })
})
