import {
  AccessGrantId,
  CreateRankRoleBindingInput,
  CreateRoleInput,
  GrantAccessInput,
  PERMISSION_ACTIONS_BY_RESOURCE,
  Permission,
  PermissionResource,
  RankRoleBindingId,
  RoleId,
  SubjectRankConstraint,
  UNIT_SCOPE_ANCHORS,
  type AccessGrant,
  type CalendarDate,
  type CommandRankId,
  type Issue,
  type PermissionAction,
  type RankRoleBinding,
  type Role,
  type RolePermission,
  type ScopeAnchorType,
  type SoldierId,
  type Timestamp,
  type UnitId,
  type UnitLevelId,
  type UpdateRankRoleBindingInput,
  type UpdateRoleInput,
} from '@contracts'
import { addDays, compareInstants, startOfDay, todayIn } from '@domain'
import { formIssues } from '../forms/issues'

// Roles, rank bindings and access grants, between the store and the screens (D-028, D-040, D-165). Pure.

// ------------------------------------------------------------------------ roles

/** One row of the permission grid: a resource and the actions D-040 allows on it. */
export interface PermissionGridRow {
  readonly resource: PermissionResource
  readonly actions: readonly PermissionAction[]
}

/** Every valid pair, by resource, in the vocabulary's order (D-040). */
export const PERMISSION_GRID: readonly PermissionGridRow[] = PermissionResource.options.map((resource) => ({
  resource,
  actions: PERMISSION_ACTIONS_BY_RESOURCE[resource],
}))

const pairKey = (permission: { readonly resource: string; readonly action: string }) =>
  `${permission.resource}:${permission.action}`

export function hasPermission(permissions: readonly Permission[], permission: Permission): boolean {
  return permissions.some((held) => pairKey(held) === pairKey(permission))
}

/** The set with the pair added or removed. */
export function toggledPermission(permissions: readonly Permission[], permission: Permission): Permission[] {
  return hasPermission(permissions, permission)
    ? permissions.filter((held) => pairKey(held) !== pairKey(permission))
    : [...permissions, permission]
}

/** The pairs of one role, from the stored rows. */
export function permissionsOfRole(rows: readonly RolePermission[], roleId: RoleId): Permission[] {
  return rows
    .filter((row) => row.role_id === roleId)
    .map((row) => Permission.parse({ resource: row.resource, action: row.action }))
}

