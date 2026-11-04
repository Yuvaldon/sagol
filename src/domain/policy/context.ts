import {
  SoldierStatus,
  type AccessGrant,
  type AccessGrantId,
  type CommandRank,
  type CommandRankId,
  type PermissionAction,
  type PermissionResource,
  type RankRoleBinding,
  type RankRoleBindingId,
  type Role,
  type RoleId,
  type RolePermission,
  type Soldier,
  type SoldierAccount,
  type SoldierId,
  SubjectRankConstraint,
  type Timestamp,
  type UnitId,
} from '@contracts'
import { buildUnitTree, primaryUnitOn, type MembershipSpan, type UnitNode, type UnitTree } from '../hierarchy'
import { windowContains, type Clock } from '../time'
import { resolveScope, type ResolvedScope, type ScopeColumns } from './scope'
import { effectiveSeniority, type SeniorityOverrideSpan } from './seniority'

// A snapshot of everything the policy reads, indexed once (D-003, D-028, D-029).
// Full contract rows fit every field: each type picks only the columns the policy reads.

export interface PolicyData {
  readonly baseline_role_id: RoleId | null
  readonly units: Iterable<UnitNode>
  readonly soldiers: Iterable<Pick<Soldier, 'id' | 'command_rank_id' | 'status' | 'archived_at'>>
  readonly command_ranks: Iterable<Pick<CommandRank, 'id' | 'seniority'>>
  readonly seniority_overrides: Iterable<SeniorityOverrideSpan>
  readonly unit_memberships: Iterable<MembershipSpan>
  readonly soldier_accounts: Iterable<Pick<SoldierAccount, 'soldier_id' | 'revoked_at'>>
  readonly roles: Iterable<Pick<Role, 'id' | 'archived_at'>>
  readonly role_permissions: Iterable<Pick<RolePermission, 'role_id' | 'resource' | 'action'>>
  readonly rank_role_bindings: Iterable<
    Pick<RankRoleBinding, 'id' | 'command_rank_id' | 'role_id' | 'subject_rank_constraint' | 'archived_at'> &
      ScopeColumns
  >
  readonly access_grants: Iterable<
    Pick<
      AccessGrant,
      | 'id'
      | 'grantee_soldier_id'
      | 'role_id'
      | 'subject_rank_constraint'
      | 'valid_from'
      | 'valid_to'
      | 'revoked_at'
    > &
      ScopeColumns
  >
}

/** Where an effective permission comes from (D-003). */
export type PermissionSource =
  | { kind: 'baseline'; role_id: RoleId }
  | { kind: 'rank_binding'; id: RankRoleBindingId; role_id: RoleId }
  | { kind: 'access_grant'; id: AccessGrantId; role_id: RoleId }

/** One `(resource, action)` a soldier holds, with its resolved scope. Derived, never stored. */
export interface EffectivePermission {
  readonly resource: PermissionResource
  readonly action: PermissionAction
  readonly scope: ResolvedScope
  readonly subject_rank_constraint: SubjectRankConstraint
  readonly source: PermissionSource
  /** When the source stops granting it; NULL = no expiry (D-059). */
  readonly expires_at: Timestamp | null
}

/** The indexed snapshot. Build once per evaluation with `createPolicyContext`. */
export interface PolicyContext {
  readonly clock: Clock
  readonly tree: UnitTree
  /** Every soldier of the snapshot. */
  readonly soldierIds: readonly SoldierId[]
  /** The soldier's primary unit today (D-054). */
  unitOf(soldierId: SoldierId): UnitId | null
  /** Effective seniority today, NULL without rank and override (D-029, D-057). */
  seniorityOf(soldierId: SoldierId): number | null
  /** Active, not archived and linked to a non-revoked account (D-056). */
  holdsPermissions(soldierId: SoldierId): boolean
  /** Every permission the soldier holds now; empty when it holds none (D-056). */
  permissionsOf(soldierId: SoldierId): readonly EffectivePermission[]
}

type Pair = Pick<RolePermission, 'resource' | 'action'>

function groupBy<K, V>(items: Iterable<V>, keyOf: (item: V) => K): Map<K, V[]> {
  const groups = new Map<K, V[]>()
  for (const item of items) {
    const key = keyOf(item)
    const group = groups.get(key)
    if (group === undefined) groups.set(key, [item])
    else group.push(item)
  }
  return groups
}

