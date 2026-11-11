import type {
  AccessGrant,
  Organization,
  Permission,
  PermissionCheck,
  PolicyTarget,
  RankRoleBinding,
  Result,
  Role,
  RoleId,
  RolePermission,
  Soldier,
  SoldierAccount,
  SoldierId,
} from '@contracts'
import { ACCOUNT_REVIEW_PERMISSION } from '@domain'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { checkOf, checkOn } from '../permissions/checks'
import { useCan } from '../permissions/hooks'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { loaded, type Loaded } from '../queries/loaded'
import { unwrap } from '../queries/results'
import { usePorts } from '../runtime/context'
import { useSession } from '../session/hooks'
import {
  grantStateAt,
  sortedGrants,
  toCreateBindingInput,
  toCreateRoleInput,
  toGrantAccessInput,
  toUpdateBindingInput,
  toUpdateRoleInput,
  type BindingFormValues,
  type GrantFormValues,
  type GrantState,
  type RoleFormValues,
} from './forms'

// Reading and changing roles, rank bindings, the baseline role, access grants and linked accounts (D-165).

const WITH_ARCHIVED = { include_archived: true }
const EVERY_GRANTEE = { grantee_soldier_ids: null }
const EVERY_ACCOUNT = { soldier_ids: null }

/** Every role, archived ones too: a binding or a grant keeps showing its role. */
export function useRoles(): Loaded<readonly Role[]> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.roles, WITH_ARCHIVED],
      queryFn: () => unwrap(data.repositories.roles.list(WITH_ARCHIVED)),
    }),
  )
}

const EVERY_ROLE = { role_ids: null }

/** The pairs of every role the actor reads. */
export function useRolePermissions(): Loaded<readonly RolePermission[]> {
  const { data } = usePorts()
  const params = EVERY_ROLE
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.rolePermissions, params],
      queryFn: () => unwrap(data.repositories.role_permissions.list(params)),
    }),
  )
}

export function useRankBindings(): Loaded<readonly RankRoleBinding[]> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.rankRoleBindings, WITH_ARCHIVED],
      queryFn: () => unwrap(data.repositories.rank_role_bindings.list(WITH_ARCHIVED)),
    }),
  )
}

/** The grants the actor reads; expired and revoked ones only on request. */
export function useAccessGrants(includeInactive: boolean): Loaded<readonly AccessGrant[]> {
  const { data } = usePorts()
  const params = { ...EVERY_GRANTEE, include_inactive: includeInactive }
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.accessGrants, params],
      queryFn: () => unwrap(data.repositories.access_grants.list(params)),
    }),
  )
}

export interface GrantRow {
  readonly grant: AccessGrant
  readonly state: GrantState
}

/** The grants as the list shows them: active and scheduled first, each with its state now. */
export function useGrantRows(includeInactive: boolean): Loaded<readonly GrantRow[]> {
  const { time } = usePorts()
  const grants = useAccessGrants(includeInactive)
  return useMemo((): Loaded<readonly GrantRow[]> => {
    if (grants.status !== 'ready') return grants
    const now = time.now()
    return {
      status: 'ready',
      value: sortedGrants(grants.value, now).map((grant) => ({ grant, state: grantStateAt(grant, now) })),
    }
  }, [grants, time])
}

/** The account links the actor reads (D-163). */
export function useSoldierAccounts(): Loaded<readonly SoldierAccount[]> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.soldierAccounts, EVERY_ACCOUNT],
      queryFn: () => unwrap(data.repositories.soldier_accounts.list(EVERY_ACCOUNT)),
    }),
  )
}

// ------------------------------------------------------------------- commands

const ROLE_KEYS = [QUERY_KEYS.roles, QUERY_KEYS.rolePermissions]

export function useRoleCommands() {
  const { data } = usePorts()
  const roles = data.commands.roles
  const create = useCommand(ROLE_KEYS, (values: RoleFormValues) => roles.create(toCreateRoleInput(values)))
  const update = useCommand(
    ROLE_KEYS,
    async ({
      role,
      stored,
      openedVersion,
      values,
    }: {
      role: Role
      stored: readonly Permission[]
      openedVersion: number
      values: RoleFormValues
    }) => {
      const input = toUpdateRoleInput(role, stored, openedVersion, values)
      const unchanged: Result<Role> = { ok: true, value: role }
      return input === null ? unchanged : roles.update(input)
    },
  )
  const archive = useCommand(ROLE_KEYS, (role: Role) => roles.archive({ id: role.id, expected_version: role.version }))
  return { create, update, archive }
}

export function useBindingCommands() {
  const { data } = usePorts()
  const bindings = data.commands.rank_role_bindings
  const keys = [QUERY_KEYS.rankRoleBindings]
  const create = useCommand(keys, ({ roleId, values }: { roleId: RoleId; values: BindingFormValues }) =>
    bindings.create(toCreateBindingInput(roleId, values)),
  )
  const update = useCommand(
    keys,
    async ({ binding, openedVersion, values }: { binding: RankRoleBinding; openedVersion: number; values: BindingFormValues }) => {
      const input = toUpdateBindingInput(binding, openedVersion, values)
      const unchanged: Result<RankRoleBinding> = { ok: true, value: binding }
      return input === null ? unchanged : bindings.update(input)
    },
  )
  const archive = useCommand(keys, (binding: RankRoleBinding) =>
    bindings.archive({ id: binding.id, expected_version: binding.version }),
  )
  return { create, update, archive }
}

