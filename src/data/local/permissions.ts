import type Dexie from 'dexie'
import {
  AccessGrantQuery,
  ArchiveRankRoleBindingInput,
  ArchiveRoleInput,
  CreateRankRoleBindingInput,
  CreateRoleInput,
  GrantAccessInput,
  IssueCode,
  RankRoleBinding,
  RevokeAccessInput,
  Role,
  RolePermissionQuery,
  UpdateRankRoleBindingInput,
  UpdateRoleInput,
  type AccessGrant,
  type DataCommands,
  type DataRepositories,
  type Issue,
  type Permission,
  type PolicyTarget,
  type RoleId,
  type SoldierId,
  type TableName,
  type Timestamp,
} from '@contracts'
import { accessGrantIssues, missingPermissions, resolveScope, soldierTarget, withPathPrefix, withinReach, type ScopeColumns } from '@domain'
import { holds, loadActorScope, requirePermission, type ActorScope } from './actor'
import { colorKeyIssues } from './checks'
import { tableOf } from './database'
import { createdBy, updatedBy, type LocalDependencies } from './dependencies'
import { asResult, fail, failValidation, parseInput, parsedRow } from './failure'
import {
  createReferenceCommands,
  createReferenceRepository,
  parsedCandidate,
  permissionOf,
  requireWritable,
  tablesOf,
  visibleRow,
  withSpecOptionalText,
  type ReferenceSpec,
  type RowCheck,
} from './reference'
import { POLICY_TABLES, requireAccessManager } from './snapshot'

// Roles and their permission sets, rank bindings and access grants (D-003, D-028). Every write that gives pairs to
// someone is guarded by D-060 and D-156, and every write that can take them away by D-059.

const ORGANIZATION: PolicyTarget = { kind: 'organization' }
const GRANTS_VIEW = { resource: 'access_grants', action: 'view' } as const
const GRANTS_CREATE = { resource: 'access_grants', action: 'create' } as const
const GRANTS_DELETE = { resource: 'access_grants', action: 'delete' } as const

/** The pairs of a role, as stored. */
export async function rolePairs(database: Dexie, roleId: RoleId): Promise<Permission[]> {
  const rows = await tableOf(database, 'role_permissions').where('role_id').equals(roleId).toArray()
  return rows.map((row) => ({ resource: row.resource, action: row.action }) as Permission)
}

/** D-060, D-156: giving pairs the actor does not hold at a non-empty scope is `forbidden`. */
export function requireHeld(scope: ActorScope, pairs: readonly Permission[]): void {
  if (missingPermissions(scope.context, scope.soldier_id, pairs).length > 0) fail({ code: 'forbidden' })
}

/** A role a row points at must exist in the organization and be live. */
export async function liveRoleIssues(database: Dexie, scope: ActorScope, roleId: RoleId, path: readonly string[]): Promise<Issue[]> {
  const role = await tableOf(database, 'roles').get(roleId)
  if (role === undefined || role.organization_id !== scope.organization_id) {
    return [{ path: [...path], code: IssueCode.enum.reference_not_found }]
  }
  if (role.archived_at !== null) return [{ path: [...path], code: IssueCode.enum.reference_archived }]
  return []
}

/** The anchor a scope names must exist in the organization and be live (D-028). Unchanged anchors are left alone. */
async function anchorIssues(
  database: Dexie,
  scope: ActorScope,
  row: ScopeColumns,
  before: ScopeColumns | null,
): Promise<Issue[]> {
  const checks: { path: string; table: TableName; id: string | null; previous: string | null | undefined }[] = [
    { path: 'anchor_unit_id', table: 'units', id: row.anchor_unit_id, previous: before?.anchor_unit_id },
    { path: 'anchor_soldier_id', table: 'soldiers', id: row.anchor_soldier_id, previous: before?.anchor_soldier_id },
    { path: 'anchor_level_id', table: 'unit_levels', id: row.anchor_level_id, previous: before?.anchor_level_id },
  ]
  const issues: Issue[] = []
  for (const check of checks) {
    if (check.id === null || check.id === check.previous) continue
    const stored = (await database.table(check.table).get(check.id)) as
      | { organization_id: string; archived_at: Timestamp | null }
      | undefined
    if (stored === undefined || stored.organization_id !== scope.organization_id) {
      issues.push({ path: [check.path], code: IssueCode.enum.reference_not_found })
    } else if (stored.archived_at !== null) {
      issues.push({ path: [check.path], code: IssueCode.enum.reference_archived })
    }
  }
  return issues
}

