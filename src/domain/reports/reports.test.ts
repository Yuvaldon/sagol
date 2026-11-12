import type { CalendarDate, Timestamp, UnitId } from '@contracts'
import { describe, expect, it } from 'vitest'
import { buildUnitTree } from '../hierarchy'
import { confirmationStatus, confirmReportIssues, reportRotationOf } from '.'

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

describe('confirmationStatus', () => {
  const confirmation = { confirmed_at: at('2026-11-10T08:00:00.000Z') }

  it('is not_yet without a confirmation', () => {
    expect(confirmationStatus(null, [])).toBe('not_yet')
  })

  it('is confirmed when nothing was written after it', () => {
    expect(confirmationStatus(confirmation, [at('2026-11-10T07:59:59.000Z'), at('2026-11-10T08:00:00.000Z')])).toBe('confirmed')
  })

  it('is changed_since when a leaf was written after it, whatever the offset', () => {
    expect(confirmationStatus(confirmation, [at('2026-11-10T10:00:01+02:00')])).toBe('changed_since')
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
