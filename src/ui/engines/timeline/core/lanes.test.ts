import { describe, expect, it } from 'vitest'
import { assignLanes } from './lanes'

describe('lanes (D-111)', () => {
  it('keeps items that do not overlap in one lane', () => {
    expect(assignLanes([{ start: 0, length: 2 }, { start: 2, length: 3 }, { start: 6, length: 1 }])).toEqual({
      lanes: [0, 0, 0],
      count: 1,
    })
  })

  it('gives an overlapping item the first free lane, and reuses a lane once it is free', () => {
    const { lanes, count } = assignLanes([
      { start: 0, length: 4 },
      { start: 1, length: 2 },
      { start: 2, length: 1 },
      { start: 4, length: 2 },
      { start: 3, length: 1 },
    ])
    expect(lanes).toEqual([0, 1, 2, 0, 1])
    expect(count).toBe(3)
  })

  it('puts the longer item first on the same start, whatever the input order', () => {
    expect(assignLanes([{ start: 1, length: 1 }, { start: 1, length: 5 }]).lanes).toEqual([1, 0])
  })

  it('needs one lane for an empty row', () => {
    expect(assignLanes([])).toEqual({ lanes: [], count: 1 })
  })
})
