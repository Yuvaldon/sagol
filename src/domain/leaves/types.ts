import { AvailabilityEffect, IssueCode, type Issue, type LeaveType, type LeaveTypeGroup, type LeaveTypeGroupId } from '@contracts'

/**
 * A group stays while a type that is not archived belongs to it, so no live type sits under a name nobody can
 * see (D-113).
 */
export function archiveLeaveTypeGroupIssues(
  types: Iterable<Pick<LeaveType, 'group_id' | 'archived_at'>>,
  groupId: LeaveTypeGroupId,
): Issue[] {
  for (const type of types) {
    if (type.group_id === groupId && type.archived_at === null) return [{ path: [], code: IssueCode.enum.group_in_use }]
  }
  return []
}

type GroupMarker = Pick<LeaveTypeGroup, 'id' | 'is_rotation_leave'>

/** The organization's built-in "סבב יציאות" group is never archived (D-346). */
export function archiveBuiltInGroupIssues(group: Pick<LeaveTypeGroup, 'is_rotation_leave'>): Issue[] {
  return group.is_rotation_leave ? [{ path: [], code: IssueCode.enum.group_builtin }] : []
}

/** Whether a type belongs to the built-in group; false for a type unknown or with no group. */
export function isRotationLeaveType(
  type: Pick<LeaveType, 'group_id'> | null | undefined,
  groups: Iterable<GroupMarker>,
): boolean {
  if (type?.group_id == null) return false
  for (const group of groups) if (group.id === type.group_id) return group.is_rotation_leave
  return false
}

/** The built-in group always holds a type that is not archived: its last one stays (D-346). */
export function archiveLeaveTypeIssues(
  types: Iterable<Pick<LeaveType, 'id' | 'group_id' | 'archived_at'>>,
  type: Pick<LeaveType, 'id' | 'group_id'>,
  group: Pick<LeaveTypeGroup, 'is_rotation_leave'> | null,
): Issue[] {
  if (group?.is_rotation_leave !== true) return []
  for (const other of types) {
    if (other.id !== type.id && other.group_id === type.group_id && other.archived_at === null) return []
  }
  return [{ path: [], code: IssueCode.enum.last_rotation_type }]
}

/**
 * What the built-in group fixes on a type (D-346): its types are absences that ask no reason, and a type neither moves
 * into the group nor out of it. `before` is NULL on create; each group is NULL when the type has none.
 */
export function rotationLeaveTypeIssues(
  before: { readonly group: Pick<LeaveTypeGroup, 'is_rotation_leave'> | null; readonly group_id: LeaveTypeGroupId | null } | null,
  after: Pick<LeaveType, 'group_id' | 'availability_effect' | 'requires_reason'>,
  group: Pick<LeaveTypeGroup, 'is_rotation_leave'> | null,
): Issue[] {
  const fixed = (field: keyof LeaveType): Issue => ({ path: [field], code: IssueCode.enum.fixed_by_group })
  const issues: Issue[] = []
  const moved = before !== null && before.group_id !== after.group_id
  if (moved && (before.group?.is_rotation_leave === true || group?.is_rotation_leave === true)) issues.push(fixed('group_id'))
  if (group?.is_rotation_leave === true) {
    if (after.availability_effect !== AvailabilityEffect.enum.unavailable) issues.push(fixed('availability_effect'))
    if (after.requires_reason) issues.push(fixed('requires_reason'))
  }
  return issues
}
