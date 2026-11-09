import type {
  AvailabilityEffect,
  CalendarDate,
  Leave,
  LeaveId,
  LeaveStatus,
  LeaveType,
  LeaveTypeId,
  SoldierId,
} from '@contracts'
import { effectiveEffect } from '@domain'

// The leaves a timeline row draws (D-111). Pure; the hook feeds it.

/** A leave as a row draws it. */
export interface TimelineLeave {
  readonly id: LeaveId
  readonly status: LeaveStatus
  readonly start_date: CalendarDate
  readonly end_date: CalendarDate
  /** `unavailable` is a bar; `available` is a marker's badge (D-032). */
  readonly effect: AvailabilityEffect
  /** NULL when the actor may not read the type. */
  readonly type: LeaveType | null
}

/**
 * Each soldier's leaves, by first day. `types` holds archived types too, so a leave keeps its type (D-113); a
 * leave whose type is missing takes the default effect (D-070).
 */
export function timelineLeaves(
  leaves: readonly Leave[],
  types: readonly LeaveType[],
): ReadonlyMap<SoldierId, readonly TimelineLeave[]> {
  const typeById = new Map<LeaveTypeId, LeaveType>(types.map((type) => [type.id, type]))
  const bySoldier = new Map<SoldierId, TimelineLeave[]>()
  const ordered = leaves.toSorted((a, b) => a.start_date.localeCompare(b.start_date) || a.id.localeCompare(b.id))
  for (const leave of ordered) {
    const type = typeById.get(leave.leave_type_id) ?? null
    const drawn: TimelineLeave = {
      id: leave.id,
      status: leave.status,
      start_date: leave.start_date,
      end_date: leave.end_date,
      effect: effectiveEffect(leave, type ?? undefined),
      type,
    }
    const own = bySoldier.get(leave.soldier_id)
    if (own === undefined) bySoldier.set(leave.soldier_id, [drawn])
    else own.push(drawn)
  }
  return bySoldier
}
