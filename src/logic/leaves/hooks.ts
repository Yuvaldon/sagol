import {
  LeaveQuery,
  type CreateLeaveInput,
  type Leave,
  type LeaveStatus,
  type LeaveType,
  type LeaveTypeGroup,
  type PermissionCheck,
  type Result,
  type Soldier,
  type SoldierId,
} from '@contracts'
import { LEAVE_PERMISSIONS, compareDates, soldierTarget } from '@domain'
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useCan } from '../permissions/hooks'
import { byName } from '../roster/roster'
import { QUERY_KEYS } from '../queries/client'
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
} from './types'

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

/** The pending and approved leaves the actor may see that overlap the window. */
export function useLeaves(window: DateWindow): Loaded<readonly Leave[]> {
  const { data } = usePorts()
  const query = useMemo(() => leaveQueryOf(window), [window])
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.leaves, query],
      queryFn: () => unwrap(data.repositories.leaves.list(query)),
    }),
  )
}

/** The query a cached list of leaves asked for, read back from its key. */
function queryOfKey(key: QueryKey): LeaveQuery | null {
  const parsed = LeaveQuery.safeParse(key[QUERY_KEYS.leaves.length])
  return parsed.success ? parsed.data : null
}

/** Whether the list a query asked for holds this leave: its dates, its soldier and its status. */
function listHolds(query: LeaveQuery, leave: Leave): boolean {
  const { window } = query
  const inWindow =
    window === null ||
    (compareDates(leave.start_date, window.end_date) <= 0 && compareDates(window.start_date, leave.end_date) <= 0)
  return (
    inWindow &&
    (query.soldier_ids === null || query.soldier_ids.includes(leave.soldier_id)) &&
    (query.statuses === null || query.statuses.includes(leave.status))
  )
}

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
      const previous = client.getQueriesData<readonly Leave[]>({ queryKey: QUERY_KEYS.leaves })
      if (actor !== null) {
        const leave = optimisticLeave(input, actor, time.now())
        for (const [key, rows] of previous) {
          const query = queryOfKey(key)
          if (rows === undefined || query === null || !listHolds(query, leave)) continue
          client.setQueryData<readonly Leave[]>(key, [...rows, leave])
        }
      }
      return { previous }
    },
    onSettled: async (result, _error, _input, context) => {
      if (result?.ok !== true && context !== undefined) {
        for (const [key, rows] of context.previous) client.setQueryData(key, rows)
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
      const group = typesOfGroup(all, type.group_id)
      const from = group.findIndex((row) => row.id === type.id)
      const other = group[from + direction]
      const unchanged: Result<LeaveType[]> = { ok: true, value: [] }
      if (from < 0 || other === undefined) return unchanged
      const order = group.map((row, index) => (index === from ? other : index === from + direction ? type : row))
      return types.reorder({ items: order.map((row) => ({ id: row.id, expected_version: row.version })) })
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
      const live = liveGroups(all)
      const from = live.findIndex((row) => row.id === group.id)
      const other = live[from + direction]
      const unchanged: Result<LeaveTypeGroup[]> = { ok: true, value: [] }
      if (from < 0 || other === undefined) return unchanged
      const order = live.map((row, index) => (index === from ? other : index === from + direction ? group : row))
      return groups.reorder({ items: order.map((row) => ({ id: row.id, expected_version: row.version })) })
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

const leaveCheck = (permission: PermissionCheck['permission'], soldierId: SoldierId): PermissionCheck => ({
  permission,
  target: soldierTarget(soldierId),
})

/**
 * Who the actor may create a leave for, and approve now, among the soldiers they see (D-114, D-115). A hint:
 * the command decides again.
 */
export function useLeaveCreation(soldiers: readonly Soldier[]) {
  const checks = useMemo(
    () =>
      soldiers.flatMap((soldier) => [
        leaveCheck(LEAVE_PERMISSIONS.create, soldier.id),
        leaveCheck(LEAVE_PERMISSIONS.approve, soldier.id),
      ]),
    [soldiers],
  )
  const can = useCan(checks)
  return useMemo(() => {
    const creatable = soldiers
      .filter((soldier) => can(leaveCheck(LEAVE_PERMISSIONS.create, soldier.id)))
      .toSorted(byName)
    return {
      /** The soldiers a leave can be created for, by name (D-094). */
      soldiers: creatable,
      any: creatable.length > 0,
      canApprove: (soldierId: SoldierId) => can(leaveCheck(LEAVE_PERMISSIONS.approve, soldierId)),
    }
  }, [can, soldiers])
}
