import { CalendarDate } from '@contracts'
import { describe, expect, it } from 'vitest'
import { roundDays } from './rounds'

const day = (value: string) => CalendarDate.parse(value)
const span = (start: string, end: string) => ({ start_date: day(start), end_date: day(end) })
const EIGHT_SIX = { days_in: 8, days_home: 6 }

describe('the leave-round rhythm (D-270, D-316)', () => {
  it('repeats the days home every days in plus days home', () => {
    expect(roundDays(EIGHT_SIX, day('2026-12-09'), span('2026-12-01', '2027-01-15'))).toEqual([
      span('2026-12-09', '2026-12-14'),
      span('2026-12-23', '2026-12-28'),
      span('2027-01-06', '2027-01-11'),
    ])
  })

  it('cuts the last stretch at the end of the span', () => {
    expect(roundDays(EIGHT_SIX, day('2026-12-09'), span('2026-12-01', '2026-12-25'))).toEqual([
      span('2026-12-09', '2026-12-14'),
      span('2026-12-23', '2026-12-25'),
    ])
  })

  it('cuts a stretch that began before the span, and drops one that ended before it', () => {
    expect(roundDays(EIGHT_SIX, day('2026-11-20'), span('2026-12-05', '2026-12-20'))).toEqual([
      span('2026-12-05', '2026-12-09'),
      span('2026-12-18', '2026-12-20'),
    ])
  })

  it('plans nothing past the span or for a rhythm that is not whole positive days', () => {
    expect(roundDays(EIGHT_SIX, day('2027-02-01'), span('2026-12-01', '2027-01-15'))).toEqual([])
    expect(roundDays({ days_in: 0, days_home: 6 }, day('2026-12-01'), span('2026-12-01', '2027-01-15'))).toEqual([])
    expect(roundDays({ days_in: 8, days_home: 1.5 }, day('2026-12-01'), span('2026-12-01', '2027-01-15'))).toEqual([])
  })
})
