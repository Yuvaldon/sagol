import { DeploymentId, OrganizationId, SoldierId, UnitId, type Deployment, type DeploymentMember } from '@contracts'
import { describe, expect, it } from 'vitest'
import {
  deploymentFormIssues,
  deploymentFormValues,
  deploymentMemberValues,
  deploymentMembersIssues,
  isDeploymentActive,
  liveDeployments,
  newDeploymentValues,
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
    expect(input).toMatchObject({ name: 'סבב', unit_id: UNIT, start_date: '2026-11-12', end_date: null })
  })

  it('refuses an end before the start', () => {
    const values = { ...newDeploymentValues('2026-11-12', UNIT), name: 'סבב', end_date: '2026-11-01' as const }
    expect(deploymentFormIssues(values)).toEqual([{ path: ['end_date'], code: 'range_inverted' }])
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
