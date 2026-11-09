import { describe, expect, it } from 'vitest'
import { optionalText, withOptionalText } from './index'

describe('optional text (D-101)', () => {
  it('stores blank text as NULL and keeps the rest as typed', () => {
    expect(optionalText('')).toBeNull()
    expect(optionalText('   ')).toBeNull()
    expect(optionalText('\t\n')).toBeNull()
    expect(optionalText(null)).toBeNull()
    expect(optionalText(' בן ')).toBe(' בן ')
  })

  it('applies to the listed columns only, and leaves absent ones absent', () => {
    const row = { nickname: '  ', reason: 'משפחה', title: '' }
    expect(withOptionalText(row, ['nickname', 'reason'])).toEqual({ nickname: null, reason: 'משפחה', title: '' })
    const partial: { nickname?: string | null; reason?: string | null } = { reason: ' ' }
    const next = withOptionalText(partial, ['nickname', 'reason'])
    expect(next).toEqual({ reason: null })
    expect('nickname' in next).toBe(false)
  })

  it('does not change the row it was given', () => {
    const row = { nickname: '' }
    withOptionalText(row, ['nickname'])
    expect(row.nickname).toBe('')
  })
})
