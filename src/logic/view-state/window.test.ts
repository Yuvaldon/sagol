import { DATE_WINDOW } from '@config'
import { DeploymentId, OrganizationId, UnitId, UnitLevelId, type Deployment } from '@contracts'
import { describe, expect, it } from 'vitest'
import { dateWindowOf, pickableRotations, rotationDays, scopeRotations, shiftedAnchor } from './window'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const AT = '2026-11-08T10:00:00.000Z'
const LEVEL = UnitLevelId.parse(uuid(90))
const BATTALION = UnitId.parse(uuid(10))
const COMPANY = UnitId.parse(uuid(11))
const PLATOON = UnitId.parse(uuid(12))
const OTHER = UnitId.parse(uuid(13))
const UNITS = [
  { id: BATTALION, parent_id: null, unit_level_id: LEVEL },
  { id: COMPANY, parent_id: BATTALION, unit_level_id: LEVEL },
  { id: PLATOON, parent_id: COMPANY, unit_level_id: LEVEL },
  { id: OTHER, parent_id: BATTALION, unit_level_id: LEVEL },
]

const rotation = (n: number, overrides: Partial<Deployment> = {}): Deployment => ({
  id: DeploymentId.parse(uuid(50 + n)),
  organization_id: OrganizationId.parse(uuid(900)),
  name: `סבב ${String(n)}`,
  unit_id: COMPANY,
  start_date: '2026-12-01',
  end_date: '2026-12-20',
  created_at: AT,
  created_by: null,
  updated_at: AT,
  updated_by: null,
  version: 1,
  archived_at: null,
  ...overrides,
})

// Wednesday, in the week of Sunday 2026-11-08.
const TODAY = '2026-11-11'

describe('the range kinds (D-211)', () => {
  it('holds today in a day, a week or a month without an anchor', () => {
    expect(dateWindowOf({ range: 'day' }, TODAY)).toMatchObject({ kind: 'day', from: TODAY, to: TODAY, followsToday: true })
    expect(dateWindowOf({}, TODAY)).toMatchObject({ kind: 'week', from: '2026-11-08', to: '2026-11-14' })
    const month = dateWindowOf({ range: 'month' }, TODAY)
    expect(month).toMatchObject({ kind: 'month', from: '2026-11-01', to: '2026-11-30', holdsToday: true })
    expect(month.days).toHaveLength(30)
  })

  it('anchors on `from`, and reads an older link`s pair as a free window', () => {
    expect(dateWindowOf({ range: 'month', from: '2027-02-14' }, TODAY)).toMatchObject({ from: '2027-02-01', to: '2027-02-28' })
    expect(dateWindowOf({ from: '2026-12-01', to: '2026-12-03' }, TODAY)).toMatchObject({ kind: 'custom', followsToday: false })
  })

  it('shows a rotation by its days, and falls back to the week for one it does not know', () => {
    const winter = rotation(1)
    expect(dateWindowOf({ range: 'rotation', rotation: winter.id }, TODAY, [winter])).toMatchObject({
      kind: 'rotation',
      from: '2026-12-01',
      to: '2026-12-20',
      rotationId: winter.id,
      holdsToday: false,
    })
    expect(dateWindowOf({ range: 'rotation', rotation: winter.id }, TODAY, [])).toMatchObject({ kind: 'week', rotationId: null })
  })

  it('caps a long or open rotation at the longest window', () => {
    const open = rotationDays({ start_date: '2026-01-01', end_date: null })
    expect(dateWindowOf({ range: 'rotation', rotation: rotation(2).id }, TODAY, [rotation(2, { start_date: '2026-01-01', end_date: null })]).days).toHaveLength(
      DATE_WINDOW.maxDays,
    )
    expect(open.from).toBe('2026-01-01')
    expect(rotationDays({ start_date: '2026-01-01', end_date: '2026-01-05' }).to).toBe('2026-01-05')
  })

  it('steps a day, a week or a month', () => {
    expect(shiftedAnchor('day', TODAY, 1)).toBe('2026-11-12')
    expect(shiftedAnchor('week', '2026-11-08', -1)).toBe('2026-11-01')
    expect(shiftedAnchor('month', '2027-01-31', 1)).toBe('2027-02-01')
    expect(shiftedAnchor('month', '2027-01-01', -1)).toBe('2026-12-01')
  })
})

describe('the rotations in scope (D-211)', () => {
  const company = rotation(1, { unit_id: COMPANY, start_date: '2026-12-01' })
  const battalion = rotation(2, { unit_id: BATTALION, start_date: '2026-10-01', end_date: '2026-11-01' })
  const platoon = rotation(3, { unit_id: PLATOON, start_date: '2026-11-20', end_date: null })
  const other = rotation(4, { unit_id: OTHER })
  const archived = rotation(5, { archived_at: AT })
  const all = [company, battalion, platoon, other, archived]

  it('holds the live rotations of the unit, above it and below it, by start', () => {
    expect(scopeRotations(all, UNITS, COMPANY).map((row) => row.id)).toEqual([battalion.id, platoon.id, company.id])
    expect(scopeRotations(all, UNITS, null)).toHaveLength(4)
  })

  it('offers those running or still to come', () => {
    expect(pickableRotations(scopeRotations(all, UNITS, COMPANY), TODAY).map((row) => row.id)).toEqual([platoon.id, company.id])
  })
})
