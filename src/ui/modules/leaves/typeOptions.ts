import type { LeaveType, LeaveTypeGroup, LeaveTypeId } from '@contracts'
import { orderedLeaveTypes } from '@logic'
import type { SelectOption } from '../../primitives/SelectField'

/**
 * Live types in their order, each named under its group, and `keep` first when it is archived: a leave keeps its type
 * (D-113).
 */
export function leaveTypeOptions(
  groups: readonly LeaveTypeGroup[],
  types: readonly LeaveType[],
  keep: LeaveTypeId | null = null,
): SelectOption<LeaveTypeId>[] {
  const groupName = new Map(groups.map((group) => [group.id, group.name]))
  const live = orderedLeaveTypes(groups, types)
  const own = keep === null ? undefined : types.find((type) => type.id === keep)
  const listed = own === undefined || live.some((type) => type.id === own.id) ? live : [own, ...live]
  return listed.map((type) => {
    const group = type.group_id === null ? undefined : groupName.get(type.group_id)
    return { key: type.id, label: { text: group === undefined ? type.name : `${group} · ${type.name}` }, value: type.id }
  })
}
