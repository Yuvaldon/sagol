import type { CalendarDate, Leave, Soldier, SoldierId } from '@contracts'
import { LEAVE_PERMISSIONS, addDays, daysBetween, type AvailabilityLeave } from '@domain'
import { useMemo } from 'react'
import { useLeaveCreation, useLeaves } from '../leaves/hooks'
import {
  EDIT_PERMISSION,
  editReturnsToPending,
  editedLeaveCandidate,
  isEditable,
  leaveEditValues,
  type LeaveEditValues,
} from '../leaves/workflow'
import { checkOn } from '../permissions/checks'
import { useCan } from '../permissions/hooks'
import { usePorts } from '../runtime/context'
import { useCurrentOrganization, useSession } from '../session/hooks'
import type { NewLeaveDraft } from '../view-state/draft'
import type { DateWindow } from '../view-state/window'

// What a drag on the timeline may do and what it sends (D-143). The engine's core counts days as offsets in the
// window; this file turns them into dates and into the edit the drawer's form would send, so a drop and the form
// never differ (D-123).

/** The first and last day of a leave as offsets from the window's first day. Either may fall outside the window. */
export interface DayRange {
  readonly start: number
  readonly end: number
}

export interface LeaveDates {
  readonly start_date: CalendarDate
  readonly end_date: CalendarDate
}

export function dayRangeOf(first: CalendarDate, dates: LeaveDates): DayRange {
  return { start: daysBetween(first, dates.start_date), end: daysBetween(first, dates.end_date) }
}

export function datesOfRange(first: CalendarDate, range: DayRange): LeaveDates {
  return { start_date: addDays(first, range.start), end_date: addDays(first, range.end) }
}

export function sameDates(a: LeaveDates, b: LeaveDates): boolean {
  return a.start_date === b.start_date && a.end_date === b.end_date
}

/** The edit form's values with new days and nothing else changed, so `leaves.update` carries the dates only (D-123). */
export function movedLeaveValues(leave: Leave, dates: LeaveDates): LeaveEditValues {
  return { ...leaveEditValues(leave), start_date: dates.start_date, end_date: dates.end_date }
}

/** What a drag marked for a new leave (D-143). */
export function newLeaveDraft(soldierId: SoldierId, dates: LeaveDates): NewLeaveDraft {
  return { soldier_id: soldierId, start_date: dates.start_date, end_date: dates.end_date }
}

/** The drop of a moved leave: what it sends, and what the card says before it is sent (D-143). */
export interface LeaveMove {
  readonly values: LeaveEditValues
  /** The leave as the command would leave it, as rules see it (D-142). */
  readonly candidate: (AvailabilityLeave & Pick<Leave, 'deployment_id'>) | null
  /** An approved leave that the move returns to pending (D-064). */
  readonly returnsToPending: boolean
}

export interface TimelineEditing {
  /** The stored leave behind a mark, from the window's leaves. NULL when it is not there. */
  leaveOf(leaveId: string): Leave | null
  /** Whether the actor may drag the leave: an editable leave of a soldier who is not archived, and `leaves:update`. */
  canMove(leave: Leave): boolean
  /** Whether a drag on the soldier's row may mark a new leave (D-114, D-125). */
  canCreate(soldierId: SoldierId): boolean
  move(leave: Leave, dates: LeaveDates): LeaveMove
}

function useActor() {
  const session = useSession()
  return session.status === 'ready' && session.value.status === 'linked' ? session.value : null
}

const SERVING = { archived_at: null }

/**
 * The hints of a drag on the board (D-143): who may move which leave, on whose row a new leave may be marked, and the
 * edit a move would send. `soldiers` are the board's rows. Hints only: the command decides again.
 */
export function useTimelineEditing(window: DateWindow, soldiers: readonly Soldier[]): TimelineEditing {
  const { time } = usePorts()
  const actor = useActor()
  const organization = useCurrentOrganization()
  const leaves = useLeaves(window)
  const creation = useLeaveCreation(soldiers)
  const stored = leaves.status === 'ready' ? leaves.value : NO_LEAVES
  const checks = useMemo(
    () =>
      [...new Set(stored.map((leave) => leave.soldier_id))].flatMap((soldierId) => [
        checkOn(EDIT_PERMISSION, soldierId),
        checkOn(LEAVE_PERMISSIONS.approve, soldierId),
      ]),
    [stored],
  )
  const can = useCan(checks)
  return useMemo((): TimelineEditing => {
    const byId = new Map<string, Leave>(stored.map((leave) => [leave.id, leave]))
    const archived = new Map(soldiers.map((soldier) => [soldier.id, { archived_at: soldier.archived_at }]))
    const creatable = new Set(creation.soldiers.map((soldier) => soldier.id))
    const policy = organization.status === 'ready' && organization.value !== null ? organization.value.settings.reschedule_policy : null
    return {
      leaveOf: (leaveId) => byId.get(leaveId) ?? null,
      canMove: (leave) => isEditable(leave, archived.get(leave.soldier_id) ?? SERVING) && can(checkOn(EDIT_PERMISSION, leave.soldier_id)),
      canCreate: (soldierId) => creatable.has(soldierId),
      move: (leave, dates) => {
        const values = movedLeaveValues(leave, dates)
        const mayApprove = can(checkOn(LEAVE_PERMISSIONS.approve, leave.soldier_id))
        const returnsToPending =
          actor !== null && policy !== null && editReturnsToPending(leave, values, policy, mayApprove, actor.soldier_id, time.now())
        return { values, returnsToPending, candidate: editedLeaveCandidate(leave, values, returnsToPending) }
      },
    }
  }, [stored, soldiers, creation.soldiers, organization, can, actor, time])
}

const NO_LEAVES: readonly Leave[] = []
