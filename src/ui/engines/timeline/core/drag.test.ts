import { describe, expect, it } from 'vitest'
import { dayAt, draggedRange, edgeStep, grabOf, inlineOffset, isOnDays, isPastThreshold, rangeInWindow, sameRange } from './drag'
import { gridLayout } from './layout'

// 124 px of names, then seven days of 64 px: day 0 is 124–187, day 6 is 508–571.
const layout = gridLayout(358, 7, { nameColumnPx: 124, minDayPx: 64 })

describe('where a pointer is (D-143)', () => {
  it('measures from the inline start, the right edge in RTL', () => {
    const box = { left: 100, right: 700 }
    expect(inlineOffset(650, box, true)).toBe(50)
    expect(inlineOffset(650, box, false)).toBe(550)
  })

  it('tells the days apart from the name column and the space after the last day', () => {
    expect(isOnDays(layout, 123)).toBe(false)
    expect(isOnDays(layout, 124)).toBe(true)
    expect(isOnDays(layout, 571)).toBe(true)
    expect(isOnDays(layout, 572)).toBe(false)
  })

  it('finds the day under it, and counts a pointer past either end as the first or the last day', () => {
    expect(dayAt(layout, 124)).toBe(0)
    expect(dayAt(layout, 200)).toBe(1)
    expect(dayAt(layout, 571)).toBe(6)
    expect(dayAt(layout, 20)).toBe(0)
    expect(dayAt(layout, 9000)).toBe(6)
  })

  it('starts a drag only past the threshold', () => {
    expect(isPastThreshold(3, 2, 4)).toBe(false)
    expect(isPastThreshold(0, -4, 4)).toBe(true)
  })
})

describe('what a press grabs (D-143)', () => {
  const both = { start: true, end: true }

  it('takes an end of a bar by its handle, and the body anywhere else', () => {
    expect(grabOf(3, 122, 8, both)).toBe('start')
    expect(grabOf(60, 122, 8, both)).toBe('move')
    expect(grabOf(118, 122, 8, both)).toBe('end')
  })

  it('never grabs an end the window cuts, nor one of a mark that does not resize', () => {
    expect(grabOf(3, 122, 8, { start: false, end: true })).toBe('move')
    expect(grabOf(118, 122, 8, { start: false, end: false })).toBe('move')
  })

  it('keeps a narrow mark mostly body', () => {
    expect(grabOf(6, 20, 8, both)).toBe('move')
    expect(grabOf(4, 20, 8, both)).toBe('start')
  })
})

describe('the range a drag leaves (D-143)', () => {
  const origin = { start: 2, end: 4 }

  it('moves both ends by the days the pointer crossed, also past the window', () => {
    expect(draggedRange('move', origin, 3, 5)).toEqual({ start: 4, end: 6 })
    expect(draggedRange('move', { start: -2, end: 1 }, 1, 2)).toEqual({ start: -1, end: 2 })
  })

  it('moves one end and keeps at least one day', () => {
    expect(draggedRange('start', origin, 2, 0)).toEqual({ start: 0, end: 4 })
    expect(draggedRange('start', origin, 2, 6)).toEqual({ start: 4, end: 4 })
    expect(draggedRange('end', origin, 4, 6)).toEqual({ start: 2, end: 6 })
    expect(draggedRange('end', origin, 4, 0)).toEqual({ start: 2, end: 2 })
  })

  it('marks the days between the press and the pointer, in order, for a new item', () => {
    expect(draggedRange('create', origin, 5, 3)).toEqual({ start: 3, end: 5 })
    expect(draggedRange('create', origin, 1, 1)).toEqual({ start: 1, end: 1 })
  })

  it('compares ranges by their days', () => {
    expect(sameRange({ start: 1, end: 2 }, { start: 1, end: 2 })).toBe(true)
    expect(sameRange({ start: 1, end: 2 }, { start: 1, end: 3 })).toBe(false)
  })

  it('paints only the part in the window, with the cut sides', () => {
    expect(rangeInWindow({ start: -2, end: 1 }, 7)).toEqual({ start: 0, length: 2, cut: { start: true, end: false } })
    expect(rangeInWindow({ start: 5, end: 9 }, 7)).toEqual({ start: 5, length: 2, cut: { start: false, end: true } })
    expect(rangeInWindow({ start: 8, end: 9 }, 7)).toBeNull()
  })
})

describe('scrolling at the edge (D-143)', () => {
  it('scrolls toward the edge the pointer is near, faster deeper in, and not at all in the middle', () => {
    expect(edgeStep(300, 124, 412, 40, 12)).toBe(0)
    expect(edgeStep(130, 124, 412, 40, 12)).toBe(-11)
    expect(edgeStep(100, 124, 412, 40, 12)).toBe(-12)
    expect(edgeStep(402, 124, 412, 40, 12)).toBe(9)
    expect(edgeStep(500, 124, 412, 40, 12)).toBe(12)
  })
})
