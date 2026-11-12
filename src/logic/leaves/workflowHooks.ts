import {
  LeaveCommentId,
  LeaveId,
  type AvailabilityRuleId,
  type CommentVisibility,
  type Leave,
  type LeaveComment,
  type LeaveEvent,
  type LeaveTransition,
  type PermissionCheck,
  type Result,
} from '@contracts'
import { COMMENT_PERMISSIONS, LEAVE_PERMISSIONS } from '@domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { checkOn } from '../permissions/checks'
import { useCan } from '../permissions/hooks'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { loaded, type Loaded } from '../queries/loaded'
import { unwrap } from '../queries/results'
import type { WithProperties } from '../properties/properties'
import { usePorts } from '../runtime/context'
import { useSoldiersWithArchived } from '../roster/hooks'
import { useCurrentOrganization, useSession } from '../session/hooks'
import { useToday } from '../session/today'
import { cachedLeaves, leaveKey, leaveListKey, restoreLeaves, showLeave } from './cache'
import {
  EDIT_PERMISSION,
  PENDING_QUERY,
  myLeaveGroups,
  myLeavesQuery,
  type MyLeaves,
  closedLeaves,
  closedQuery,
  editReturnsToPending,
  isEditable,
  leaveAfterStep,
  leaveSteps,
  leaveThread,
  pendingRequests,
  toTransitionInput,
  toUpdateLeaveInput,
  type LeaveSoldierState,
  type LeaveEditValues,
  type ThreadEntry,
} from './workflow'

// Reading and changing one leave, and the lists of the inbox (D-117 … D-120).

function useActor() {
  const session = useSession()
  return session.status === 'ready' && session.value.status === 'linked' ? session.value : null
}

/** One leave, of any status. An id that is not a leave's, or a leave the actor cannot see, fails `not_found`. */
export function useLeave(id: string): Loaded<Leave> {
  const { data } = usePorts()
  const parsed = LeaveId.safeParse(id)
  const leaveId = parsed.success ? parsed.data : null
  const state: Loaded<Leave | null> = loaded(
    useQuery({
      queryKey: leaveId === null ? [...QUERY_KEYS.leaves, { id: null }] : leaveKey(leaveId),
      queryFn: () => (leaveId === null ? Promise.resolve(null) : unwrap(data.repositories.leaves.get(leaveId))),
    }),
  )
  if (state.status !== 'ready') return state
  return state.value === null ? { status: 'failed', error: { code: 'not_found' } } : { status: 'ready', value: state.value }
}

/** The events and the comments of a leave the actor may read, as one thread (D-119). */
export function useLeaveThread(leaveId: LeaveId): Loaded<readonly ThreadEntry[]> {
  const { data } = usePorts()
  const query = useMemo(() => ({ leave_id: leaveId }), [leaveId])
  const events: Loaded<readonly LeaveEvent[]> = loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.leaveEvents, query],
      queryFn: () => unwrap(data.repositories.leave_events.list(query)),
    }),
  )
  const comments: Loaded<readonly LeaveComment[]> = loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.leaveComments, query],
      queryFn: () => unwrap(data.repositories.leave_comments.list(query)),
    }),
  )
  return useMemo((): Loaded<readonly ThreadEntry[]> => {
    if (events.status !== 'ready') return events
    if (comments.status !== 'ready') return comments
    return { status: 'ready', value: leaveThread(events.value, comments.value) }
  }, [events, comments])
}

// ---------------------------------------------------------------------- hints

/**
 * What the actor may do with this leave now (OI-024): the steps its status allows, each with the permission the
 * command checks, plus editing and commenting. A hint: the command decides again.
 */
export function useLeaveActions(leave: Leave) {
  const { time } = usePorts()
  const actor = useActor()
  const organization = useCurrentOrganization()
  const soldier = useLeaveSoldier(leave)
  const steps = useMemo(
    () =>
      actor === null
        ? new Map<LeaveTransition, PermissionCheck['permission']>()
        : leaveSteps(leave, actor.soldier_id, time.now(), soldier),
    [leave, actor, time, soldier],
  )
  const checks = useMemo(
    () => [
      ...[...steps.values()].map((permission) => checkOn(permission, leave.soldier_id)),
      checkOn(EDIT_PERMISSION, leave.soldier_id),
      checkOn(LEAVE_PERMISSIONS.approve, leave.soldier_id),
      checkOn(COMMENT_PERMISSIONS.shared.create, leave.soldier_id),
      checkOn(COMMENT_PERMISSIONS.internal.create, leave.soldier_id),
    ],
    [steps, leave.soldier_id],
  )
  const can = useCan(checks)
  return useMemo(() => {
    const step = (transition: LeaveTransition) => {
      const permission = steps.get(transition)
      return permission !== undefined && can(checkOn(permission, leave.soldier_id))
    }
    const mayApprove = can(checkOn(LEAVE_PERMISSIONS.approve, leave.soldier_id))
    const policy = organization.status === 'ready' && organization.value !== null ? organization.value.settings.reschedule_policy : null
    return {
      approve: step('approve'),
      reject: step('reject'),
      cancel: step('cancel'),
      reopen: step('reopen'),
      /** Only pending and approved leaves of a soldier who is not archived are edited (D-064, D-124). */
      edit: isEditable(leave, soldier) && can(checkOn(EDIT_PERMISSION, leave.soldier_id)),
      comment: {
        shared: can(checkOn(COMMENT_PERMISSIONS.shared.create, leave.soldier_id)),
        internal: can(checkOn(COMMENT_PERMISSIONS.internal.create, leave.soldier_id)),
      },
      /** Whether sending these values returns the leave to pending. False while the policy is not known. */
      returnsToPending: (values: LeaveEditValues) =>
        actor !== null && policy !== null && editReturnsToPending(leave, values, policy, mayApprove, actor.soldier_id, time.now()),
    }
  }, [steps, can, leave, organization, actor, time, soldier])
}