const ANCHOR_TABLES: readonly TableName[] = ['unit_levels']

// --------------------------------------------------------------------- roles

const ROLE_SPEC: ReferenceSpec<Role> = {
  table: 'roles',
  resource: 'roles',
  schema: Role,
  checkTables: ['role_permissions'],
  optionalText: ['description'],
  targetOf: () => ORGANIZATION,
  rowIssues: async ({ row, before }) => colorKeyIssues(before?.color_key, row.color_key),
}

const ROLE_TABLES = tablesOf(ROLE_SPEC)

function byName(a: { name: string; id: string }, b: { name: string; id: string }): number {
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
}

export function createRoleRepository(dependencies: LocalDependencies): DataRepositories['roles'] {
  return createReferenceRepository(dependencies, ROLE_SPEC, byName)
}

export function createRolePermissionRepository(dependencies: LocalDependencies): DataRepositories['role_permissions'] {
  const { database } = dependencies
  return {
    list: (raw) =>
      asResult(() => {
        const query = parseInput(RolePermissionQuery, raw)
        return database.transaction('r', ROLE_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          if (!holds(scope, permissionOf('roles', 'view'), ORGANIZATION)) return []
          const wanted = query.role_ids === null ? null : new Set<string>(query.role_ids)
          const rows = await tableOf(database, 'role_permissions').where('organization_id').equals(scope.organization_id).toArray()
          return rows
            .filter((row) => wanted === null || wanted.has(row.role_id))
            .map((row) => parsedRow('role_permissions', row))
            .sort(
              (a, b) =>
                a.role_id.localeCompare(b.role_id) || a.resource.localeCompare(b.resource) || a.action.localeCompare(b.action),
            )
        })
      }),
  }
}

function pairKey(pair: Permission): string {
  return `${pair.resource}:${pair.action}`
}

async function writePairs(database: Dexie, scope: ActorScope, roleId: RoleId, pairs: readonly Permission[]): Promise<void> {
  const table = tableOf(database, 'role_permissions')
  const held = await table.where('role_id').equals(roleId).toArray()
  await table.bulkDelete(held.map((row) => [row.role_id, row.resource, row.action]))
  await table.bulkAdd(
    pairs.map((pair) => parsedRow('role_permissions', { ...pair, role_id: roleId, organization_id: scope.organization_id })),
  )
}

export function createRoleCommands(dependencies: LocalDependencies): DataCommands['roles'] {
  const { database, changes } = dependencies
  const publish = (id: string) => {
    changes.publish([
      { table: 'roles', ids: [id] },
      { table: 'role_permissions', ids: [id] },
    ])
  }
  const { archive } = createReferenceCommands(dependencies, ROLE_SPEC, {
    create: CreateRoleInput,
    update: UpdateRoleInput,
    archive: ArchiveRoleInput,
    placementOf: () => ORGANIZATION,
    afterWrite: async ({ database: store, scope }) => {
      await requireAccessManager(store, scope.organization_id, scope.now)
    },
  })

  return {
    archive,

    create: (raw) =>
      asResult(async () => {
        const input = parseInput(CreateRoleInput, raw)
        const { permissions, ...content } = input
        const row = await database.transaction('rw', ROLE_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          requirePermission(scope, permissionOf('roles', 'create'), ORGANIZATION)
          const candidate = parsedCandidate(
            ROLE_SPEC,
            withSpecOptionalText(ROLE_SPEC, {
              ...content,
              organization_id: scope.organization_id,
              ...createdBy(scope.soldier_id, scope.now),
            }),
            [],
          )
          if ((await tableOf(database, 'roles').get(input.id)) !== undefined) {
            return failValidation([{ path: ['id'], code: IssueCode.enum.already_exists }])
          }
          const issues = await ROLE_SPEC.rowIssues({ database, scope, row: candidate, before: null })
          if (issues.length > 0) return failValidation(issues)
          requireHeld(scope, permissions)
          await tableOf(database, 'roles').add(candidate)
          await writePairs(database, scope, candidate.id, permissions)
          return candidate
        })
        publish(row.id)
        return row
      }),

    update: (raw) =>
      asResult(async () => {
        const input = parseInput(UpdateRoleInput, raw)
        const { permissions, ...content } = input.changes
        const row = await database.transaction('rw', ROLE_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const before = await visibleRow(database, ROLE_SPEC, scope, input.id)
          requirePermission(scope, permissionOf('roles', 'update'), ORGANIZATION)
          requireWritable(before, input.expected_version)
          const defined = Object.fromEntries(Object.entries(content).filter(([, value]) => value !== undefined))
          const merged = parsedCandidate(
            ROLE_SPEC,
            withSpecOptionalText(ROLE_SPEC, {
              ...before,
              ...defined,
              ...updatedBy(scope.soldier_id, scope.now, before.version),
            }),
            ['changes'],
          )
          const issues = await ROLE_SPEC.rowIssues({ database, scope, row: merged, before })
          if (issues.length > 0) return failValidation(withPathPrefix(['changes'], issues))
          if (permissions !== undefined) {
            const held = new Set((await rolePairs(database, before.id)).map(pairKey))
            requireHeld(
              scope,
              permissions.filter((pair) => !held.has(pairKey(pair))),
            )
            await writePairs(database, scope, before.id, permissions)
          }
          await tableOf(database, 'roles').put(merged)
          if (permissions !== undefined) await requireAccessManager(database, scope.organization_id, scope.now)
          return merged
        })
        publish(row.id)
        return row
      }),
  }
}

