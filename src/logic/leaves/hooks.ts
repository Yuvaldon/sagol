import {
  type CreateLeaveInput,
  type Leave,
  type LeaveQuery,
  type LeaveStatus,
  type LeaveType,
  type LeaveTypeGroup,
  type PermissionCheck,
  type Result,
  type Soldier,
  type SoldierId,
} from '@contracts'
import { LEAVE_PERMISSIONS } from '@domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { checkOn } from '../permissions/checks'
import { useCan } from '../permissions/hooks'
import { cachedLeaves, leaveListKey, restoreLeaves, showLeave } from './cache'
import { byName } from '../roster/roster'
import { QUERY_KEYS } from '../queries/client'
import { steppedItems } from '../forms/order'
import { useCommand } from '../queries/command'
import { loaded, type Loaded } from '../queries/loaded'
import { unwrap } from '../queries/results'
import { usePorts } from '../runtime/context'
import { useSession } from '../session/hooks'
import type { DateWindow } from '../view-state/window'
import { optimisticLeave, toCreateLeaveInput, type NewLeaveValues } from './forms'
import {
  toCreateLeaveTypeGroupInput,
  toCreateLeaveTypeInput,
  toUpdateLeaveTypeInput,
  typesOfGroup,
  liveGroups,
  type LeaveTypeFormValues,
} from './leaveTypes'

// Reading and changing leave types and leaves (D-113, D-114, D-115).

const WITH_ARCHIVED = { include_archived: true }

/** Statuses the timeline draws (D-070, D-111). */
const DRAWN_STATUSES: LeaveStatus[] = ['pending', 'approved']

/** Every group, archived ones too: a type keeps showing the name of its group. */
export function useLeaveTypeGroups(): Loaded<readonly LeaveTypeGroup[]> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.leaveTypeGroups, WITH_ARCHIVED],
      queryFn: () => unwrap(data.repositories.leave_type_groups.list(WITH_ARCHIVED)),
    }),
  )
}

/** Every type, archived ones too: a leave keeps showing its type (D-113). */
export function useLeaveTypes(): Loaded<readonly LeaveType[]> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.leaveTypes, WITH_ARCHIVED],
      queryFn: () => unwrap(data.repositories.leave_types.list(WITH_ARCHIVED)),
    }),
  )
}

function leaveQueryOf(window: DateWindow): LeaveQuery {
  return { window: { start_date: window.from, end_date: window.to }, soldier_ids: null, statuses: DRAWN_STATUSES }
}

/** The pending and approved leaves the actor may see that overlap the window. Loading while there is no window. */
export function useLeaves(window: DateWindow | null): Loaded<readonly Leave[]> {
  const { data } = usePorts()
  const query = useMemo(() => (window === null ? null : leaveQueryOf(window)), [window])
  return loaded(
    useQuery({
      queryKey: leaveListKey(query ?? NO_WINDOW_QUERY),
      queryFn: () => (query === null ? Promise.resolve([]) : unwrap(data.repositories.leaves.list(query))),
      enabled: query !== null,
    }),
  )
}

/** Never asked: the key of a list that waits for its window. */
const NO_WINDOW_QUERY: LeaveQuery = { window: null, soldier_ids: [], statuses: DRAWN_STATUSES }

/**
 * `leaves.create` with an optimistic update (D-115): the leave joins every cached window it overlaps at once,
 * and a refusal takes it back. The change feed and the refetch then bring the stored row.
 */
export function useCreateLeave() {
  const { data, time } = usePorts()
  const session = useSession()
  const client = useQueryClient()
  const actor = session.status === 'ready' && session.value.status === 'linked' ? session.value : null

  const mutation = useMutation({
    mutationFn: (input: CreateLeaveInput): Promise<Result<Leave>> => data.commands.leaves.create(input),
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: QUERY_KEYS.leaves })
      const previous = cachedLeaves(client)
      if (actor !== null) {
        const leave = optimisticLeave(input, actor, time.now())
        showLeave(client, leave)
      }
      return { previous }
    },
    onSettled: async (result, _error, _input, context) => {
      if (result?.ok !== true && context !== undefined) {
        restoreLeaves(client, context.previous)
      }
      await Promise.all(
        [QUERY_KEYS.leaves, QUERY_KEYS.can].map((queryKey) => client.invalidateQueries({ queryKey })),
      )
    },
  })
  return {
    run: (values: NewLeaveValues) => mutation.mutateAsync(toCreateLeaveInput(values)),
    isPending: mutation.isPending,
  }
}

