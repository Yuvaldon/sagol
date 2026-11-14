import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, millisecondsUntil, millisecondsUntilNextDay, startOfDay, startOfHour, startOfWeek, weekdayOf } from './index'

const HOUR_MS = 3_600_000

describe('weeks and days', () => {
  it('moves by days across months and years', () => {
    expect(addDays('2026-11-29', 3)).toBe('2026-12-02')
    expect(addDays('2027-01-02', -7)).toBe('2026-12-26')
    expect(daysBetween('2026-11-08', '2026-11-14')).toBe(6)
    expect(daysBetween('2026-11-14', '2026-11-08')).toBe(-6)
    expect(daysBetween('2026-11-08', '2026-11-08')).toBe(0)
  })

  it('numbers weekdays from Sunday, before and after the anchor', () => {
    expect(weekdayOf('2026-11-08')).toBe(0)
    expect(weekdayOf('2026-11-14')).toBe(6)
    expect(weekdayOf('1969-12-31')).toBe(3)
  })

  it('finds the start of the week for any first day', () => {
    expect(startOfWeek('2026-11-11', 0)).toBe('2026-11-08')
    expect(startOfWeek('2026-11-08', 0)).toBe('2026-11-08')
    expect(startOfWeek('2026-11-14', 0)).toBe('2026-11-08')
    expect(startOfWeek('2026-11-08', 1)).toBe('2026-11-02')
    expect(startOfWeek('2027-01-01', 0)).toBe('2026-12-27')
  })

  it('counts the time left until the next day in the time zone', () => {
    expect(millisecondsUntilNextDay('Asia/Jerusalem', '2026-11-09T21:30:00Z')).toBe(HOUR_MS / 2)
    expect(millisecondsUntilNextDay('UTC', '2026-11-09T00:00:00Z')).toBe(24 * HOUR_MS)
    // The night the clocks move back in Israel lasts 25 hours.
    expect(millisecondsUntilNextDay('Asia/Jerusalem', '2026-10-24T21:00:00Z')).toBe(25 * HOUR_MS)
  })

  it('counts the time between two instants, whatever their offsets', () => {
    expect(millisecondsUntil('2026-11-09T21:00:00Z', '2026-11-10T00:00:00+02:00')).toBe(HOUR_MS)
    expect(millisecondsUntil('2026-11-10T00:00:00Z', '2026-11-09T23:00:00Z')).toBe(-HOUR_MS)
  })

  it('names the instant a day starts in a time zone', () => {
    expect(startOfDay('2026-11-10', 'Asia/Jerusalem')).toBe('2026-11-09T22:00:00.000Z')
    expect(startOfDay('2026-07-10', 'Asia/Jerusalem')).toBe('2026-07-09T21:00:00.000Z')
    expect(startOfDay('2026-11-10', 'UTC')).toBe('2026-11-10T00:00:00.000Z')
  })

  it('names the instant an hour of a day starts in a time zone (D-443)', () => {
    expect(startOfHour('2026-11-10', 18, 'Asia/Jerusalem')).toBe('2026-11-10T16:00:00.000Z')
    expect(startOfHour('2026-07-10', 18, 'Asia/Jerusalem')).toBe('2026-07-10T15:00:00.000Z')
    expect(startOfHour('2026-11-10', 0, 'UTC')).toBe('2026-11-10T00:00:00.000Z')
  })
})
