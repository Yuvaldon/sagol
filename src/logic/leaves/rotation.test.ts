import { DeploymentId, OrganizationId, SoldierId, UnitId, UnitLevelId, type Deployment } from '@contracts'
import { createRotationMembership } from '@domain'
import { describe, expect, it } from 'vitest'
import { requestRotation } from './rotation'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const AT = '2026-11-08T10:00:00.000Z'
const LEVEL = UnitLevelId.parse(uuid(80))
const COMPANY = UnitId.parse(uuid(10))
const PLATOON = UnitId.parse(uuid(11))
const OTHER = UnitId.parse(uuid(12))
const DANA = SoldierId.parse(uuid(1))
const GAL = SoldierId.parse(uuid(3))
const HILA = SoldierId.parse(uuid(4))

const rotation = (n: number, overrides: Partial<Deployment> = {}): Deployment => ({
  id: DeploymentId.parse(uuid(n)),
  organization_id: OrganizationId.parse(uuid(90)),
  name: 'סבב חורף',
  unit_id: COMPANY,
  start_date: '2026-12-01',
  end_date: '2026-12-31',
  closed_at: null,
  closed_by: null,
  created_at: AT,
  created_by: null,
  updated_at: AT,
  updated_by: null,
  version: 1,
  archived_at: null,
  report_owner_id: null,
  ...overrides,
})
const WHOLE = rotation(70)
const LISTED = rotation(71, { start_date: '2026-11-01' })
const placed = (soldier_id: SoldierId, unit_id: UnitId, valid_from: string, valid_to: string | null) => ({ soldier_id, unit_id, valid_from, valid_to })
/** Dana in the company's platoon, Gal in another unit, Hila in the platoon from mid-December; Gal is listed in the other rotation. */
const MEMBERSHIP = createRotationMembership({
  units: [
    { id: COMPANY, parent_id: null, unit_level_id: LEVEL },
    { id: PLATOON, parent_id: COMPANY, unit_level_id: LEVEL },
    { id: OTHER, parent_id: null, unit_level_id: LEVEL },
  ],
  unit_memberships: [placed(DANA, PLATOON, '2026-01-01', null), placed(GAL, OTHER, '2026-01-01', null), placed(HILA, PLATOON, '2026-12-15', null)],
  deployment_members: [{ deployment_id: LISTED.id, soldier_id: GAL, start_date: null, end_date: null }],
})
const days = (start_date: string, end_date: string) => ({ start_date, end_date })

describe('the rotation a request belongs to (D-216, D-336)', () => {
  it("places a soldier of the unit, or below it, in the whole unit's rotation", () => {
    expect(requestRotation([WHOLE], MEMBERSHIP, [DANA], days('2026-12-03', '2026-12-05'))).toEqual({ deployment_id: WHOLE.id, issues: [] })
  })

  it('refuses a whole-unit rotation to a soldier outside its unit (OI-292)', () => {
    expect(requestRotation([WHOLE], MEMBERSHIP, [GAL], days('2026-12-03', '2026-12-05'))).toEqual({
      deployment_id: null,
      issues: [{ path: ['soldier_id'], code: 'not_a_member' }],
    })
    expect(requestRotation([WHOLE, LISTED], MEMBERSHIP, [GAL], days('2026-12-03', '2026-12-05'))).toEqual({ deployment_id: LISTED.id, issues: [] })
  })

  it("refuses the days before the soldier's membership in the unit (OI-292)", () => {
    expect(requestRotation([WHOLE], MEMBERSHIP, [HILA], days('2026-12-10', '2026-12-17'))).toEqual({
      deployment_id: null,
      issues: [{ path: ['soldier_id'], code: 'not_a_member' }],
    })
    expect(requestRotation([WHOLE], MEMBERSHIP, [HILA], days('2026-12-15', '2026-12-17')).deployment_id).toBe(WHOLE.id)
  })

  it('answers nothing on incomplete dates or no soldier', () => {
    expect(requestRotation([WHOLE], MEMBERSHIP, [], days('2026-12-03', '2026-12-05'))).toEqual({ deployment_id: null, issues: [] })
    expect(requestRotation([WHOLE], MEMBERSHIP, [DANA], { start_date: '', end_date: '2026-12-05' })).toEqual({ deployment_id: null, issues: [] })
  })
})
