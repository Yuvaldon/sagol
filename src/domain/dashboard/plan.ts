import {
  AvailabilityEffect,
  CalendarDate,
  LeaveStatus,
  LeaveTypeId,
  type Leave,
  type LeaveEvent,
  type LeaveId,
  type Timestamp,
} from '@contracts'
import { compareInstants } from '../time'

// The plan of a span (D-349, D-361): the leaves as they stood at an instant, replayed from `leave_events`.

/** The columns a replay reads and rolls back. Full `Leave` rows fit. */
export type PlanLeave = Pick<
  Leave,
  'id' | 'soldier_id' | 'leave_type_id' | 'start_date' | 'end_date' | 'status' | 'availability_effect_override'
>

/** The columns an event carries for a replay. Full `LeaveEvent` rows fit. */
export type PlanEvent = Pick<LeaveEvent, 'leave_id' | 'event_type' | 'to_status' | 'changes' | 'created_at'>

/** The columns a replay restores from an event's `changes.before`, each with its own schema. */
const RESTORED = {
  start_date: CalendarDate,
  end_date: CalendarDate,
  leave_type_id: LeaveTypeId,
  availability_effect_override: AvailabilityEffect.nullable(),
} as const
const RESTORED_COLUMNS: readonly (keyof typeof RESTORED)[] = ['start_date', 'end_date', 'leave_type_id', 'availability_effect_override']

function byTime(a: PlanEvent, b: PlanEvent): number {
  return compareInstants(a.created_at, b.created_at)
}

/** Whether the leave's history starts with its creation; one without (an import, or older rows) cannot be replayed. */
export function hasHistory(events: readonly PlanEvent[]): boolean {
  return events.some((event) => event.event_type === 'created')
}

/**
 * The leave as it stood at `instant` (D-361): null when it did not exist yet. The status is the last one an event up
 * to the instant set; the dates, the type and the effect override are rolled back through each later event's
 * `changes.before`, newest first. A leave with no `created` event is taken as it is now.
 */
export function leaveAsOf<L extends PlanLeave>(leave: L, events: readonly PlanEvent[], instant: Timestamp): L | null {
  if (!hasHistory(events)) return leave
  const ordered = events.filter((event) => event.leave_id === leave.id).sort(byTime)
  const before = ordered.filter((event) => compareInstants(event.created_at, instant) <= 0)
  if (before.length === 0) return null
  let status: LeaveStatus = leave.status
  for (const event of before) if (event.to_status !== null) status = event.to_status
  const restored: L = { ...leave, status }
  const later = ordered.slice(before.length).reverse()
  for (const event of later) {
    for (const column of RESTORED_COLUMNS) {
      const change = event.changes[column]
      if (change === undefined) continue
      const parsed = RESTORED[column].safeParse(change.before)
      if (parsed.success) Object.assign(restored, { [column]: parsed.data })
    }
  }
  return restored
}

/** A span's plan against what happened since (D-349). */
export interface SpanPlan<L extends PlanLeave> {
  /** The leaves as they stood at the plan's instant. */
  readonly planned: readonly L[]
  /** Leaves approved now that were not approved at the plan. */
  readonly added: number
  /** Leaves approved at the plan that are not approved now. */
  readonly cancelled: number
  /** Leaves approved at both whose dates moved. */
  readonly moved: number
  /** Leaves with no history to replay, taken as they are now. */
  readonly unrecorded: number
}

const isApproved = (leave: PlanLeave | null) => leave?.status === LeaveStatus.enum.approved

/** The plan of `leaves` at `instant`, from their events grouped by leave. */
export function planOf<L extends PlanLeave>(
  leaves: readonly L[],
  eventsByLeave: ReadonlyMap<LeaveId, readonly PlanEvent[]>,
  instant: Timestamp,
): SpanPlan<L> {
  const planned: L[] = []
  let added = 0
  let cancelled = 0
  let moved = 0
  let unrecorded = 0
  for (const leave of leaves) {
    const events = eventsByLeave.get(leave.id) ?? []
    if (!hasHistory(events)) unrecorded += 1
    const then = leaveAsOf(leave, events, instant)
    if (then !== null) planned.push(then)
    const was = isApproved(then)
    const is = isApproved(leave)
    if (is && !was) added += 1
    else if (was && !is) cancelled += 1
    else if (was && is && (then?.start_date !== leave.start_date || then.end_date !== leave.end_date)) moved += 1
  }
  return { planned, added, cancelled, moved, unrecorded }
}
