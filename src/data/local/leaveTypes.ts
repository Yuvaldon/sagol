import {
  ArchiveLeaveTypeGroupInput,
  ArchiveLeaveTypeInput,
  CreateLeaveTypeGroupInput,
  CreateLeaveTypeInput,
  IssueCode,
  LeaveType,
  LeaveTypeGroup,
  ReorderLeaveTypeGroupsInput,
  ReorderLeaveTypesInput,
  RestoreLeaveTypeGroupInput,
  RestoreLeaveTypeInput,
  UpdateLeaveTypeGroupInput,
  UpdateLeaveTypeInput,
  type DataCommands,
  type DataRepositories,
  type Issue,
  type LeaveTypeGroupId,
} from '@contracts'
import { isRotationLeavePaletteKey } from '@config'
import { archiveBuiltInGroupIssues, archiveLeaveTypeGroupIssues, archiveLeaveTypeIssues, rotationLeaveTypeIssues } from '@domain'
import { holds, type ActorScope } from './actor'
import { colorKeyIssues, iconKeyIssues, leaveTypeColorIssues } from './checks'
import { tableOf, type Store } from './store'
import type { LocalDependencies } from './dependencies'
import {
  bySortOrder,
  createReferenceCommands,
  createReferenceRepository,
  createReorderCommand,
  createRestoreCommand,
  noRestoreIssues,
  permissionOf,
  type ReferenceSpec,
  type RowCheck,
} from './reference'

// Leave types and their groups: organization data, nothing predefined (D-032). Both are governed by the
// `leave_types` resource, because D-040 has none for groups (D-113).

const ORGANIZATION = { kind: 'organization' } as const

const GROUP_SPEC: ReferenceSpec<LeaveTypeGroup> = {
  table: 'leave_type_groups',
  resource: 'leave_types',
  schema: LeaveTypeGroup,
  checkTables: ['leave_types'],
  optionalText: [],
  targetOf: () => ORGANIZATION,
  rowIssues: () => Promise.resolve([]),
  // Only the bootstrap and the migration make the built-in group (D-347); a group made by a command is an ordinary one.
  createdColumns: { is_rotation_leave: false },
}

/** The organization's group with this id, or NULL: none named, or none of the organization's. */
async function groupOf(database: Store, scope: ActorScope, id: LeaveTypeGroupId | null): Promise<LeaveTypeGroup | null> {
  if (id === null) return null
  const group = await tableOf(database, 'leave_type_groups').get(id)
  return group?.organization_id === scope.organization_id ? group : null
}

/**
 * What the built-in group fixes on its types (D-347), in the command core so no mode skips it: an absence that asks no
 * reason, in a calm color, and no type moves into the group or out of it. A color it held before stays.
 */
async function rotationIssues({ database, scope, row, before }: RowCheck<LeaveType>): Promise<Issue[]> {
  const group = await groupOf(database, scope, row.group_id)
  const previous = before === null ? null : { group: await groupOf(database, scope, before.group_id), group_id: before.group_id }
  const colors = group?.is_rotation_leave === true ? colorKeyIssues(before?.color_key, row.color_key, isRotationLeavePaletteKey) : []
  return [...rotationLeaveTypeIssues(previous, row, group), ...colors]
}

/** A new group must exist, be visible and be live. An unchanged one is left alone (D-088, D-113). */
async function groupIssues({ database, scope, row, before }: RowCheck<LeaveType>): Promise<Issue[]> {
  if (row.group_id === null || row.group_id === before?.group_id) return []
  const group = await tableOf(database, 'leave_type_groups').get(row.group_id)
  const visible =
    group !== undefined &&
    group.organization_id === scope.organization_id &&
    holds(scope, permissionOf('leave_types', 'view'), ORGANIZATION)
  if (!visible) return [{ path: ['group_id'], code: IssueCode.enum.reference_not_found }]
  if (group.archived_at !== null) return [{ path: ['group_id'], code: IssueCode.enum.reference_archived }]
  return []
}

const TYPE_SPEC: ReferenceSpec<LeaveType> = {
  table: 'leave_types',
  resource: 'leave_types',
  schema: LeaveType,
  checkTables: ['leave_type_groups'],
  optionalText: [],
  targetOf: () => ORGANIZATION,
  rowIssues: async (check) => [
    ...leaveTypeColorIssues(check.before?.color_key, check.row.color_key),
    ...iconKeyIssues(check.before?.icon_key, check.row.icon_key),
    ...(await groupIssues(check)),
    ...(await rotationIssues(check)),
  ],
}

export function createLeaveTypeGroupRepository(dependencies: LocalDependencies): DataRepositories['leave_type_groups'] {
  return createReferenceRepository(dependencies, GROUP_SPEC, bySortOrder)
}

/** By `sort_order` inside a group. The order of the groups themselves is the caller's (D-113). */
export function createLeaveTypeRepository(dependencies: LocalDependencies): DataRepositories['leave_types'] {
  return createReferenceRepository(dependencies, TYPE_SPEC, bySortOrder)
}

export function createLeaveTypeGroupCommands(dependencies: LocalDependencies): DataCommands['leave_type_groups'] {
  return {
    ...createReferenceCommands(dependencies, GROUP_SPEC, {
      create: CreateLeaveTypeGroupInput,
      update: UpdateLeaveTypeGroupInput,
      archive: ArchiveLeaveTypeGroupInput,
      placementOf: () => ORGANIZATION,
      archiveIssues: async (database, scope, group) => {
        const builtIn = archiveBuiltInGroupIssues(group)
        if (builtIn.length > 0) return builtIn
        const types = await tableOf(database, 'leave_types').where('organization_id').equals(scope.organization_id).toArray()
        return archiveLeaveTypeGroupIssues(types, group.id)
      },
    }),
    reorder: createReorderCommand(dependencies, GROUP_SPEC, ReorderLeaveTypeGroupsInput, () => null),
    restore: createRestoreCommand(dependencies, GROUP_SPEC, { input: RestoreLeaveTypeGroupInput, restoreIssues: noRestoreIssues }),
  }
}

export function createLeaveTypeCommands(dependencies: LocalDependencies): DataCommands['leave_types'] {
  return {
    ...createReferenceCommands(dependencies, TYPE_SPEC, {
      create: CreateLeaveTypeInput,
      update: UpdateLeaveTypeInput,
      archive: ArchiveLeaveTypeInput,
      placementOf: () => ORGANIZATION,
      // The built-in group always keeps a live type (D-347).
      archiveIssues: async (database, scope, type) => {
        const group = await groupOf(database, scope, type.group_id)
        if (group?.is_rotation_leave !== true) return []
        const types = await tableOf(database, 'leave_types').where('organization_id').equals(scope.organization_id).toArray()
        return archiveLeaveTypeIssues(types, type, group)
      },
    }),
    // Types are ordered inside their group (D-113).
    reorder: createReorderCommand(dependencies, TYPE_SPEC, ReorderLeaveTypesInput, (row) => row.group_id),
    // A restored type needs a live group (D-371). It never left its group, so the built-in group's rules still hold.
    restore: createRestoreCommand(dependencies, TYPE_SPEC, {
      input: RestoreLeaveTypeInput,
      restoreIssues: (check) => groupIssues({ ...check, before: null }),
    }),
  }
}