/** Whether the leave's soldier is archived, as far as the actor sees them (D-124). */
function useLeaveSoldier(leave: Leave): LeaveSoldierState {
  const soldiers = useSoldiersWithArchived()
  const archivedAt =
    soldiers.status === 'ready' ? (soldiers.value.find((soldier) => soldier.id === leave.soldier_id)?.archived_at ?? null) : null
  return useMemo(() => ({ archived_at: archivedAt }), [archivedAt])
}

// ------------------------------------------------------------------- commands

const AFTER_A_LEAVE_COMMAND = [QUERY_KEYS.leaves, QUERY_KEYS.leaveEvents, QUERY_KEYS.leaveComments, QUERY_KEYS.can]

/**
 * `leaves.transition` with an optimistic update (D-119): the leave shows its new status at once, in the drawer,
 * on the board and in the inbox, and a refusal takes it back. After any answer the stored rows are read again,
 * so a `stale_version` leaves the screen on what is stored.
 */
export function useLeaveTransition() {
  const { data, time } = usePorts()
  const actor = useActor()
  const client = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({
      leave,
      transition,
      note,
      acknowledged,
    }: {
      leave: Leave
      transition: LeaveTransition
      note: string
      acknowledged: readonly AvailabilityRuleId[]
    }): Promise<Result<Leave>> => data.commands.leaves.transition(toTransitionInput(leave, transition, note, acknowledged)),
    onMutate: async ({ leave, transition }) => {
      await client.cancelQueries({ queryKey: QUERY_KEYS.leaves })
      const previous = cachedLeaves(client)
      const next = actor === null ? null : leaveAfterStep(leave, transition, actor.soldier_id, time.now())
      if (next !== null) showLeave(client, next)
      return { previous }
    },
    onSettled: async (result, _error, _input, context) => {
      if (result?.ok !== true && context !== undefined) restoreLeaves(client, context.previous)
      await Promise.all(AFTER_A_LEAVE_COMMAND.map((queryKey) => client.invalidateQueries({ queryKey })))
    },
  })
  return {
    /** `acknowledged` are the soft rules the actor agreed to break, sent again after the dialog (D-047, D-142). */
    run: (leave: Leave, transition: LeaveTransition, note = '', acknowledged: readonly AvailabilityRuleId[] = []) =>
      mutation.mutateAsync({ leave, transition, note, acknowledged }),
    isPending: mutation.isPending,
  }
}

/**
 * The edit form's one command (D-123): the dates and the details in one `leaves.update`, so the edit is saved whole
 * or not at all. Nothing changed answers the leave as it is.
 */
export function useEditLeave() {
  const { data } = usePorts()
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: async ({
      leave,
      values,
      acknowledged,
    }: {
      leave: Leave
      values: LeaveEditValues & WithProperties
      acknowledged: readonly AvailabilityRuleId[]
    }): Promise<Result<Leave>> => {
      const input = toUpdateLeaveInput(leave, values, acknowledged)
      const unchanged: Result<Leave> = { ok: true, value: leave }
      return input === null ? unchanged : data.commands.leaves.update(input)
    },
    onSettled: () => Promise.all(AFTER_A_LEAVE_COMMAND.map((queryKey) => client.invalidateQueries({ queryKey }))),
  })
  return {
    /** `acknowledged` are the soft rules the actor agreed to break, sent again after the dialog (D-047, D-142). */
    run: (leave: Leave, values: LeaveEditValues & WithProperties, acknowledged: readonly AvailabilityRuleId[] = []) =>
      mutation.mutateAsync({ leave, values, acknowledged }),
    isPending: mutation.isPending,
  }
}

