import {
  AvailabilityEffect,
  CreateLeaveTypeGroupInput,
  CreateLeaveTypeInput,
  LeaveTypeGroupId,
  LeaveTypeId,
  type Issue,
  type LeaveType,
  type LeaveTypeGroup,
  type UpdateLeaveTypeInput,
} from '@contracts'
import { FIRST_ROTATION_LEAVE_COLOR, ROTATION_LEAVE_PALETTE_KEYS, type PaletteKey } from '@config'
import { archiveLeaveTypeIssues, isRotationLeaveType } from '@domain'
import { formIssues } from '../forms/issues'
import { bySortOrder, nextSortOrder } from '../forms/order'

// Leave types and their groups, between the store and the drawer (D-113). Pure.

/** A group and its types, or the types with no live group (`group` NULL). */
export interface LeaveTypeSection {
  readonly group: LeaveTypeGroup | null
  readonly types: readonly LeaveType[]
}

/**
 * Live groups in their order, each with its live types in theirs, then the types with no live group. A group
 * with no type still has its section, so it can be filled. The section of ungrouped types appears only when it
 * holds one.
 */
export function leaveTypeSections(groups: readonly LeaveTypeGroup[], types: readonly LeaveType[]): LeaveTypeSection[] {
  const live = groups.filter((group) => group.archived_at === null).toSorted(bySortOrder)
  const liveIds = new Set(live.map((group) => group.id))
  const liveTypes = types.filter((type) => type.archived_at === null).toSorted(bySortOrder)
  const sections: LeaveTypeSection[] = live.map((group) => ({
    group,
    types: liveTypes.filter((type) => type.group_id === group.id),
  }))
  const loose = liveTypes.filter((type) => type.group_id === null || !liveIds.has(type.group_id))
  return loose.length === 0 ? sections : [...sections, { group: null, types: loose }]
}

/** The live types, in the order the drawer shows them. */
export function orderedLeaveTypes(groups: readonly LeaveTypeGroup[], types: readonly LeaveType[]): LeaveType[] {
  return leaveTypeSections(groups, types).flatMap((section) => section.types)
}

// ----------------------------------------------------------------------- types

export interface LeaveTypeFormValues {
  readonly name: string
  readonly group_id: LeaveTypeGroupId | null
  /** NULL until a color is picked; the schema then answers `required`. */
  readonly color_key: string | null
  readonly icon_key: string | null
  readonly availability_effect: AvailabilityEffect
  readonly requires_reason: boolean
}

/** A new type is an absence that needs no reason, until the form says otherwise (D-032). */
export const NEW_LEAVE_TYPE_VALUES: LeaveTypeFormValues = {
  name: '',
  group_id: null,
  color_key: null,
  icon_key: null,
  availability_effect: AvailabilityEffect.enum.unavailable,
  requires_reason: false,
}

export function leaveTypeFormValues(type: LeaveType): LeaveTypeFormValues {
  return {
    name: type.name,
    group_id: type.group_id,
    color_key: type.color_key,
    icon_key: type.icon_key,
    availability_effect: type.availability_effect,
    requires_reason: type.requires_reason,
  }
}

function createTypeInput(values: LeaveTypeFormValues, types: readonly LeaveType[]) {
  const siblings = types.filter((type) => type.archived_at === null && type.group_id === values.group_id)
  return { id: LeaveTypeId.parse(crypto.randomUUID()), ...values, sort_order: nextSortOrder(siblings) }
}

/** The same field codes the adapter answers (D-068). */
export function leaveTypeFormIssues(values: LeaveTypeFormValues): Issue[] {
  return formIssues(CreateLeaveTypeInput, createTypeInput(values, []))
}

export function toCreateLeaveTypeInput(values: LeaveTypeFormValues, types: readonly LeaveType[]): CreateLeaveTypeInput {
  return CreateLeaveTypeInput.parse(createTypeInput(values, types))
}

/** NULL when nothing changed. A form opened at `openedVersion` answers `stale_version` to a later change. */
export function toUpdateLeaveTypeInput(
  type: LeaveType,
  openedVersion: number,
  values: LeaveTypeFormValues,
): UpdateLeaveTypeInput | null {
  const changes = {
    ...(values.name === type.name ? {} : { name: values.name }),
    ...(values.group_id === type.group_id ? {} : { group_id: values.group_id }),
    ...(values.color_key === type.color_key || values.color_key === null ? {} : { color_key: values.color_key }),
    ...(values.icon_key === type.icon_key ? {} : { icon_key: values.icon_key }),
    ...(values.availability_effect === type.availability_effect ? {} : { availability_effect: values.availability_effect }),
    ...(values.requires_reason === type.requires_reason ? {} : { requires_reason: values.requires_reason }),
  }
  if (Object.keys(changes).length === 0) return null
  return { id: type.id, expected_version: openedVersion, changes }
}

