import {
  AccessGrantId,
  AvailabilityRuleId,
  AuthUserId,
  DeploymentId,
  RoleId,
  SoldierAccountId,
  SoldierId,
  UnitId,
  UnitMembershipId,
  type AuthIdentity,
  type OrganizationId,
  type Permission,
  type PermissionCheck,
  type Result,
  type ScopeAnchorType,
  type CalendarDate,
  type TableRow,
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

/**
 * Asks the `can` hint, then runs the command it stands for, and fails unless they agree (D-091): the command
 * succeeds exactly when every check is true, and otherwise answers `forbidden` or `not_found`. Returns the hint.
 */
export async function hintAndCommand(
  harness: ContractHarness,
  checks: readonly PermissionCheck[],
  command: () => Promise<Result<unknown>>,
): Promise<boolean[]> {
  const hint = valueOf(await harness.adapter.session.can(checks))
  const result = await command()
  const allowed = hint.every(Boolean)
  if (result.ok !== allowed) {
    throw new Error(`the hint ${JSON.stringify(hint)} disagrees with the command: ${JSON.stringify(result)}`)
  }
  if (!result.ok && result.error.code !== 'forbidden' && result.error.code !== 'not_found') {
    throw new Error(`expected a permission refusal, got ${result.error.code}`)
  }
  return hint
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
      change_seq: 0,
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

/** A stored availability rule, written past the commands: by default "at least one available in the organization". */
export async function seedRule(
  harness: ContractHarness,
  organization_id: OrganizationId,
  overrides: Partial<TableRow<'availability_rules'>> = {},
) {
  const rule: TableRow<'availability_rules'> = {
    id: AvailabilityRuleId.parse(crypto.randomUUID()),
    organization_id,
    name: 'Keep one',
    description: null,
    is_enabled: true,
    priority: 0,
    enforcement: 'soft',
    scope_unit_id: null,
    scope_mode: 'unit_tree',
    scope_level_id: null,
    population_filter: {},
    group_by: 'none',
    group_tag_category_id: null,
    metric: 'count',
    min_value: 1,
    max_value: null,
    effective_from: null,
    effective_to: null,
    deployment_id: null,
    count_pending_as_unavailable: false,
    created_at: NOW,
    created_by: null,
    updated_at: NOW,
    updated_by: null,
    version: 1,
    archived_at: null,
    ...overrides,
  }
  await harness.seed('availability_rules', [rule])
  return rule.id
}

/**
 * A rotation every request of a test can belong to (D-216), seeded past the commands: from PAST_DATE with no end, in a
 * root unit of its own, so it widens no actor's scope. `soldier_ids` serve in it for all its days.
 */
export async function seedRotation(
  harness: ContractHarness,
  organization_id: OrganizationId,
  soldier_ids: readonly SoldierId[] = [],
  dates: { readonly start_date: CalendarDate; readonly end_date: CalendarDate | null } = { start_date: PAST_DATE, end_date: null },
): Promise<DeploymentId> {
  const unitId = UnitId.parse(crypto.randomUUID())
  const id = DeploymentId.parse(crypto.randomUUID())
  const audit = { created_at: NOW, created_by: null, updated_at: NOW, updated_by: null, version: 1, archived_at: null }
  await harness.seed('units', [
    {
      id: unitId,
      organization_id,
      name: 'Rotation unit',
      code: null,
      parent_id: null,
      unit_level_id: null,
      kind: 'standing',
      valid_from: null,
      valid_to: null,
      color_key: null,
      sort_order: 0,
      properties: {},
      ...audit,
    },
  ])
  await harness.seed('deployments', [{ id, organization_id, name: 'Rotation', unit_id: unitId, ...dates, closed_at: null, closed_by: null, report_owner_id: null, ...audit }])
  await seedServing(harness, organization_id, id, soldier_ids)
  return id
}

/** `soldier_ids` serve in the rotation, for all its days unless `dates` narrow them (D-179). */
export async function seedServing(
  harness: ContractHarness,
  organization_id: OrganizationId,
  deployment_id: DeploymentId,
  soldier_ids: readonly SoldierId[],
  dates: { readonly start_date: CalendarDate | null; readonly end_date: CalendarDate | null } = { start_date: null, end_date: null },
): Promise<void> {
  if (soldier_ids.length === 0) return
  await harness.seed(
    'deployment_members',
    soldier_ids.map((soldier_id) => ({ deployment_id, soldier_id, organization_id, ...dates, created_at: NOW, created_by: null })),
  )
}
