import { describe, expect, it } from 'vitest'
import type { CalendarDate } from '@contracts'
import { eachDay } from '../time'
import { daysTally, spreadOf, weeksOf } from './index'

// Test data only (iron rule 4).

const DAYS = eachDay({ start_date: '2026-12-06', end_date: '2026-12-15' })
const set = (...days: CalendarDate[]) => (day: CalendarDate) => days.includes(day)

describe('daysTally (D-349)', () => {
  it('splits served days into base and home, and counts the rest outside', () => {
    const serves = (day: CalendarDate) => day >= '2026-12-08'
    const home = set('2026-12-06', '2026-12-09', '2026-12-10')
    // A home day the soldier does not serve on is outside, not home.
    expect(daysTally(DAYS, serves, home)).toEqual({ served: 8, base: 6, home: 2, outside: 2 })
  })

  it('counts nothing for an empty span', () => {
    expect(daysTally([], () => true, () => true)).toEqual({ served: 0, base: 0, home: 0, outside: 0 })
  })
})

describe('spreadOf (D-349)', () => {
  it('takes the fewest, the median and the most', () => {
    expect(spreadOf([5, 1, 3])).toEqual({ min: 1, median: 3, max: 5 })
    expect(spreadOf([4, 1, 2, 8])).toEqual({ min: 1, median: 3, max: 8 })
    expect(spreadOf([2])).toEqual({ min: 2, median: 2, max: 2 })
  })

  it('has no spread for no figures', () => {
    expect(spreadOf([])).toBeNull()
  })
})

describe('weeksOf (D-349)', () => {
  it('splits by weeks from the first day of the week, partial at both ends', () => {
    // 2026-12-06 is a Sunday.
    const weeks = weeksOf(eachDay({ start_date: '2026-12-04', end_date: '2026-12-14' }), 0)
    expect(weeks.map((week) => [week[0], week.at(-1)])).toEqual([
      ['2026-12-04', '2026-12-05'],
      ['2026-12-06', '2026-12-12'],
      ['2026-12-13', '2026-12-14'],
    ])
  })

  it('has no week for no days', () => {
    expect(weeksOf([], 0)).toEqual([])
  })
})