// ------------------------------------------------------------- rank bindings

/** The rank and the role must exist and be live; a new role is guarded by D-156. */
async function bindingIssues({ database, scope, row, before }: RowCheck<RankRoleBinding>): Promise<Issue[]> {
  const issues: Issue[] = []
  if (row.command_rank_id !== before?.command_rank_id) {
    const rank = await tableOf(database, 'command_ranks').get(row.command_rank_id)
    if (rank === undefined || rank.organization_id !== scope.organization_id) {
      issues.push({ path: ['command_rank_id'], code: IssueCode.enum.reference_not_found })
    } else if (rank.archived_at !== null) {
      issues.push({ path: ['command_rank_id'], code: IssueCode.enum.reference_archived })
    }
  }
  const roleChanged = row.role_id !== before?.role_id
  if (roleChanged) issues.push(...(await liveRoleIssues(database, scope, row.role_id, ['role_id'])))
  issues.push(...(await anchorIssues(database, scope, row, before)))
  if (issues.length === 0 && roleChanged) requireHeld(scope, await rolePairs(database, row.role_id))
  return issues
}

const BINDING_SPEC: ReferenceSpec<RankRoleBinding> = {
  table: 'rank_role_bindings',
  // D-053: bindings are organization targets of the `roles` resource.
  resource: 'roles',
  schema: RankRoleBinding,
  checkTables: ANCHOR_TABLES,
  optionalText: [],
  targetOf: () => ORGANIZATION,
  rowIssues: bindingIssues,
}

function byCreation(a: RankRoleBinding, b: RankRoleBinding): number {
  return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
}

export function createRankRoleBindingRepository(dependencies: LocalDependencies): DataRepositories['rank_role_bindings'] {
  return createReferenceRepository(dependencies, BINDING_SPEC, byCreation)
}

export function createRankRoleBindingCommands(dependencies: LocalDependencies): DataCommands['rank_role_bindings'] {
  return createReferenceCommands(dependencies, BINDING_SPEC, {
    create: CreateRankRoleBindingInput,
    update: UpdateRankRoleBindingInput,
    archive: ArchiveRankRoleBindingInput,
    placementOf: () => ORGANIZATION,
    afterWrite: async ({ database, scope }) => {
      await requireAccessManager(database, scope.organization_id, scope.now)
    },
  })
}

// ------------------------------------------------------------- access grants

const GRANT_TABLES: readonly TableName[] = [...new Set<TableName>([...POLICY_TABLES, ...ANCHOR_TABLES])]

/** Not revoked and not expired: what the list shows by default. A grant that starts later is active too. */
function grantActive(grant: AccessGrant, now: Timestamp): boolean {
  return grant.revoked_at === null && (grant.valid_to === null || grant.valid_to > now)
}

function grantVisible(scope: ActorScope, grant: AccessGrant): boolean {
  return grant.organization_id === scope.organization_id && holds(scope, GRANTS_VIEW, soldierTarget(grant.grantee_soldier_id))
}

function byGrantedAt(a: AccessGrant, b: AccessGrant): number {
  return b.granted_at.localeCompare(a.granted_at) || a.id.localeCompare(b.id)
}

