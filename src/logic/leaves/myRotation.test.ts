import { DeploymentId, OrganizationId, SoldierId, UnitId, UnitLevelId, type Deployment } from '@contracts'
import { createRotationMembership } from '@domain'
import { describe, expect, it } from 'vitest'
import { myRotationOf } from './workflowHooks'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const AT = '2026-11-08T10:00:00.000Z'
const LEVEL = UnitLevelId.parse(uuid(80))
const COMPANY = UnitId.parse(uuid(10))
const DANA = SoldierId.parse(uuid(1))

const rotation = (n: number, start_date: string, end_date: string, overrides: Partial<Deployment> = {}): Deployment => ({
  id: DeploymentId.parse(uuid(n)),
  organization_id: OrganizationId.parse(uuid(90)),
  name: 'סבב',
  unit_id: COMPANY,
  start_date,
  end_date,
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
const PAST = rotation(70, '2026-09-01', '2026-09-30')
const NOW = rotation(71, '2026-11-01', '2026-11-30')
const NEXT = rotation(72, '2026-12-01', '2026-12-31')
const LATER = rotation(73, '2027-01-01', '2027-01-31')
const ARCHIVED = rotation(74, '2026-11-01', '2026-11-30', { archived_at: AT })
const MEMBERSHIP = createRotationMembership({
  units: [{ id: COMPANY, parent_id: null, unit_level_id: LEVEL }],
  unit_memberships: [{ soldier_id: DANA, unit_id: COMPANY, valid_from: '2026-01-01', valid_to: null }],
  deployment_members: [],
})

describe('myRotationOf (D-350)', () => {
  it('takes the rotation the soldier serves in today', () => {
    expect(myRotationOf([PAST, NEXT, NOW], MEMBERSHIP, DANA, '2026-11-13')?.rotation.id).toBe(NOW.id)
  })

  it('else the next one, the nearest first', () => {
    expect(myRotationOf([LATER, PAST, NEXT], MEMBERSHIP, DANA, '2026-11-13')?.rotation.id).toBe(NEXT.id)
  })

  it('else the last one served', () => {
    expect(myRotationOf([PAST, NOW], MEMBERSHIP, DANA, '2026-12-15')?.rotation.id).toBe(NOW.id)
  })

  it('skips archived rotations and is null with none served', () => {
    expect(myRotationOf([ARCHIVED], MEMBERSHIP, DANA, '2026-11-13')).toBeNull()
    expect(myRotationOf([NOW], MEMBERSHIP, SoldierId.parse(uuid(2)), '2026-11-13')).toBeNull()
  })
})
