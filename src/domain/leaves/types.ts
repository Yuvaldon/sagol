import { IssueCode, type Issue, type LeaveType, type LeaveTypeGroupId } from '@contracts'

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