export function createAccessGrantRepository(dependencies: LocalDependencies): DataRepositories['access_grants'] {
  const { database } = dependencies
  return {
    get: (id) =>
      asResult(() =>
        database.transaction('r', POLICY_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const stored = await tableOf(database, 'access_grants').get(id)
          if (stored === undefined || !grantVisible(scope, stored)) return fail({ code: 'not_found' })
          return parsedRow('access_grants', stored)
        }),
      ),
    list: (raw) =>
      asResult(() => {
        const query = parseInput(AccessGrantQuery, raw)
        return database.transaction('r', POLICY_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const wanted = query.grantee_soldier_ids === null ? null : new Set<SoldierId>(query.grantee_soldier_ids)
          const rows = await tableOf(database, 'access_grants').where('organization_id').equals(scope.organization_id).toArray()
          return rows
            .filter((row) => wanted === null || wanted.has(row.grantee_soldier_id))
            .filter((row) => query.include_inactive || grantActive(row, scope.now))
            .filter((row) => grantVisible(scope, row))
            .sort(byGrantedAt)
            .map((row) => parsedRow('access_grants', row))
        })
      }),
  }
}

/** The grantee must exist, be visible and be live. */
async function granteeIssues(database: Dexie, scope: ActorScope, soldierId: SoldierId): Promise<Issue[]> {
  const soldier = await tableOf(database, 'soldiers').get(soldierId)
  const visible =
    soldier !== undefined &&
    soldier.organization_id === scope.organization_id &&
    holds(scope, permissionOf('soldiers', 'view'), soldierTarget(soldierId))
  if (!visible) return [{ path: ['grantee_soldier_id'], code: IssueCode.enum.reference_not_found }]
  if (soldier.archived_at !== null) return [{ path: ['grantee_soldier_id'], code: IssueCode.enum.reference_archived }]
  return []
}

export function createAccessGrantCommands(dependencies: LocalDependencies): DataCommands['access_grants'] {
  const { database, changes } = dependencies
  return {
    grant: (raw) =>
      asResult(async () => {
        const input = parseInput(GrantAccessInput, raw)
        const row = await database.transaction('rw', GRANT_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const grantee = input.grantee_soldier_id
          const reference = await granteeIssues(database, scope, grantee)
          if (reference.length > 0) return failValidation(reference)
          requirePermission(scope, GRANTS_CREATE, soldierTarget(grantee))
          if ((await tableOf(database, 'access_grants').get(input.id)) !== undefined) {
            return failValidation([{ path: ['id'], code: IssueCode.enum.already_exists }])
          }
          const validFrom = input.valid_from ?? scope.now
          const issues = [
            ...(await liveRoleIssues(database, scope, input.role_id, ['role_id'])),
            ...(await anchorIssues(database, scope, input, null)),
            ...accessGrantIssues({ valid_from: validFrom, valid_to: input.valid_to }),
          ]
          if (issues.length > 0) return failValidation(issues)
          requireHeld(scope, await rolePairs(database, input.role_id))
          // D-156: the scope, resolved for the grantee today, its rank constraint and its end lie within the actor's own reach.
          const { context } = scope
          const resolved = resolveScope(input, grantee, context.unitOf(grantee), context.tree)
          const limits = { constraint: input.subject_rank_constraint, until: input.valid_to }
          if (!withinReach(context, scope.soldier_id, GRANTS_CREATE, resolved, limits)) return fail({ code: 'forbidden' })

          const grant = parsedRow('access_grants', {
            ...input,
            organization_id: scope.organization_id,
            valid_from: validFrom,
            granted_by: scope.soldier_id,
            granted_at: scope.now,
            revoked_at: null,
            revoked_by: null,
          })
          await tableOf(database, 'access_grants').add(grant)
          return grant
        })
        changes.publish([{ table: 'access_grants', ids: [row.id] }])
        return row
      }),

    revoke: (raw) =>
      asResult(async () => {
        const input = parseInput(RevokeAccessInput, raw)
        const row = await database.transaction('rw', POLICY_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const stored = await tableOf(database, 'access_grants').get(input.id)
          if (stored === undefined || !grantVisible(scope, stored)) return fail({ code: 'not_found' })
          requirePermission(scope, GRANTS_DELETE, soldierTarget(stored.grantee_soldier_id))
          if (stored.revoked_at !== null) return failValidation([{ path: ['id'], code: IssueCode.enum.archived }])
          const revoked = parsedRow('access_grants', { ...stored, revoked_at: scope.now, revoked_by: scope.soldier_id })
          await tableOf(database, 'access_grants').put(revoked)
          await requireAccessManager(database, scope.organization_id, scope.now)
          return revoked
        })
        changes.publish([{ table: 'access_grants', ids: [row.id] }])
        return row
      }),
  }
}
