import { describe, expect, it } from 'vitest'
import { daysFrom, isBeforeDay, monthSpan, selectDay, selectionCovers, weeksOf } from './calendar'

describe('the day math of Today', () => {
  it('lists the days from a day on, across a month end', () => {
    expect(daysFrom('2026-11-29', 3)).toEqual(['2026-11-29', '2026-11-30', '2026-12-01'])
  })

  it('gives a whole month by its distance from the month of a day', () => {
    expect(monthSpan('2026-11-18', 0)).toEqual({ first: '2026-11-01', days: 30 })
    expect(monthSpan('2026-11-18', 2)).toEqual({ first: '2027-01-01', days: 31 })
    expect(monthSpan('2026-03-31', -1)).toEqual({ first: '2026-02-01', days: 28 })
  })

  it('cuts days into weeks that start on Sunday and pads both ends', () => {
    // 2026-12-01 is a Tuesday.
    const weeks = weeksOf(daysFrom('2026-12-01', 31).map((date) => ({ date })))
    expect(weeks).toHaveLength(5)
    expect(weeks[0]).toEqual([null, null, { date: '2026-12-01' }, { date: '2026-12-02' }, { date: '2026-12-03' }, { date: '2026-12-04' }, { date: '2026-12-05' }])
    expect(weeks[4]?.slice(5)).toEqual([null, null])
    expect(weeksOf([])).toEqual([])
  })

  it('starts a selection, stretches it either way, and starts over after a range', () => {
    const one = selectDay(null, '2026-11-20')
    expect(one).toEqual({ start: '2026-11-20', end: '2026-11-20' })
    expect(selectDay(one, '2026-11-23')).toEqual({ start: '2026-11-20', end: '2026-11-23' })
    expect(selectDay(one, '2026-11-18')).toEqual({ start: '2026-11-18', end: '2026-11-20' })
    expect(selectDay(one, '2026-11-20')).toBeNull()
    expect(selectDay({ start: '2026-11-18', end: '2026-11-20' }, '2026-11-25')).toEqual({ start: '2026-11-25', end: '2026-11-25' })
  })

  it('knows the days a selection covers', () => {
    const selection = { start: '2026-11-29', end: '2026-12-02' }
    expect(selectionCovers(selection, '2026-11-30')).toBe(true)
    expect(selectionCovers(selection, '2026-12-03')).toBe(false)
    expect(selectionCovers(null, '2026-11-30')).toBe(false)
  })

  it('tells a day that has passed', () => {
    expect(isBeforeDay('2026-11-17', '2026-11-18')).toBe(true)
    expect(isBeforeDay('2026-11-18', '2026-11-18')).toBe(false)
  })
})