export function useLeaveTypeCommands() {
  const { data } = usePorts()
  const types = data.commands.leave_types
  const keys = [QUERY_KEYS.leaveTypes, QUERY_KEYS.leaveTypeGroups]

  const create = useCommand(keys, ({ values, all }: { values: LeaveTypeFormValues; all: readonly LeaveType[] }) =>
    types.create(toCreateLeaveTypeInput(values, all)),
  )
  const update = useCommand(
    keys,
    async ({ type, openedVersion, values }: { type: LeaveType; openedVersion: number; values: LeaveTypeFormValues }) => {
      const input = toUpdateLeaveTypeInput(type, openedVersion, values)
      const unchanged: Result<LeaveType> = { ok: true, value: type }
      return input === null ? unchanged : types.update(input)
    },
  )
  const archive = useCommand(keys, (type: LeaveType) => types.archive({ id: type.id, expected_version: type.version }))
  /** Up or down inside its group (D-113). */
  const step = useCommand(
    keys,
    async ({ type, direction, all }: { type: LeaveType; direction: -1 | 1; all: readonly LeaveType[] }) => {
      const items = steppedItems(typesOfGroup(all, type.group_id), type, direction)
      const unchanged: Result<LeaveType[]> = { ok: true, value: [] }
      return items === null ? unchanged : types.reorder({ items })
    },
  )
  return { create, update, archive, step }
}

export function useLeaveTypeGroupCommands() {
  const { data } = usePorts()
  const groups = data.commands.leave_type_groups
  const keys = [QUERY_KEYS.leaveTypeGroups]

  const create = useCommand(keys, ({ name, all }: { name: string; all: readonly LeaveTypeGroup[] }) =>
    groups.create(toCreateLeaveTypeGroupInput(name, all)),
  )
  const rename = useCommand(keys, ({ group, openedVersion, name }: { group: LeaveTypeGroup; openedVersion: number; name: string }) => {
    if (name === group.name) {
      const unchanged: Result<LeaveTypeGroup> = { ok: true, value: group }
      return Promise.resolve(unchanged)
    }
    return groups.update({ id: group.id, expected_version: openedVersion, changes: { name } })
  })
  const archive = useCommand(keys, (group: LeaveTypeGroup) => groups.archive({ id: group.id, expected_version: group.version }))
  const step = useCommand(
    keys,
    async ({ group, direction, all }: { group: LeaveTypeGroup; direction: -1 | 1; all: readonly LeaveTypeGroup[] }) => {
      const items = steppedItems(liveGroups(all), group, direction)
      const unchanged: Result<LeaveTypeGroup[]> = { ok: true, value: [] }
      return items === null ? unchanged : groups.reorder({ items })
    },
  )
  return { create, rename, archive, step }
}

// ---------------------------------------------------------------------- hints

const TYPE_CHECKS = {
  create: { permission: { resource: 'leave_types', action: 'create' }, target: { kind: 'organization' } },
  update: { permission: { resource: 'leave_types', action: 'update' }, target: { kind: 'organization' } },
  archive: { permission: { resource: 'leave_types', action: 'delete' }, target: { kind: 'organization' } },
} as const satisfies Record<string, PermissionCheck>

const TYPE_CHECK_LIST: readonly PermissionCheck[] = Object.values(TYPE_CHECKS)

/** Both tables are `leave_types` at organization scope (D-113). */
export function useLeaveTypePermissions() {
  const can = useCan(TYPE_CHECK_LIST)
  return { create: can(TYPE_CHECKS.create), update: can(TYPE_CHECKS.update), archive: can(TYPE_CHECKS.archive) }
}

/**
 * Who the actor may create a leave for, and approve now, among the soldiers they see (D-114, D-115). The form offers
 * active soldiers only (D-125); the command still takes an inactive one. A hint: the command decides again.
 */
export function useLeaveCreation(soldiers: readonly Soldier[]) {
  const checks = useMemo(
    () =>
      soldiers.flatMap((soldier) => [
        checkOn(LEAVE_PERMISSIONS.create, soldier.id),
        checkOn(LEAVE_PERMISSIONS.approve, soldier.id),
      ]),
    [soldiers],
  )
  const can = useCan(checks)
  return useMemo(() => {
    const creatable = soldiers
      .filter((soldier) => soldier.status === 'active' && soldier.archived_at === null)
      .filter((soldier) => can(checkOn(LEAVE_PERMISSIONS.create, soldier.id)))
      .toSorted(byName)
    return {
      /** The soldiers a leave can be created for, by name (D-094). */
      soldiers: creatable,
      any: creatable.length > 0,
      /** Whether the actor may approve anyone they see: who the inbox is for (D-120). */
      approvesAny: soldiers.some((soldier) => can(checkOn(LEAVE_PERMISSIONS.approve, soldier.id))),
      canApprove: (soldierId: SoldierId) => can(checkOn(LEAVE_PERMISSIONS.approve, soldierId)),
    }
  }, [can, soldiers])
}