export function liveRoles(roles: readonly Role[]): Role[] {
  return roles.filter((role) => role.archived_at === null).toSorted((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}

export interface RoleFormValues {
  readonly name: string
  readonly description: string
  /** NULL: the role has no color of its own. */
  readonly color_key: string | null
  readonly permissions: readonly Permission[]
}

export const NEW_ROLE_VALUES: RoleFormValues = { name: '', description: '', color_key: null, permissions: [] }

export function roleFormValues(role: Role, permissions: readonly Permission[]): RoleFormValues {
  return { name: role.name, description: role.description ?? '', color_key: role.color_key, permissions }
}

const textOrNull = (text: string): string | null => (text.trim() === '' ? null : text.trim())

/** The grid's order, so a set compares and stores the same way whatever order it was ticked in. */
function orderedPermissions(permissions: readonly Permission[]): Permission[] {
  return PERMISSION_GRID.flatMap((row) =>
    row.actions
      .map((action) => Permission.parse({ resource: row.resource, action }))
      .filter((permission) => hasPermission(permissions, permission)),
  )
}

function createRoleInput(values: RoleFormValues) {
  return {
    id: RoleId.parse(crypto.randomUUID()),
    name: values.name,
    description: textOrNull(values.description),
    color_key: values.color_key,
    permissions: orderedPermissions(values.permissions),
  }
}

/** The same field codes the adapter answers (D-068). */
export function roleFormIssues(values: RoleFormValues): Issue[] {
  return formIssues(CreateRoleInput, createRoleInput(values))
}

export function toCreateRoleInput(values: RoleFormValues): CreateRoleInput {
  return CreateRoleInput.parse(createRoleInput(values))
}

function samePermissions(a: readonly Permission[], b: readonly Permission[]): boolean {
  return a.length === b.length && a.every((permission) => hasPermission(b, permission))
}

/** NULL when nothing changed. The set is sent whole when it changed (it replaces the stored one). */
export function toUpdateRoleInput(
  role: Role,
  stored: readonly Permission[],
  openedVersion: number,
  values: RoleFormValues,
): UpdateRoleInput | null {
  const description = textOrNull(values.description)
  const changes = {
    ...(values.name === role.name ? {} : { name: values.name }),
    ...(description === role.description ? {} : { description }),
    ...(values.color_key === role.color_key ? {} : { color_key: values.color_key }),
    ...(samePermissions(values.permissions, stored) ? {} : { permissions: orderedPermissions(values.permissions) }),
  }
  if (Object.keys(changes).length === 0) return null
  return { id: role.id, expected_version: openedVersion, changes }
}

// ------------------------------------------------------------------------ scope

/** The scope part of a binding or grant form (D-028). Fields the anchor does not use are ignored. */
export interface ScopeFormValues {
  readonly anchor_type: ScopeAnchorType
  readonly anchor_unit_id: UnitId | null
  readonly anchor_soldier_id: SoldierId | null
  readonly anchor_level_id: UnitLevelId | null
  readonly anchor_steps: number | null
  readonly include_descendants: boolean
  readonly subject_rank_constraint: SubjectRankConstraint
}

/** What the scope picker shows for an anchor: only the fields it needs (D-165). */
export interface AnchorFields {
  readonly unit: boolean
  readonly soldier: boolean
  readonly level: boolean
  readonly steps: boolean
  readonly descendants: boolean
}

const UNIT_ANCHORS: readonly ScopeAnchorType[] = UNIT_SCOPE_ANCHORS

export function anchorFields(anchor: ScopeAnchorType): AnchorFields {
  return {
    unit: anchor === 'unit',
    soldier: anchor === 'soldier',
    level: anchor === 'home_ancestor_at_level',
    steps: anchor === 'home_ancestor_steps',
    descendants: UNIT_ANCHORS.includes(anchor),
  }
}

/** A commander's usual reach: their home unit and what is under it. */
export const NEW_SCOPE_VALUES: ScopeFormValues = {
  anchor_type: 'home_unit',
  anchor_unit_id: null,
  anchor_soldier_id: null,
  anchor_level_id: null,
  anchor_steps: null,
  include_descendants: true,
  subject_rank_constraint: SubjectRankConstraint.enum.any,
}

/** The stored columns: what the anchor does not use is NULL, so the row check holds (D-028). */
export function scopeColumnsOf(values: ScopeFormValues) {
  const fields = anchorFields(values.anchor_type)
  return {
    anchor_type: values.anchor_type,
    anchor_unit_id: fields.unit ? values.anchor_unit_id : null,
    anchor_soldier_id: fields.soldier ? values.anchor_soldier_id : null,
    anchor_level_id: fields.level ? values.anchor_level_id : null,
    anchor_steps: fields.steps ? values.anchor_steps : null,
    include_descendants: fields.descendants && values.include_descendants,
    subject_rank_constraint: values.subject_rank_constraint,
  }
}

export function scopeFormValues(row: ScopeFormValues): ScopeFormValues {
  return {
    anchor_type: row.anchor_type,
    anchor_unit_id: row.anchor_unit_id,
    anchor_soldier_id: row.anchor_soldier_id,
    anchor_level_id: row.anchor_level_id,
    anchor_steps: row.anchor_steps,
    include_descendants: row.include_descendants,
    subject_rank_constraint: row.subject_rank_constraint,
  }
}

/**
 * An anchor without its argument fails the row check at `anchor_type` (D-028); the form names the missing field.
 * The adapter answers the same issue on the same path.
 */
function scopeIssues(values: ScopeFormValues): Issue[] {
  const fields = anchorFields(values.anchor_type)
  const missing = (field: keyof ScopeFormValues, needed: boolean, value: unknown): Issue[] =>
    needed && value === null ? [{ path: [field], code: 'required' }] : []
  return [
    ...missing('anchor_unit_id', fields.unit, values.anchor_unit_id),
    ...missing('anchor_soldier_id', fields.soldier, values.anchor_soldier_id),
    ...missing('anchor_level_id', fields.level, values.anchor_level_id),
    ...missing('anchor_steps', fields.steps, values.anchor_steps),
  ]
}

/** Field issues first, then the schema's, without the anchor issue the field issues already explain. */
function withScopeIssues(scope: ScopeFormValues, issues: readonly Issue[]): Issue[] {
  const own = scopeIssues(scope)
  if (own.length === 0) return [...issues]
  return [...own, ...issues.filter((issue) => issue.path[0] !== 'anchor_type')]
}

const SCOPE_KEYS = [
  'anchor_type',
  'anchor_unit_id',
  'anchor_soldier_id',
  'anchor_level_id',
  'anchor_steps',
  'include_descendants',
  'subject_rank_constraint',
] as const satisfies readonly (keyof ScopeFormValues)[]

// ------------------------------------------------------------------ rank bindings

export interface BindingFormValues extends ScopeFormValues {
  readonly command_rank_id: CommandRankId | null
}

export function newBindingValues(): BindingFormValues {
  return { ...NEW_SCOPE_VALUES, command_rank_id: null }
}

export function bindingFormValues(binding: RankRoleBinding): BindingFormValues {
  return { ...scopeFormValues(binding), command_rank_id: binding.command_rank_id }
}

function createBindingInput(roleId: RoleId, values: BindingFormValues) {
  return {
    id: RankRoleBindingId.parse(crypto.randomUUID()),
    command_rank_id: values.command_rank_id,
    role_id: roleId,
    ...scopeColumnsOf(values),
  }
}

export function bindingFormIssues(roleId: RoleId, values: BindingFormValues): Issue[] {
  return withScopeIssues(values, formIssues(CreateRankRoleBindingInput, createBindingInput(roleId, values)))
}

export function toCreateBindingInput(roleId: RoleId, values: BindingFormValues): CreateRankRoleBindingInput {
  return CreateRankRoleBindingInput.parse(createBindingInput(roleId, values))
}

/** The rank is fixed (D-045); the scope is sent whole when any of it changed, and checked merged. */
export function toUpdateBindingInput(
  binding: RankRoleBinding,
  openedVersion: number,
  values: BindingFormValues,
): UpdateRankRoleBindingInput | null {
  const next = scopeColumnsOf(values)
  const changed = SCOPE_KEYS.some((key) => next[key] !== binding[key])
  if (!changed) return null
  return { id: binding.id, expected_version: openedVersion, changes: next }
}

export function liveBindingsOf(bindings: readonly RankRoleBinding[], roleId: RoleId): RankRoleBinding[] {
  return bindings.filter((binding) => binding.archived_at === null && binding.role_id === roleId)
}

// ------------------------------------------------------------------ access grants

export interface GrantFormValues extends ScopeFormValues {
  readonly grantee_soldier_id: SoldierId | null
  readonly role_id: RoleId | null
  /** The first day, in the organization's time zone; NULL starts now (D-166). */
  readonly valid_from: CalendarDate | null
  /** The last day, inclusive; NULL lasts until revoked (D-166). */
  readonly valid_to: CalendarDate | null
  readonly reason: string
}

export function newGrantValues(): GrantFormValues {
  return { ...NEW_SCOPE_VALUES, grantee_soldier_id: null, role_id: null, valid_from: null, valid_to: null, reason: '' }
}

/** A grant's window as instants: from the start of its first day to the start of the day after its last (D-166). */
function windowOf(values: GrantFormValues, timezone: string) {
  return {
    valid_from: values.valid_from === null ? null : startOfDay(values.valid_from, timezone),
    valid_to: values.valid_to === null ? null : startOfDay(addDays(values.valid_to, 1), timezone),
  }
}

function grantInput(values: GrantFormValues, timezone: string) {
  return {
    id: AccessGrantId.parse(crypto.randomUUID()),
    grantee_soldier_id: values.grantee_soldier_id,
    role_id: values.role_id,
    ...scopeColumnsOf(values),
    ...windowOf(values, timezone),
    reason: textOrNull(values.reason),
  }
}

const RANGE_INVERTED: Issue = { path: ['valid_to'], code: 'range_inverted' }

/** The schema's issues, the scope's, and a last day before the first (the domain answers it too, D-042). */
export function grantFormIssues(values: GrantFormValues, timezone: string): Issue[] {
  const input = grantInput(values, timezone)
  const inverted =
    input.valid_from !== null && input.valid_to !== null && compareInstants(input.valid_to, input.valid_from) <= 0
      ? [RANGE_INVERTED]
      : []
  return [...withScopeIssues(values, formIssues(GrantAccessInput, input)), ...inverted]
}

export function toGrantAccessInput(values: GrantFormValues, timezone: string): GrantAccessInput {
  return GrantAccessInput.parse(grantInput(values, timezone))
}

export type GrantState = 'active' | 'scheduled' | 'expired' | 'revoked'

export function grantStateAt(grant: AccessGrant, now: Timestamp): GrantState {
  if (grant.revoked_at !== null) return 'revoked'
  if (compareInstants(grant.valid_from, now) > 0) return 'scheduled'
  if (grant.valid_to !== null && compareInstants(grant.valid_to, now) <= 0) return 'expired'
  return 'active'
}

/** A grant's days in the organization's time zone, the last one inclusive (D-166). */
export function grantDaysOf(grant: AccessGrant, timezone: string): { from: CalendarDate; to: CalendarDate | null } {
  return {
    from: todayIn(timezone, grant.valid_from),
    to: grant.valid_to === null ? null : addDays(todayIn(timezone, grant.valid_to), -1),
  }
}

/** Active and scheduled first, then the rest; newest first inside each. */
export function sortedGrants(grants: readonly AccessGrant[], now: Timestamp): AccessGrant[] {
  const rank = (grant: AccessGrant) => (['active', 'scheduled'].includes(grantStateAt(grant, now)) ? 0 : 1)
  return grants.toSorted((a, b) => rank(a) - rank(b) || compareInstants(b.granted_at, a.granted_at) || a.id.localeCompare(b.id))
}

/** The next instant a live grant starts or ends after `now`, when one changes state on its own (D-169). NULL: none. */
export function nextGrantBoundary(grants: readonly AccessGrant[], now: Timestamp): Timestamp | null {
  const ahead = grants
    .filter((grant) => grant.revoked_at === null)
    .flatMap((grant) => [grant.valid_from, grant.valid_to])
    .filter((instant): instant is Timestamp => instant !== null && compareInstants(instant, now) > 0)
  return ahead.toSorted(compareInstants)[0] ?? null
}