/** A grant's days are read in the organization's time zone (D-166). */
export function useGrantCommands(timezone: string) {
  const { data } = usePorts()
  const grants = data.commands.access_grants
  const keys = [QUERY_KEYS.accessGrants]
  const grant = useCommand(keys, (values: GrantFormValues) => grants.grant(toGrantAccessInput(values, timezone)))
  const revoke = useCommand(keys, (stored: AccessGrant) => grants.revoke({ id: stored.id }))
  return { grant, revoke }
}

/** `organizations.update` of the baseline role alone (D-003). NULL: no baseline. */
export function useSetBaselineRole() {
  const { data } = usePorts()
  return useCommand(
    [QUERY_KEYS.organization],
    async ({ organization, roleId }: { organization: Organization; roleId: RoleId | null }) => {
      const unchanged: Result<Organization> = { ok: true, value: organization }
      return roleId === organization.baseline_role_id
        ? unchanged
        : data.commands.organizations.update({
            expected_version: organization.version,
            changes: { baseline_role_id: roleId },
          })
    },
  )
}

/** Ends an account's link to its soldier (D-163). */
export function useRevokeLink() {
  const { data } = usePorts()
  return useCommand([QUERY_KEYS.soldierAccounts, QUERY_KEYS.session, QUERY_KEYS.onboarding], (account: SoldierAccount) =>
    data.commands.accounts.revokeLink({ id: account.id }),
  )
}

// ---------------------------------------------------------------------- hints

const ORGANIZATION: PolicyTarget = { kind: 'organization' }

const ROLE_CHECKS = {
  create: checkOf({ resource: 'roles', action: 'create' }, ORGANIZATION),
  update: checkOf({ resource: 'roles', action: 'update' }, ORGANIZATION),
  archive: checkOf({ resource: 'roles', action: 'delete' }, ORGANIZATION),
  baseline: checkOf({ resource: 'organization', action: 'update' }, ORGANIZATION),
} as const satisfies Record<string, PermissionCheck>

const ROLE_CHECK_LIST: readonly PermissionCheck[] = Object.values(ROLE_CHECKS)

/** Roles and bindings are the `roles` resource at organization scope; the baseline is the organization's (D-003). */
export function useRolePermissionHints() {
  const can = useCan(ROLE_CHECK_LIST)
  return {
    create: can(ROLE_CHECKS.create),
    update: can(ROLE_CHECKS.update),
    archive: can(ROLE_CHECKS.archive),
    baseline: can(ROLE_CHECKS.baseline),
  }
}

const GRANT = {
  view: { resource: 'access_grants', action: 'view' },
  create: { resource: 'access_grants', action: 'create' },
  revoke: { resource: 'access_grants', action: 'delete' },
} as const satisfies Record<string, Permission>

/** Grants are checked on their grantee (D-028): who may be given one, and which grant may be revoked. */
export function useGrantPermissionHints(soldiers: readonly Soldier[]) {
  const checks = useMemo(
    () => soldiers.flatMap((soldier) => [checkOn(GRANT.create, soldier.id), checkOn(GRANT.revoke, soldier.id)]),
    [soldiers],
  )
  const can = useCan(checks)
  return useMemo(
    () => ({
      grantTo: (soldierId: SoldierId) => can(checkOn(GRANT.create, soldierId)),
      revokeOf: (grant: AccessGrant) => can(checkOn(GRANT.revoke, grant.grantee_soldier_id)),
      any: soldiers.some((soldier) => can(checkOn(GRANT.create, soldier.id))),
    }),
    [can, soldiers],
  )
}

/** Who may review a soldier's link may end it, except their own (D-163). */
export function useRevokeLinkHints(accounts: readonly SoldierAccount[]) {
  const session = useSession()
  const self = session.status === 'ready' && session.value.status === 'linked' ? session.value.soldier_id : null
  const checks = useMemo(
    () => accounts.map((account) => checkOn(ACCOUNT_REVIEW_PERMISSION, account.soldier_id)),
    [accounts],
  )
  const can = useCan(checks)
  return useMemo(
    () => (account: SoldierAccount) =>
      account.soldier_id !== self && can(checkOn(ACCOUNT_REVIEW_PERMISSION, account.soldier_id)),
    [can, self],
  )
}

/**
 * Whether the grants module is for this actor: who may view grants of at least one soldier they see. A hint: the
 * adapter filters the grants again.
 */
export function useGrantModuleAccess(soldiers: readonly Soldier[]): boolean {
  const checks = useMemo(() => soldiers.map((soldier) => checkOn(GRANT.view, soldier.id)), [soldiers])
  const can = useCan(checks)
  return checks.some(can)
}
