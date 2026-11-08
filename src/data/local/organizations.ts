import type Dexie from 'dexie'
import {
  BootstrapOwnerInput,
  PERMISSION_ACTIONS_BY_RESOURCE,
  ScopeAnchorType,
  SoldierStatus,
  SubjectRankConstraint,
  type AsyncResult,
  type AuthIdentity,
  type DataCommands,
  type DataRepositories,
  type IdentitySource,
  type RolePermission,
  type Session,
  type SoldierId,
  type TimeSource,
} from '@contracts'
import { accessManagerIssues, can, timeZoneIssues, withPathPrefix } from '@domain'
import type { LocalChangeFeed } from './changes'
import { tableOf } from './database'
import { asResult, fail, failValidation, parseInput, parsedRow } from './failure'
import { bootstrapAllowed, requireLinked, resolveSession } from './session'
import { POLICY_TABLES, loadPolicySnapshot } from './snapshot'

interface OrganizationDependencies {
  readonly database: Dexie
  readonly identity: IdentitySource
  readonly time: TimeSource
  readonly changes: LocalChangeFeed
}

/** Audit block of a new mutable row (D-017). */
function createdBy(actor: SoldierId, now: string) {
  return {
    created_at: now,
    created_by: actor,
    updated_at: now,
    updated_by: actor,
    version: 1,
    archived_at: null,
  }
}

/** Every valid pair (D-040, D-079). */
function everyPermission() {
  return Object.entries(PERMISSION_ACTIONS_BY_RESOURCE).flatMap(([resource, actions]) =>
    actions.map((action) => ({ resource, action })),
  ) as Pick<RolePermission, 'resource' | 'action'>[]
}

async function writeBootstrap(
  { database, time }: OrganizationDependencies,
  identity: AuthIdentity,
  input: BootstrapOwnerInput,
): Promise<Session> {
  const now = time.now()
  const organizationId = input.organization.id
  const soldierId = input.soldier.id
  const roleId = input.owner_role.id

  const organization = parsedRow('organizations', {
    ...input.organization,
    baseline_role_id: null,
    settings: {},
    created_at: now,
    updated_at: now,
    version: 1,
  })
  const soldier = parsedRow('soldiers', {
    ...input.soldier,
    organization_id: organizationId,
    nickname: null,
    command_rank_id: null,
    status: SoldierStatus.enum.active,
    properties: {},
    ...createdBy(soldierId, now),
  })
  const account = parsedRow('soldier_accounts', {
    id: input.account_id,
    organization_id: organizationId,
    auth_user_id: identity.auth_user_id,
    soldier_id: soldierId,
    provider: identity.provider,
    email: identity.email,
    linked_at: now,
    linked_by: null,
    revoked_at: null,
    revoked_by: null,
  })
  const role = parsedRow('roles', {
    ...input.owner_role,
    organization_id: organizationId,
    description: null,
    color_key: null,
    ...createdBy(soldierId, now),
  })
  const permissions = everyPermission().map((pair) =>
    parsedRow('role_permissions', { ...pair, role_id: roleId, organization_id: organizationId }),
  )
  const grant = parsedRow('access_grants', {
    id: input.access_grant_id,
    organization_id: organizationId,
    grantee_soldier_id: soldierId,
    role_id: roleId,
    anchor_type: ScopeAnchorType.enum.organization,
    anchor_unit_id: null,
    anchor_soldier_id: null,
    anchor_level_id: null,
    anchor_steps: null,
    include_descendants: false,
    subject_rank_constraint: SubjectRankConstraint.enum.any,
    valid_from: now,
    valid_to: null,
    reason: null,
    granted_by: null,
    granted_at: now,
    revoked_at: null,
    revoked_by: null,
  })

  return database.transaction('rw', [...POLICY_TABLES, 'account_link_requests'], async () => {
    const session = await resolveSession(database, identity)
    if (session.status === 'linked') return fail({ code: 'forbidden' })
    if (!(await bootstrapAllowed(database, identity))) return fail({ code: 'bootstrap_not_allowed' })

    await tableOf(database, 'organizations').add(organization)
    await tableOf(database, 'soldiers').add(soldier)
    await tableOf(database, 'soldier_accounts').add(account)
    await tableOf(database, 'roles').add(role)
    await tableOf(database, 'role_permissions').bulkAdd(permissions)
    await tableOf(database, 'access_grants').add(grant)

    // Checked on the state after the write, like every write that can change permissions (D-059).
    const { context } = await loadPolicySnapshot(database, organizationId, now)
    const managerIssues = accessManagerIssues(context)
    if (managerIssues.length > 0) return failValidation(managerIssues)

    return { status: 'linked', identity, soldier_id: soldierId, organization_id: organizationId }
  })
}

export function createOrganizationRepository({
  database,
  identity,
  time,
}: OrganizationDependencies): DataRepositories['organizations'] {
  return {
    current: () =>
      asResult(async () => {
        const actor = requireLinked(await resolveSession(database, identity.current()))
        const { organization, context } = await loadPolicySnapshot(database, actor.organization_id, time.now())
        const visible = can(
          context,
          actor.soldier_id,
          { resource: 'organization', action: 'view' },
          { kind: 'organization' },
        )
        // An invisible row answers `not_found`, never `forbidden` (D-046).
        if (!visible) return fail({ code: 'not_found' })
        return organization
      }),
  }
}

export function createOrganizationCommands(
  dependencies: OrganizationDependencies,
): Pick<DataCommands['organizations'], 'bootstrapOwner'> {
  return {
    bootstrapOwner: (raw): AsyncResult<Session> =>
      asResult(async () => {
        const identity = dependencies.identity.current()
        if (identity === null) return fail({ code: 'unauthenticated' })
        const input = parseInput(BootstrapOwnerInput, raw)
        const zoneIssues = withPathPrefix(['organization'], timeZoneIssues(input.organization.timezone))
        if (zoneIssues.length > 0) return failValidation(zoneIssues)
        const session = await writeBootstrap(dependencies, identity, input)
        dependencies.changes.publish([
          { table: 'organizations', ids: [input.organization.id] },
          { table: 'soldiers', ids: [input.soldier.id] },
          { table: 'soldier_accounts', ids: [input.account_id] },
          { table: 'roles', ids: [input.owner_role.id] },
          { table: 'role_permissions', ids: [input.owner_role.id] },
          { table: 'access_grants', ids: [input.access_grant_id] },
        ])
        return session
      }),
  }
}
