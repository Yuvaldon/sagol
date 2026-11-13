import { CalendarDate, DeploymentId, OrganizationId, SoldierId, UnitId, UnitMembershipId, type Deployment, type DeploymentMember } from '@contracts'
import { describe, expect, it } from 'vitest'
import {
  defaultDeploymentMembers,
  deploymentFormIssues,
  deploymentFormValues,
  deploymentMemberValues,
  deploymentMembersIssues,
  isDeploymentActive,
  liveDeployments,
  newDeploymentValues,
  isRotationClosable,
  previousRotation,
  startingMembers,
  toCreateDeploymentInput,
  toSetDeploymentMembersInput,
  toUpdateDeploymentInput,
} from './deployments'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const AT = '2026-11-08T10:00:00.000Z'
const ORGANIZATION = OrganizationId.parse(uuid(900))
const UNIT = UnitId.parse(uuid(10))
const OTHER_UNIT = UnitId.parse(uuid(11))
const SOLDIER = SoldierId.parse(uuid(1))

const deployment = (overrides: Partial<Deployment> = {}): Deployment => ({
  id: DeploymentId.parse(uuid(50)),
  organization_id: ORGANIZATION,
  name: 'סבב חורף',
  unit_id: UNIT,
  start_date: '2026-12-01',
  end_date: '2026-12-20',
  closed_at: null,
  closed_by: null,
  report_owner_id: null,
  created_at: AT,
  created_by: null,
  updated_at: AT,
  updated_by: null,
  version: 3,
  archived_at: null,
  ...overrides,
})

describe('the deployment form (D-179)', () => {
  it('asks for a name, a unit and a start, and takes an open end', () => {
    expect(deploymentFormIssues(newDeploymentValues('2026-11-12', null)).map((issue) => issue.path)).toEqual([['name'], ['unit_id']])
    const input = toCreateDeploymentInput({ ...newDeploymentValues('2026-11-12', UNIT), name: ' סבב ' })
    expect(input).toMatchObject({ name: 'סבב', unit_id: UNIT, start_date: '2026-11-12', end_date: null, report_owner_id: null })
  })

  it('refuses an end before the start', () => {
    const values = { ...newDeploymentValues('2026-11-12', UNIT), name: 'סבב', end_date: '2026-11-01' as const }
    expect(deploymentFormIssues(values)).toEqual([{ path: ['end_date'], code: 'range_inverted' }])
  })

  it('refuses dates that share a day with another live rotation, but not with itself (D-257)', () => {
    const other = deployment()
    const values = { ...newDeploymentValues('2026-12-15', UNIT), name: 'סבב' }
    expect(deploymentFormIssues(values, [other])).toEqual([{ path: ['start_date'], code: 'rotation_overlap' }])
    expect(deploymentFormIssues(values, [deployment({ archived_at: AT })])).toEqual([])
    expect(deploymentFormIssues(deploymentFormValues(other), [other], other.id)).toEqual([])
  })

  it('updates only what changed, and nothing when nothing did', () => {
    const stored = deployment()
    expect(toUpdateDeploymentInput(stored, 3, deploymentFormValues(stored))).toBeNull()
    expect(toUpdateDeploymentInput(stored, 3, { ...deploymentFormValues(stored), unit_id: OTHER_UNIT, end_date: '' })).toEqual({
      id: stored.id,
      expected_version: 3,
      changes: { unit_id: OTHER_UNIT, end_date: null },
    })
  })

  it('derives "active" from the dates, and hides archived ones', () => {
    expect(isDeploymentActive(deployment(), '2026-12-01')).toBe(true)
    expect(isDeploymentActive(deployment(), '2026-12-21')).toBe(false)
    expect(isDeploymentActive(deployment({ end_date: null }), '2027-06-01')).toBe(true)
    expect(liveDeployments([deployment(), deployment({ id: DeploymentId.parse(uuid(51)), archived_at: AT })])).toHaveLength(1)
  })
})