/** The live types of `type`'s group, in order: what moving it up or down reorders (D-113). */
export function typesOfGroup(types: readonly LeaveType[], groupId: LeaveTypeGroupId | null): LeaveType[] {
  return types.filter((type) => type.archived_at === null && type.group_id === groupId).toSorted(bySortOrder)
}

// ---------------------------------------------------------------------- groups

export function liveGroups(groups: readonly LeaveTypeGroup[]): LeaveTypeGroup[] {
  return groups.filter((group) => group.archived_at === null).toSorted(bySortOrder)
}

function createGroupInput(name: string, groups: readonly LeaveTypeGroup[]) {
  return { id: LeaveTypeGroupId.parse(crypto.randomUUID()), name, sort_order: nextSortOrder(liveGroups(groups)) }
}

export function leaveTypeGroupFormIssues(name: string): Issue[] {
  return formIssues(CreateLeaveTypeGroupInput, createGroupInput(name, []))
}

export function toCreateLeaveTypeGroupInput(name: string, groups: readonly LeaveTypeGroup[]): CreateLeaveTypeGroupInput {
  return CreateLeaveTypeGroupInput.parse(createGroupInput(name, groups))
}

// ------------------------------------------------------------ built-in group

/** The organization's built-in "סבב יציאות" group (D-347), or NULL while the store does not show it. */
export function rotationLeaveGroup(groups: readonly LeaveTypeGroup[]): LeaveTypeGroup | null {
  return groups.find((group) => group.is_rotation_leave) ?? null
}

/** The live groups an ordinary type may join: every one but the built-in group, whose types it makes itself (D-347). */
export function ordinaryGroups(groups: readonly LeaveTypeGroup[]): LeaveTypeGroup[] {
  return liveGroups(groups).filter((group) => !group.is_rotation_leave)
}

/** Whether `type` belongs to the built-in group, so its group, effect and reason are fixed and no reason is asked. */
export function isRotationLeave(type: Pick<LeaveType, 'group_id'> | null | undefined, groups: readonly LeaveTypeGroup[]): boolean {
  return isRotationLeaveType(type, groups)
}

/** Whether archiving `type` is refused: the built-in group keeps its last live type (D-347). */
export function isLastRotationLeaveType(type: LeaveType, groups: readonly LeaveTypeGroup[], types: readonly LeaveType[]): boolean {
  const group = groups.find((candidate) => candidate.id === type.group_id) ?? null
  return archiveLeaveTypeIssues(types, type, group).length > 0
}

/**
 * The number the next type of the built-in group is named with (D-347): how many types it ever held, archived included,
 * so a name is never given twice. The first type is named without one, so the first added is 1.
 */
export function nextRotationLeaveNumber(group: LeaveTypeGroup, types: readonly LeaveType[]): number {
  return types.filter((type) => type.group_id === group.id).length
}

/** The first calm color no live type of the group holds; once all are held, they are given again in turn. */
export function nextRotationLeaveColor(group: LeaveTypeGroup, types: readonly LeaveType[]): PaletteKey {
  const held = typesOfGroup(types, group.id).map((type) => type.color_key)
  const free = ROTATION_LEAVE_PALETTE_KEYS.find((key) => !held.includes(key))
  if (free !== undefined) return free
  return ROTATION_LEAVE_PALETTE_KEYS[held.length % ROTATION_LEAVE_PALETTE_KEYS.length] ?? FIRST_ROTATION_LEAVE_COLOR
}

/** A new type of the built-in group, with no form: the name the UI proposes, the next calm color, last in order. */
export function toAddRotationLeaveTypeInput(group: LeaveTypeGroup, types: readonly LeaveType[], name: string): CreateLeaveTypeInput {
  return CreateLeaveTypeInput.parse({
    id: LeaveTypeId.parse(crypto.randomUUID()),
    group_id: group.id,
    name,
    color_key: nextRotationLeaveColor(group, types),
    icon_key: null,
    availability_effect: AvailabilityEffect.enum.unavailable,
    requires_reason: false,
    sort_order: nextSortOrder(typesOfGroup(types, group.id)),
  })
}
