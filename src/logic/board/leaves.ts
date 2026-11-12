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

// The leaves of each soldier in view, as the engines draw them (D-111, D-174). Pure; the hook feeds it.

/**
 * The board's two layers (D-268): a round is a leave in a batch (a collective leave, or the planner's), drawn as a
 * background under the requests; any other leave is a request. Derived from `batch_id`, never stored (D-019).
 */
export type LeaveLayer = 'round' | 'request'

export function layerOf(leave: Pick<Leave, 'batch_id'>): LeaveLayer {
  return leave.batch_id === null ? 'request' : 'round'
}

/** A leave as a row draws it. */
export interface BoardLeave {
  readonly id: LeaveId
  readonly status: LeaveStatus
  readonly start_date: CalendarDate
  readonly end_date: CalendarDate
  /** `unavailable` is a bar; `available` is a marker's badge (D-032). */
  readonly effect: AvailabilityEffect
  /** NULL when the actor may not read the type. */
  readonly type: LeaveType | null
  readonly layer: LeaveLayer
}

/**
 * Each soldier's leaves, by first day. `types` holds archived types too, so a leave keeps its type (D-113); a
 * leave whose type is missing takes the default effect (D-070).
 */
export function boardLeaves(
  leaves: readonly Leave[],
  types: readonly LeaveType[],
): ReadonlyMap<SoldierId, readonly BoardLeave[]> {
  const typeById = new Map<LeaveTypeId, LeaveType>(types.map((type) => [type.id, type]))
  const bySoldier = new Map<SoldierId, BoardLeave[]>()
  const ordered = leaves.toSorted((a, b) => a.start_date.localeCompare(b.start_date) || a.id.localeCompare(b.id))
  for (const leave of ordered) {
    const type = typeById.get(leave.leave_type_id) ?? null
    const drawn: BoardLeave = {
      id: leave.id,
      status: leave.status,
      start_date: leave.start_date,
      end_date: leave.end_date,
      effect: effectiveEffect(leave, type ?? undefined),
      type,
      layer: layerOf(leave),
    }
    const own = bySoldier.get(leave.soldier_id)
    if (own === undefined) bySoldier.set(leave.soldier_id, [drawn])
    else own.push(drawn)
  }
  return bySoldier
}