describe('deployment members (D-179)', () => {
  const stored = deployment()
  const member: DeploymentMember = {
    deployment_id: stored.id,
    soldier_id: SOLDIER,
    organization_id: ORGANIZATION,
    start_date: null,
    end_date: '2026-12-10',
    created_at: AT,
    created_by: null,
  }

  it('reads members, an empty date being the deployment own', () => {
    expect(deploymentMemberValues([member], stored)).toEqual([{ soldier_id: SOLDIER, start_date: '', end_date: '2026-12-10' }])
    expect(toSetDeploymentMembersInput(stored, 3, deploymentMemberValues([member], stored))).toEqual({
      deployment_id: stored.id,
      expected_version: 3,
      members: [{ soldier_id: SOLDIER, start_date: null, end_date: '2026-12-10' }],
    })
  })

  it('refuses a member date outside the deployment, on that member', () => {
    expect(deploymentMembersIssues(stored, [{ soldier_id: SOLDIER, start_date: '2026-11-30', end_date: '' }])).toEqual([
      { path: ['members', 0, 'start_date'], code: 'invalid_value' },
    ])
  })
})

describe('a new rotation starts with its unit (D-219)', () => {
  const CHILD = UnitId.parse(uuid(12))
  const units = [
    { id: UNIT, parent_id: null, unit_level_id: null },
    { id: CHILD, parent_id: UNIT, unit_level_id: null },
    { id: OTHER_UNIT, parent_id: null, unit_level_id: null },
  ]
  const soldier = (n: number, overrides: { status?: 'active' | 'inactive'; archived_at?: string | null } = {}) => ({
    id: SoldierId.parse(uuid(n)),
    status: overrides.status ?? ('active' as const),
    archived_at: overrides.archived_at ?? null,
  })
  const placed = (n: number, unit_id: UnitId, valid_from: string, valid_to: string | null = null) => ({
    id: UnitMembershipId.parse(uuid(100 + n)),
    soldier_id: SoldierId.parse(uuid(n)),
    unit_id,
    membership_type: 'primary' as const,
    valid_from,
    valid_to,
  })

  it('takes the active soldiers placed in the unit or below it on the first day', () => {
    const soldiers = [soldier(1), soldier(2), soldier(3), soldier(4), soldier(5, { status: 'inactive' }), soldier(6, { archived_at: AT })]
    const memberships = [
      placed(1, UNIT, '2026-01-01'),
      placed(2, CHILD, '2026-01-01'),
      placed(3, OTHER_UNIT, '2026-01-01'),
      placed(4, UNIT, '2026-12-02'),
      placed(5, UNIT, '2026-01-01'),
      placed(6, UNIT, '2026-01-01'),
    ]
    expect(defaultDeploymentMembers(deployment(), units, memberships, soldiers)).toEqual([
      { soldier_id: SoldierId.parse(uuid(1)), start_date: '', end_date: '' },
      { soldier_id: SoldierId.parse(uuid(2)), start_date: '', end_date: '' },
    ])
  })
})

describe('a new rotation from the previous one (D-222)', () => {
  const earlier = deployment({ id: DeploymentId.parse(uuid(51)), start_date: '2026-06-01', end_date: '2026-06-30' })
  const latest = deployment({ id: DeploymentId.parse(uuid(52)), start_date: '2026-09-01', end_date: '2026-09-30' })
  const next = deployment({ id: DeploymentId.parse(uuid(53)), start_date: '2026-12-01', end_date: null })

  it('copies the live rotation that ended last before it starts', () => {
    expect(previousRotation([earlier, latest, next], next)?.id).toBe(latest.id)
    expect(previousRotation([earlier, deployment({ ...latest, archived_at: AT }), next], next)?.id).toBe(earlier.id)
    expect(previousRotation([next], next)).toBeNull()
  })

  it('closes once the planned end has come, or any day from the start while the end is open (D-258)', () => {
    const today = CalendarDate.parse('2026-09-15')
    expect(isRotationClosable(latest, today)).toBe(false)
    expect(isRotationClosable(earlier, today)).toBe(true)
    expect(isRotationClosable(next, today)).toBe(false)
    expect(isRotationClosable(next, CalendarDate.parse('2026-12-01'))).toBe(true)
    expect(isRotationClosable(deployment({ ...earlier, closed_at: AT }), today)).toBe(false)
  })

  it("starts with the previous list's soldiers for all the new days, else with those placed", () => {
    const row = (n: number): DeploymentMember => ({
      deployment_id: latest.id,
      soldier_id: SoldierId.parse(uuid(n)),
      organization_id: ORGANIZATION,
      start_date: '2026-09-05',
      end_date: null,
      created_at: AT,
      created_by: null,
    })
    const placed = [{ soldier_id: SOLDIER, start_date: '' as const, end_date: '' as const }]
    expect(startingMembers([row(2)], placed)).toEqual([{ soldier_id: SoldierId.parse(uuid(2)), start_date: '', end_date: '' }])
    expect(startingMembers([], placed)).toEqual(placed)
  })
})