/** Writing in a leave's thread (D-118). Only the author's own comments take `edit` and `archive`. */
export function useLeaveCommentCommands(leaveId: LeaveId) {
  const { data } = usePorts()
  const comments = data.commands.leave_comments
  const keys = [QUERY_KEYS.leaveComments]
  const add = useCommand(keys, ({ body, visibility }: { body: string; visibility: CommentVisibility }) =>
    comments.add({ id: LeaveCommentId.parse(crypto.randomUUID()), leave_id: leaveId, body, visibility }),
  )
  const edit = useCommand(keys, ({ comment, body }: { comment: LeaveComment; body: string }) => comments.edit({ id: comment.id, body }))
  const archive = useCommand(keys, (comment: LeaveComment) => comments.archive({ id: comment.id }))
  return { add, edit, archive }
}

/** Whether a comment is the actor's own, so its menu shows (D-118). */
export function useIsOwnComment(): (comment: LeaveComment) => boolean {
  const actor = useActor()
  return useMemo(() => (comment: LeaveComment) => actor !== null && comment.author_id === actor.soldier_id, [actor])
}

// ---------------------------------------------------------------------- inbox

/** The pending leaves the actor may approve, whatever their dates, the earliest first (D-120). */
export function usePendingRequests(): Loaded<readonly Leave[]> {
  const { data } = usePorts()
  const pending: Loaded<readonly Leave[]> = loaded(
    useQuery({
      queryKey: leaveListKey(PENDING_QUERY),
      queryFn: () => unwrap(data.repositories.leaves.list(PENDING_QUERY)),
    }),
  )
  const leaves = pending.status === 'ready' ? pending.value : NO_LEAVES
  const checks = useMemo(
    () => [...new Set(leaves.map((leave) => leave.soldier_id))].map((soldierId) => checkOn(LEAVE_PERMISSIONS.approve, soldierId)),
    [leaves],
  )
  const can = useCan(checks)
  return useMemo((): Loaded<readonly Leave[]> => {
    if (pending.status !== 'ready') return pending
    return { status: 'ready', value: pendingRequests(pending.value, (soldierId) => can(checkOn(LEAVE_PERMISSIONS.approve, soldierId))) }
  }, [pending, can])
}

/** The rejected and cancelled leaves the actor sees near today, the last changed first (D-120, D-205). */
export function useClosedLeaves(): Loaded<readonly Leave[]> {
  const { data } = usePorts()
  const today = useToday()
  const query = today === null ? null : closedQuery(today)
  const closed: Loaded<readonly Leave[]> = loaded(
    useQuery({
      queryKey: query === null ? [...QUERY_KEYS.leaves, { statuses: null }] : leaveListKey(query),
      queryFn: (): Promise<readonly Leave[]> =>
        query === null ? Promise.resolve(NO_LEAVES) : unwrap(data.repositories.leaves.list(query)),
      enabled: query !== null,
    }),
  )
  return useMemo((): Loaded<readonly Leave[]> => {
    if (today === null) return { status: 'loading' }
    if (closed.status !== 'ready') return closed
    return { status: 'ready', value: closedLeaves(closed.value) }
  }, [closed, today])
}

const NO_LEAVES: readonly never[] = []

// ---------------------------------------------------------------- my requests

/** What "my requests" offers the actor on their own soldier (D-167): NULL when the actor is not linked. */
export function useMyLeavesAccess(): { readonly view: boolean; readonly create: boolean } | null {
  const actor = useActor()
  const checks = useMemo(
    () =>
      actor === null
        ? []
        : [checkOn(LEAVE_PERMISSIONS.view, actor.soldier_id), checkOn(LEAVE_PERMISSIONS.create, actor.soldier_id)],
    [actor],
  )
  const can = useCan(checks)
  const [view, create] = checks
  if (view === undefined || create === undefined) return null
  return { view: can(view), create: can(create) }
}

/** The actor's own leaves, open and history (D-167). Today is the organization's day. */
export function useMyLeaves(): Loaded<MyLeaves> {
  const { data } = usePorts()
  const actor = useActor()
  const today = useToday()
  const query = actor === null ? null : myLeavesQuery(actor.soldier_id)
  const leaves: Loaded<readonly Leave[]> = loaded(
    useQuery({
      queryKey: query === null ? [...QUERY_KEYS.leaves, { soldier_ids: null }] : leaveListKey(query),
      queryFn: (): Promise<readonly Leave[]> =>
        query === null ? Promise.resolve(NO_LEAVES) : unwrap(data.repositories.leaves.list(query)),
      enabled: query !== null,
    }),
  )
  return useMemo((): Loaded<MyLeaves> => {
    if (leaves.status !== 'ready') return leaves
    if (today === null) return { status: 'loading' }
    return { status: 'ready', value: myLeaveGroups(leaves.value, today) }
  }, [leaves, today])
}
