import { CalendarDate, UnitId } from '@contracts'
import { describe, expect, it } from 'vitest'
import { blankQuickEntryRow, isBlankQuickEntryRow, offeredColumns, quickEntryIssues, quickEntryRowsFromPaste, readyQuickEntryRows } from './quickEntry'

// Test data only (iron rule 4).
const PLACEMENT = {
  unit_id: UnitId.parse('00000000-0000-4000-8000-000000000001'),
  valid_from: CalendarDate.parse('2026-11-12'),
}
const LABELS = {
  first_name: 'שם פרטי',
  last_name: 'שם משפחה',
  nickname: 'כינוי',
  personal_id: 'מספר אישי',
  phone: 'טלפון',
  invite_email: 'דוא"ל',
} as const

function row(first: string, last: string, personalId: string) {
  const blank = blankQuickEntryRow()
  return { ...blank, values: { ...blank.values, first_name: first, last_name: last, personal_id: personalId } }
}

describe('the quick entry (D-282)', () => {
  it('reads pasted rows into the grid, with blank cells for missing columns', () => {
    const read = quickEntryRowsFromPaste('מספר אישי\tשם פרטי\n123\tדנה\n\n456\tיוסי', LABELS)
    if (!read.ok) throw new Error('unreadable')
    expect(read.rows.map((entry) => [entry.values.personal_id, entry.values.first_name, entry.values.last_name])).toEqual([
      ['123', 'דנה', ''],
      ['456', 'יוסי', ''],
    ])
    expect(new Set(read.rows.map((entry) => entry.key)).size).toBe(2)
  })

  it('checks typed rows on the new-soldier form and passes blank rows by', () => {
    const blank = blankQuickEntryRow()
    const missing = row('דנה', '', '1')
    const good = row('דנה', 'לוי', '2')
    expect(isBlankQuickEntryRow(blank)).toBe(true)
    const issues = quickEntryIssues([blank, missing, good], PLACEMENT)
    expect(issues.has(blank.key)).toBe(false)
    expect(issues.get(missing.key)).toContainEqual({ path: ['last_name'], code: 'required' })
    expect(issues.get(good.key)).toEqual([])
    expect(readyQuickEntryRows([blank, missing, good], PLACEMENT)).toEqual([good])
  })

  it('marks both rows that repeat a personal number', () => {
    const first = row('דנה', 'לוי', ' 7 ')
    const second = row('יוסי', 'כהן', '7')
    const other = row('רון', 'מזרחי', '8')
    const issues = quickEntryIssues([first, second, other], PLACEMENT)
    const duplicate = { path: ['private', 'personal_id'], code: 'duplicate_item' }
    expect(issues.get(first.key)).toContainEqual(duplicate)
    expect(issues.get(second.key)).toContainEqual(duplicate)
    expect(issues.get(other.key)).toEqual([])
    expect(readyQuickEntryRows([first, second, other], PLACEMENT)).toEqual([other])
  })
})

describe('a list where private details may not be added (D-482)', () => {
  const LABELS = { first_name: 'שם פרטי', last_name: 'שם משפחה', nickname: 'כינוי', personal_id: 'מספר אישי', phone: 'טלפון', invite_email: 'דוא״ל' }
  it('takes names, and refuses a list that holds a personal number, naming the column', () => {
    expect(quickEntryRowsFromPaste('יעל\tשחר', LABELS, offeredColumns(false)).ok).toBe(true)
    expect(quickEntryRowsFromPaste('יעל\tשחר\t\t8000001', LABELS, offeredColumns(false))).toEqual({
      ok: false,
      problem: { kind: 'column_not_offered', column: 'personal_id' },
    })
    expect(quickEntryRowsFromPaste('יעל\tשחר\t\t8000001', LABELS, offeredColumns(true)).ok).toBe(true)
  })
})

describe('repeats in the grid (D-066, D-482)', () => {
  const PLACED = { unit_id: UnitId.parse('00000000-0000-4000-8000-000000000001'), valid_from: CalendarDate.parse('2026-11-27') }
  const row = (values: Partial<Record<'first_name' | 'last_name' | 'personal_id' | 'invite_email', string>>) => {
    const blank = blankQuickEntryRow()
    return { ...blank, values: { ...blank.values, first_name: 'א', last_name: 'ב', ...values } }
  }
  it('marks a personal number repeated in another form, and an email repeated in another case', () => {
    const one = row({ personal_id: '0123-45', invite_email: 'Yael@Example.test' })
    const two = row({ personal_id: '12345', invite_email: ' yael@example.test' })
    const issues = quickEntryIssues([one, two], PLACED)
    for (const key of [one.key, two.key]) {
      expect(issues.get(key)).toEqual(
        expect.arrayContaining([
          { path: ['private', 'personal_id'], code: 'duplicate_item' },
          { path: ['private', 'invite_email'], code: 'duplicate_item' },
        ]),
      )
    }
  })
  it('sends and checks no private detail where the actor may not set one', () => {
    const one = row({ personal_id: '12345' })
    const two = row({ personal_id: '12345' })
    const issues = quickEntryIssues([one, two], { ...PLACED, private_allowed: false })
    expect(issues.get(one.key)).toEqual([])
    expect(readyQuickEntryRows([one, two], { ...PLACED, private_allowed: false })).toHaveLength(2)
  })
})
