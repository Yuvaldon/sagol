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
  UpdateLeaveTypeGroupInput,
  UpdateLeaveTypeInput,
  type DataCommands,
  type DataRepositories,
  type Issue,
} from '@contracts'
import { archiveLeaveTypeGroupIssues } from '@domain'
import { holds } from './actor'
import { colorKeyIssues, iconKeyIssues } from './checks'
import { tableOf } from './store'
import type { LocalDependencies } from './dependencies'
import {
  bySortOrder,
  createReferenceCommands,
  createReferenceRepository,
  createReorderCommand,
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
    ...colorKeyIssues(check.before?.color_key, check.row.color_key),
    ...iconKeyIssues(check.before?.icon_key, check.row.icon_key),
    ...(await groupIssues(check)),
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
        const types = await tableOf(database, 'leave_types').where('organization_id').equals(scope.organization_id).toArray()
        return archiveLeaveTypeGroupIssues(types, group.id)
      },
    }),
    reorder: createReorderCommand(dependencies, GROUP_SPEC, ReorderLeaveTypeGroupsInput, () => null),
  }
}

export function createLeaveTypeCommands(dependencies: LocalDependencies): DataCommands['leave_types'] {
  return {
    ...createReferenceCommands(dependencies, TYPE_SPEC, {
      create: CreateLeaveTypeInput,
      update: UpdateLeaveTypeInput,
      archive: ArchiveLeaveTypeInput,
      placementOf: () => ORGANIZATION,
    }),
    // Types are ordered inside their group (D-113).
    reorder: createReorderCommand(dependencies, TYPE_SPEC, ReorderLeaveTypesInput, (row) => row.group_id),
  }
}
