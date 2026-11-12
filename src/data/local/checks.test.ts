import { describe, expect, it } from 'vitest'
import { colorKeyIssues, leaveTypeColorIssues } from './checks'

describe('color key checks', () => {
  it('takes any palette key for an entity that is not a leave type', () => {
    expect(colorKeyIssues(null, 'green')).toEqual([])
    expect(colorKeyIssues(null, 'nope')).toHaveLength(1)
  })

  it('refuses a new green for a leave type, and keeps one it held before (D-290)', () => {
    expect(leaveTypeColorIssues(null, 'green')).toHaveLength(1)
    expect(leaveTypeColorIssues('blue', 'lime')).toHaveLength(1)
    expect(leaveTypeColorIssues('green', 'green')).toEqual([])
    expect(leaveTypeColorIssues(null, 'blue')).toEqual([])
  })
})
