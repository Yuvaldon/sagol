import { describe, expect, it } from 'vitest'
import { clockAt, compareDates, compareInstants, spanCovers, spansOverlap, todayIn, windowContains } from './index'

describe('time', () => {
  it('derives today in the organization time zone', () => {
    expect(todayIn('Asia/Jerusalem', '2026-11-04T21:30:00Z')).toBe('2026-11-04')
    expect(todayIn('Asia/Jerusalem', '2026-11-04T22:30:00Z')).toBe('2026-11-05')
    expect(todayIn('UTC', '2026-11-05T01:00:00+03:00')).toBe('2026-11-04')
    expect(clockAt('Asia/Jerusalem', '2026-11-04T22:30:00Z')).toEqual({
      today: '2026-11-05',
      now: '2026-11-04T22:30:00Z',
    })
  })

  it('compares instants with different offsets as instants, not strings', () => {
    // Lexically "10:00+02:00" > "09:00Z", but it is the earlier instant.
    expect(compareInstants('2026-11-04T10:00:00+02:00', '2026-11-04T09:00:00Z')).toBe(-1)
    expect(compareInstants('2026-11-04T10:00:00+02:00', '2026-11-04T08:00:00Z')).toBe(0)
    expect(compareInstants('2026-11-04T08:00:00.500Z', '2026-11-04T08:00:00Z')).toBe(1)
  })

  it('compares calendar dates', () => {
    expect(compareDates('2026-01-31', '2026-02-01')).toBe(-1)
    expect(compareDates('2026-02-01', '2026-02-01')).toBe(0)
    expect(compareDates('2026-12-01', '2026-02-01')).toBe(1)
  })

  it('covers inclusive and open-ended spans', () => {
    const span = { valid_from: '2026-11-01', valid_to: '2026-11-10' }
    expect(spanCovers(span, '2026-11-01')).toBe(true)
    expect(spanCovers(span, '2026-11-10')).toBe(true)
    expect(spanCovers(span, '2026-10-31')).toBe(false)
    expect(spanCovers(span, '2026-11-11')).toBe(false)
    expect(spanCovers({ valid_from: '2026-11-01', valid_to: null }, '2099-01-01')).toBe(true)
  })

  it('detects overlapping spans, touching days included', () => {
    const a = { valid_from: '2026-11-01', valid_to: '2026-11-10' }
    expect(spansOverlap(a, { valid_from: '2026-11-10', valid_to: '2026-11-20' })).toBe(true)
    expect(spansOverlap(a, { valid_from: '2026-11-11', valid_to: null })).toBe(false)
    expect(spansOverlap(a, { valid_from: '2026-10-01', valid_to: null })).toBe(true)
    expect(spansOverlap({ valid_from: '2026-11-01', valid_to: null }, { valid_from: '2027-01-01', valid_to: null })).toBe(true)
  })

  it('treats instant windows as half-open', () => {
    const window = { valid_from: '2026-11-04T08:00:00Z', valid_to: '2026-11-05T08:00:00Z' }
    expect(windowContains(window, '2026-11-04T08:00:00Z')).toBe(true)
    expect(windowContains(window, '2026-11-05T07:59:59Z')).toBe(true)
    expect(windowContains(window, '2026-11-05T08:00:00Z')).toBe(false)
    expect(windowContains(window, '2026-11-04T07:59:59Z')).toBe(false)
    expect(windowContains({ ...window, valid_to: null }, '2099-01-01T00:00:00Z')).toBe(true)
  })
})
