import {
  AccessGrantId,
  AuthUserId,
  RoleId,
  SoldierAccountId,
  SoldierId,
  UnitMembershipId,
  type AuthIdentity,
  type OrganizationId,
  type Permission,
  type Result,
  type ScopeAnchorType,
  type UnitId,
} from '@contracts'
import type { ContractHarness } from './harness'

// What the slices of the contract suite share: reading answers, and soldiers who hold exactly the
// permissions a test needs, through seeded grants (D-076). Sample data, test files only.

export const NOW = '2026-11-08T10:00:00.000Z'
export const PAST_DATE = '2026-01-01'
export const LATER_DATE = '2027-01-01'

export function errorOf<T>(result: Result<T>) {
  if (result.ok) throw new Error('expected a refusal')
  return result.error
}

export function valueOf<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`unexpected refusal: ${JSON.stringify(result.error)}`)
  return result.value
}

export function issuesOf<T>(result: Result<T>) {
  const error = errorOf(result)
  if (error.code !== 'validation_failed') throw new Error(`expected validation_failed, got ${error.code}`)
  return error.issues
}

export interface ActorScopeColumns {
  readonly anchor_type: ScopeAnchorType
  readonly anchor_unit_id?: UnitId
  readonly include_descendants?: boolean
}

export async function placeSoldier(
  harness: ContractHarness,
  organization_id: OrganizationId,
  soldier_id: SoldierId,
  unit_id: UnitId,
  valid_to: string | null,
) {
  const id = UnitMembershipId.parse(crypto.randomUUID())
  await harness.seed('unit_memberships', [
    {
      id,
      organization_id,
      soldier_id,
      unit_id,
      membership_type: 'primary',
      valid_from: PAST_DATE,
      valid_to,
      created_at: NOW,
      created_by: null,
      updated_at: NOW,
      updated_by: null,
      version: 1,
    },
  ])
  return id
}

/** A second linked soldier holding `pairs` from one role, at the given scope. */
export async function seedActor(
  harness: ContractHarness,
  organization_id: OrganizationId,
  pairs: readonly Permission[],
  scope: ActorScopeColumns,
  home?: UnitId,
) {
  const soldierId = SoldierId.parse(crypto.randomUUID())
  const roleId = RoleId.parse(crypto.randomUUID())
  const identity: AuthIdentity = {
    auth_user_id: AuthUserId.parse(crypto.randomUUID()),
    provider: 'local',
    email: `actor-${soldierId}@example.test`,
    email_verified: true,
    display_name: null,
  }
  const audit = { created_at: NOW, created_by: null, updated_at: NOW, updated_by: null, version: 1, archived_at: null }
  await harness.seed('soldiers', [
    {
      id: soldierId,
      organization_id,
      first_name: 'Noa',
      last_name: 'Cohen',
      nickname: null,
      command_rank_id: null,
      status: 'active',
      properties: {},
      ...audit,
    },
  ])
  await harness.seed('soldier_accounts', [
    {
      id: SoldierAccountId.parse(crypto.randomUUID()),
      organization_id,
      auth_user_id: identity.auth_user_id,
      soldier_id: soldierId,
      provider: 'local',
      email: identity.email,
      linked_at: NOW,
      linked_by: null,
      revoked_at: null,
      revoked_by: null,
    },
  ])
  await harness.seed('roles', [
    { id: roleId, organization_id, name: 'Limited', description: null, color_key: null, ...audit },
  ])
  await harness.seed(
    'role_permissions',
    pairs.map((pair) => ({ ...pair, role_id: roleId, organization_id })),
  )
  await harness.seed('access_grants', [
    {
      id: AccessGrantId.parse(crypto.randomUUID()),
      organization_id,
      grantee_soldier_id: soldierId,
      role_id: roleId,
      anchor_type: scope.anchor_type,
      anchor_unit_id: scope.anchor_unit_id ?? null,
      anchor_soldier_id: null,
      anchor_level_id: null,
      anchor_steps: null,
      include_descendants: scope.include_descendants ?? false,
      subject_rank_constraint: 'any',
      valid_from: NOW,
      valid_to: null,
      reason: null,
      granted_by: null,
      granted_at: NOW,
      revoked_at: null,
      revoked_by: null,
    },
  ])
  if (home !== undefined) await placeSoldier(harness, organization_id, soldierId, home, null)
  return { identity, soldierId, roleId }
}
