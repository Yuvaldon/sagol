import { CalendarDate, UnitId } from '@contracts'
import { describe, expect, it } from 'vitest'
import { blankQuickEntryRow, isBlankQuickEntryRow, quickEntryIssues, quickEntryRowsFromPaste, readyQuickEntryRows } from './quickEntry'

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
