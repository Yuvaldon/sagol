import type { CalendarDate, Timestamp, UnitId } from '@contracts'
import { describe, expect, it } from 'vitest'
import { buildUnitTree } from '../hierarchy'
import {
  confirmationStatus,
  confirmReportIssues,
  leaveChangedSince,
  reportRotationOf,
  sectionChangedSince,
  type LeaveChanges,
  type SectionChanges,
} from '.'

// The daily report's status and when it may be confirmed (D-293). Sample rows, test file only.

const at = (value: string) => value as Timestamp
const day = (value: string) => value as CalendarDate
const BATTALION = '0a1b2c3d-1111-4aaa-8aaa-000000000001' as UnitId
const COMPANY = '0a1b2c3d-1111-4aaa-8aaa-000000000002' as UnitId
const OTHER = '0a1b2c3d-1111-4aaa-8aaa-000000000003' as UnitId
const tree = buildUnitTree([
  { id: BATTALION, parent_id: null, unit_level_id: null as never },
  { id: COMPANY, parent_id: BATTALION, unit_level_id: null as never },
  { id: OTHER, parent_id: null, unit_level_id: null as never },
])
const rotation = { unit_id: BATTALION, start_date: day('2026-11-01'), end_date: day('2026-11-20'), archived_at: null, closed_at: null }

describe('confirmationStatus and sectionChangedSince (D-373)', () => {
  const DATE = day('2026-11-10')
  const at10 = at('2026-11-09T10:00:00.000Z')
  const at11 = at('2026-11-09T11:00:00.000Z')
  const NONE: SectionChanges = { leaves: [], memberships: [] }
  const dates = (start_date: string, end_date: string) => ({ start_date: day(start_date), end_date: day(end_date) })
  const moved = (from: [string, string], seq: number, created_at = at10) => ({
    change_seq: seq,
    created_at,
    changes: { start_date: { before: from[0], after: null }, end_date: { before: from[1], after: null } },
  })
  const approved = (seq: number, created_at = at10) => ({ change_seq: seq, created_at, changes: {} })
  const only = (leave: LeaveChanges): SectionChanges => ({ leaves: [leave], memberships: [] })

  it('is not_yet without a confirmation, and confirmed with nothing after it', () => {
    expect(confirmationStatus(null, NONE, DATE)).toBe('not_yet')
    expect(confirmationStatus({ seen_seq: 0 }, NONE, DATE)).toBe('confirmed')
  })

  it('counts an event after seen_seq on a leave that touches the day or its neighbors, and none at or before it', () => {
    const leave = { leave: { ...dates('2026-11-11', '2026-11-14'), updated_at: at10 }, events: [approved(5)] }
    expect(confirmationStatus({ seen_seq: 4 }, only(leave), DATE)).toBe('changed_since')
    expect(confirmationStatus({ seen_seq: 5 }, only(leave), DATE)).toBe('confirmed')
    const far = { leave: { ...dates('2026-11-12', '2026-11-14'), updated_at: at10 }, events: [approved(5)] }
    expect(confirmationStatus({ seen_seq: 4 }, only(far), DATE)).toBe('confirmed')
  })

  it('counts a leave moved wholly off the day, read back through the before-values (OI-254)', () => {
    const offDay = {
      leave: { ...dates('2026-11-20', '2026-11-22'), updated_at: at10 },
      events: [moved(['2026-11-09', '2026-11-10'], 7)],
    }
    expect(leaveChangedSince(offDay, DATE, 6)).toBe(true)
    expect(leaveChangedSince(offDay, DATE, 7)).toBe(false)
  })

  it('walks back only through the events after seen_seq', () => {
    const leave = {
      leave: { ...dates('2026-11-20', '2026-11-22'), updated_at: at11 },
      events: [moved(['2026-11-25', '2026-11-26'], 9, at11), moved(['2026-11-10', '2026-11-10'], 3)],
    }
    expect(leaveChangedSince(leave, DATE, 8)).toBe(false)
    expect(leaveChangedSince(leave, DATE, 2)).toBe(true)
  })

  it('counts a leave written after its events were read: its walk back is not whole', () => {
    const stale = { leave: { ...dates('2026-11-20', '2026-11-22'), updated_at: at11 }, events: [approved(5, at10)] }
    expect(leaveChangedSince(stale, DATE, 5)).toBe(true)
    expect(leaveChangedSince({ ...stale, events: [] }, DATE, 0)).toBe(false)
  })

  it('counts a membership in the unit written after seen_seq that starts on or before the day (OI-254)', () => {
    const joined = (valid_from: string, change_seq: number): SectionChanges => ({
      leaves: [],
      memberships: [{ valid_from: day(valid_from), change_seq }],
    })
    expect(sectionChangedSince(joined('2026-11-10', 4), DATE, 3)).toBe(true)
    expect(sectionChangedSince(joined('2026-11-01', 4), DATE, 4)).toBe(false)
    expect(sectionChangedSince(joined('2026-11-11', 4), DATE, 3)).toBe(false)
  })
})

describe('reportRotationOf and confirmReportIssues', () => {
  it('finds the rotation of the unit or a unit above it on its days', () => {
    expect(reportRotationOf([rotation], tree, COMPANY, day('2026-11-05'))).toBe(rotation)
    expect(reportRotationOf([rotation], tree, BATTALION, day('2026-11-20'))).toBe(rotation)
  })

  it('finds none outside its days, for another unit, or archived', () => {
    expect(reportRotationOf([rotation], tree, COMPANY, day('2026-11-21'))).toBeNull()
    expect(reportRotationOf([rotation], tree, OTHER, day('2026-11-05'))).toBeNull()
    expect(reportRotationOf([{ ...rotation, archived_at: at('2026-11-02T00:00:00.000Z') }], tree, COMPANY, day('2026-11-05'))).toBeNull()
  })

  it('refuses a day without a rotation and a closed rotation', () => {
    expect(confirmReportIssues(null)).toEqual([{ path: ['report_date'], code: 'not_reportable' }])
    expect(confirmReportIssues({ ...rotation, closed_at: at('2026-11-21T00:00:00.000Z') })).toEqual([
      { path: ['report_date'], code: 'rotation_closed' },
    ])
    expect(confirmReportIssues(rotation)).toEqual([])
  })
})
