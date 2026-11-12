import { describe, expect, it } from 'vitest'
import { addMonths, endOfMonth, startOfMonth } from './index'

describe('months', () => {
  it('finds the first and last day of the month', () => {
    expect(startOfMonth('2026-11-12')).toBe('2026-11-01')
    expect(endOfMonth('2026-11-12')).toBe('2026-11-30')
    expect(endOfMonth('2028-02-03')).toBe('2028-02-29')
    expect(endOfMonth('2026-12-31')).toBe('2026-12-31')
  })

  it('moves by whole months and keeps to the end of a shorter month', () => {
    expect(addMonths('2026-11-01', 1)).toBe('2026-12-01')
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01')
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-03-01', -3)).toBe('2025-12-01')
  })
})
