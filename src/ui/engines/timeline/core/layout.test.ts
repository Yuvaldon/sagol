import { describe, expect, it } from 'vitest'
import { dayOffset, gridLayout, minDayPxFor, spansOf } from './layout'

const SIZES = { nameColumnPx: 124, minDayPx: 64 }

describe('the timeline grid', () => {
  it('keeps days at their minimum on a phone, so the grid scrolls sideways', () => {
    expect(gridLayout(358, 7, SIZES)).toEqual({ nameColumnPx: 124, dayPx: 64, dayCount: 7, widthPx: 572 })
  })

  it('shares extra width between the days on a wide screen', () => {
    const layout = gridLayout(1424, 7, SIZES)
    expect(layout.dayPx).toBe(185)
    expect(layout.widthPx).toBeLessThanOrEqual(1424)
  })

  it('places each day after the name column', () => {
    const layout = gridLayout(358, 7, SIZES)
    expect(dayOffset(layout, 0)).toBe(124)
    expect(dayOffset(layout, 3)).toBe(316)
  })

  it('survives an empty window and a width not measured yet', () => {
    expect(gridLayout(0, 0, SIZES)).toEqual({ nameColumnPx: 124, dayPx: 64, dayCount: 0, widthPx: 124 })
  })
})

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

describe('minDayPxFor', () => {
  const bands = [
    { upToDays: 7, minDayPx: 64 },
    { upToDays: 31, minDayPx: 32 },
    { upToDays: 186, minDayPx: 24 },
  ]

  it('takes the first band that holds the window', () => {
    expect(minDayPxFor(1, bands)).toBe(64)
    expect(minDayPxFor(7, bands)).toBe(64)
    expect(minDayPxFor(8, bands)).toBe(32)
    expect(minDayPxFor(31, bands)).toBe(32)
    expect(minDayPxFor(120, bands)).toBe(24)
  })

  it('keeps the last band past the longest one', () => {
    expect(minDayPxFor(400, bands)).toBe(24)
  })
})
