import { describe, expect, it } from 'vitest'
import { gridLayout } from './layout'
import { assignLanes, badgeStart, barSpan, laneTop, rowHeightFor } from './lanes'

const SIZES = { barPx: 20, laneStepPx: 24, barInsetPx: 3 }

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

describe('bar geometry', () => {
  const layout = gridLayout(124 + 7 * 64, 7, { nameColumnPx: 124, minDayPx: 64 })

  it('grows a row by a step per extra lane, and centers the first lane', () => {
    expect(rowHeightFor(36, 1, SIZES)).toBe(36)
    expect(rowHeightFor(36, 3, SIZES)).toBe(84)
    expect(laneTop(36, 0, SIZES)).toBe(8)
    expect(laneTop(44, 1, SIZES)).toBe(36)
  })

  it('insets a bar inside its days, except on a side the window cuts', () => {
    expect(barSpan(layout, { start: 1, length: 2 }, { start: false, end: false }, SIZES)).toEqual({ startPx: 191, widthPx: 122 })
    expect(barSpan(layout, { start: 0, length: 2 }, { start: true, end: true }, SIZES)).toEqual({ startPx: 124, widthPx: 128 })
  })

  it('centers a badge in its day', () => {
    expect(badgeStart(layout, 2, SIZES)).toBe(124 + 128 + 22)
  })
})