export function createPolicyContext(data: PolicyData, clock: Clock): PolicyContext {
  const tree = buildUnitTree(data.units)
  const soldiers = new Map([...data.soldiers].map((soldier) => [soldier.id, soldier]))
  const rankSeniority = new Map<CommandRankId, number>(
    [...data.command_ranks].map((rank) => [rank.id, rank.seniority]),
  )
  const membershipsBySoldier = groupBy(data.unit_memberships, (row) => row.soldier_id)
  const overridesBySoldier = groupBy(data.seniority_overrides, (row) => row.soldier_id)
  const linked = new Set<SoldierId>()
  for (const account of data.soldier_accounts) {
    if (account.revoked_at === null) linked.add(account.soldier_id)
  }
  const liveRoles = new Set<RoleId>()
  for (const role of data.roles) {
    if (role.archived_at === null) liveRoles.add(role.id)
  }
  const pairsByRole = groupBy(data.role_permissions, (row) => row.role_id)
  const bindingsByRank = groupBy(
    [...data.rank_role_bindings].filter((binding) => binding.archived_at === null),
    (binding) => binding.command_rank_id,
  )
  const grantsByGrantee = groupBy(
    [...data.access_grants].filter(
      (grant) => grant.revoked_at === null && windowContains(grant, clock.now),
    ),
    (grant) => grant.grantee_soldier_id,
  )

  const unitCache = new Map<SoldierId, UnitId | null>()
  const permissionCache = new Map<SoldierId, readonly EffectivePermission[]>()

  function unitOf(soldierId: SoldierId): UnitId | null {
    const cached = unitCache.get(soldierId)
    if (cached !== undefined) return cached
    const unitId = primaryUnitOn(membershipsBySoldier.get(soldierId) ?? [], soldierId, clock.today)
    unitCache.set(soldierId, unitId)
    return unitId
  }

  function seniorityOf(soldierId: SoldierId): number | null {
    const rankId = soldiers.get(soldierId)?.command_rank_id ?? null
    const fromRank = rankId === null ? null : (rankSeniority.get(rankId) ?? null)
    return effectiveSeniority(fromRank, overridesBySoldier.get(soldierId) ?? [], soldierId, clock.today)
  }

  function holdsPermissions(soldierId: SoldierId): boolean {
    const soldier = soldiers.get(soldierId)
    if (soldier === undefined) return false
    return (
      soldier.status === SoldierStatus.enum.active &&
      soldier.archived_at === null &&
      linked.has(soldierId)
    )
  }

  function pairsOf(roleId: RoleId): readonly Pair[] {
    return liveRoles.has(roleId) ? (pairsByRole.get(roleId) ?? []) : []
  }

  function collect(soldierId: SoldierId): EffectivePermission[] {
    const permissions: EffectivePermission[] = []
    const home = unitOf(soldierId)
    const add = (
      roleId: RoleId,
      scope: ResolvedScope,
      constraint: SubjectRankConstraint,
      source: PermissionSource,
      expiresAt: Timestamp | null,
    ) => {
      for (const pair of pairsOf(roleId)) {
        permissions.push({
          resource: pair.resource,
          action: pair.action,
          scope,
          subject_rank_constraint: constraint,
          source,
          expires_at: expiresAt,
        })
      }
    }

    if (data.baseline_role_id !== null) {
      const roleId = data.baseline_role_id
      add(roleId, { kind: 'soldier', soldier_id: soldierId }, SubjectRankConstraint.enum.any, { kind: 'baseline', role_id: roleId }, null)
    }
    const rankId = soldiers.get(soldierId)?.command_rank_id ?? null
    for (const binding of rankId === null ? [] : (bindingsByRank.get(rankId) ?? [])) {
      add(
        binding.role_id,
        resolveScope(binding, soldierId, home, tree),
        binding.subject_rank_constraint,
        { kind: 'rank_binding', id: binding.id, role_id: binding.role_id },
        null,
      )
    }
    for (const grant of grantsByGrantee.get(soldierId) ?? []) {
      add(
        grant.role_id,
        resolveScope(grant, soldierId, home, tree),
        grant.subject_rank_constraint,
        { kind: 'access_grant', id: grant.id, role_id: grant.role_id },
        grant.valid_to,
      )
    }
    return permissions
  }

  function permissionsOf(soldierId: SoldierId): readonly EffectivePermission[] {
    if (!holdsPermissions(soldierId)) return []
    const cached = permissionCache.get(soldierId)
    if (cached !== undefined) return cached
    const permissions = collect(soldierId)
    permissionCache.set(soldierId, permissions)
    return permissions
  }

  return { clock, tree, soldierIds: [...soldiers.keys()], unitOf, seniorityOf, holdsPermissions, permissionsOf }
}
