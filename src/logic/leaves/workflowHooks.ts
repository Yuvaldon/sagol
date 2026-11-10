import {
  LeaveCommentId,
  LeaveId,
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
import { usePorts } from '../runtime/context'
import { useCurrentOrganization, useSession } from '../session/hooks'
import { cachedLeaves, leaveKey, leaveListKey, restoreLeaves, showLeave } from './cache'
import {
  CLOSED_QUERY,
  EDIT_PERMISSION,
  PENDING_QUERY,
  closedLeaves,
  editReturnsToPending,
  leaveAfterStep,
  leaveEditChanges,
  leaveSteps,
  leaveThread,
  pendingRequests,
  toTransitionInput,
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
  const steps = useMemo(
    () => (actor === null ? new Map<LeaveTransition, PermissionCheck['permission']>() : leaveSteps(leave, actor.soldier_id, time.now())),
    [leave, actor, time],
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
      /** Only pending and approved leaves are edited (D-064). */
      edit: (leave.status === 'pending' || leave.status === 'approved') && can(checkOn(EDIT_PERMISSION, leave.soldier_id)),
      comment: {
        shared: can(checkOn(COMMENT_PERMISSIONS.shared.create, leave.soldier_id)),
        internal: can(checkOn(COMMENT_PERMISSIONS.internal.create, leave.soldier_id)),
      },
      /** Whether sending these values returns the leave to pending. False while the policy is not known. */
      returnsToPending: (values: LeaveEditValues) =>
        actor !== null && policy !== null && editReturnsToPending(leave, values, policy, mayApprove, actor.soldier_id, time.now()),
    }
  }, [steps, can, leave, organization, actor, time])
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
    mutationFn: ({ leave, transition, note }: { leave: Leave; transition: LeaveTransition; note: string }): Promise<Result<Leave>> =>
      data.commands.leaves.transition(toTransitionInput(leave, transition, note)),
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
    run: (leave: Leave, transition: LeaveTransition, note = '') => mutation.mutateAsync({ leave, transition, note }),
    isPending: mutation.isPending,
  }
}

/**
 * The edit form's two commands (D-119): changed dates go to `reschedule` and changed details to `update`, the
 * dates first, the second at the version the first answered. Nothing changed answers the leave as it is. A
 * refusal of the second leaves the first stored, and the reads that follow show it.
 */
export function useEditLeave() {
  const { data } = usePorts()
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: async ({ leave, values }: { leave: Leave; values: LeaveEditValues }): Promise<Result<Leave>> => {
      const { dates, details } = leaveEditChanges(leave, values)
      let current: Result<Leave> = { ok: true, value: leave }
      if (dates !== null) {
        current = await data.commands.leaves.reschedule({
          id: leave.id,
          expected_version: leave.version,
          ...dates,
          acknowledged_rule_ids: [],
        })
      }
      if (!current.ok || details === null) return current
      return data.commands.leaves.update({
        id: leave.id,
        expected_version: current.value.version,
        changes: details,
        acknowledged_rule_ids: [],
      })
    },
    onSettled: () => Promise.all(AFTER_A_LEAVE_COMMAND.map((queryKey) => client.invalidateQueries({ queryKey }))),
  })
  return { run: (leave: Leave, values: LeaveEditValues) => mutation.mutateAsync({ leave, values }), isPending: mutation.isPending }
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

/** The rejected and cancelled leaves the actor sees, the last changed first (D-120). */
export function useClosedLeaves(): Loaded<readonly Leave[]> {
  const { data } = usePorts()
  const closed: Loaded<readonly Leave[]> = loaded(
    useQuery({
      queryKey: leaveListKey(CLOSED_QUERY),
      queryFn: () => unwrap(data.repositories.leaves.list(CLOSED_QUERY)),
    }),
  )
  return useMemo((): Loaded<readonly Leave[]> => {
    if (closed.status !== 'ready') return closed
    return { status: 'ready', value: closedLeaves(closed.value) }
  }, [closed])
}

const NO_LEAVES: readonly never[] = []
