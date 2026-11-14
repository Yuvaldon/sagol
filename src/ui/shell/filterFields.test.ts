import { describe, expect, it } from 'vitest'
import { decimalOf } from './filterFields'

describe('a typed number (D-380)', () => {
  it('reads a plain decimal, signed or not, with spaces around it', () => {
    expect(decimalOf('5')).toBe(5)
    expect(decimalOf(' -2.5 ')).toBe(-2.5)
  })

  it('reads no other notation, so the field never shows one value and filters by another', () => {
    for (const raw of ['1e3', '0x1A', '0b11', 'Infinity', '', ' ', '5.', '.5', '1,000']) expect(decimalOf(raw)).toBeNull()
  })
})
