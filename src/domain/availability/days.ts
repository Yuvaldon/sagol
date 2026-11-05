import {
  AvailabilityEffect,
  LeaveStatus,
  type CalendarDate,
  type Leave,
  type LeaveId,
  type LeaveType,
  type LeaveTypeId,
  type SoldierId,
} from '@contracts'
import { compareDates } from '../time'

// Availability of one soldier on one day (D-012, D-032, D-070): exactly one status, plus
// the leaves covering the day as annotations. Derived, never stored (D-019).

/** The columns availability reads. Full `Leave` rows fit. */
export type AvailabilityLeave = Pick<
  Leave,
  'id' | 'soldier_id' | 'leave_type_id' | 'start_date' | 'end_date' | 'status' | 'availability_effect_override'
>

/** The columns availability reads from a leave type. Full `LeaveType` rows fit. */
export type AvailabilityLeaveType = Pick<LeaveType, 'id' | 'availability_effect'>

export interface AvailabilityData {
  readonly leaves: Iterable<AvailabilityLeave>
  readonly leave_types: Iterable<AvailabilityLeaveType>
}

export interface AvailabilityOptions {
  /** Pending leaves count like approved ones (planning ahead, D-014). */
  readonly count_pending_as_unavailable: boolean
}

/** Approved leaves only. */
export const APPROVED_ONLY: AvailabilityOptions = { count_pending_as_unavailable: false }

/** A leave covering the day. Rejected and cancelled leaves are never listed. */
export interface CoveringLeave {
  readonly leave_id: LeaveId
  readonly status: LeaveStatus
  readonly effect: AvailabilityEffect
  /** This leave makes the soldier unavailable on the day. */
  readonly counted: boolean
}

/** One soldier on one day: one status, and the leaves covering the day. */
export interface SoldierDay {
  readonly soldier_id: SoldierId
  readonly date: CalendarDate
  readonly status: AvailabilityEffect
  readonly leaves: readonly CoveringLeave[]
}

/** The effective effect: the leave's override, else its type's effect (D-032). */
export function effectiveEffect(
  leave: Pick<AvailabilityLeave, 'availability_effect_override'>,
  type: AvailabilityLeaveType | undefined,
): AvailabilityEffect {
  // A missing type falls back to the default effect of a new type (D-032, D-070).
  return leave.availability_effect_override ?? type?.availability_effect ?? AvailabilityEffect.enum.unavailable
}

/** True when the inclusive leave dates contain `date`. */
export function leaveCovers(leave: Pick<AvailabilityLeave, 'start_date' | 'end_date'>, date: CalendarDate): boolean {
  return compareDates(leave.start_date, date) <= 0 && compareDates(date, leave.end_date) <= 0
}

/** Statuses whose leaves are listed on the days they cover. */
const LISTED_STATUSES: ReadonlySet<LeaveStatus> = new Set([LeaveStatus.enum.pending, LeaveStatus.enum.approved])

/** True when a leave of this status takes part in availability under `options`. */
export function statusCounts(status: LeaveStatus, options: AvailabilityOptions): boolean {
  if (status === LeaveStatus.enum.approved) return true
  return status === LeaveStatus.enum.pending && options.count_pending_as_unavailable
}

/** The indexed snapshot. Build once with `createAvailabilityContext`, query many times. */
export interface AvailabilityContext {
  on(soldierId: SoldierId, date: CalendarDate, options: AvailabilityOptions): SoldierDay
  isAvailable(soldierId: SoldierId, date: CalendarDate, options: AvailabilityOptions): boolean
}

export function createAvailabilityContext(data: AvailabilityData): AvailabilityContext {
  const types = new Map<LeaveTypeId, AvailabilityLeaveType>()
  for (const type of data.leave_types) types.set(type.id, type)
  const leavesBySoldier = new Map<SoldierId, AvailabilityLeave[]>()
  for (const leave of data.leaves) {
    if (!LISTED_STATUSES.has(leave.status)) continue
    const own = leavesBySoldier.get(leave.soldier_id)
    if (own === undefined) leavesBySoldier.set(leave.soldier_id, [leave])
    else own.push(leave)
  }

  function on(soldierId: SoldierId, date: CalendarDate, options: AvailabilityOptions): SoldierDay {
    const leaves: CoveringLeave[] = []
    for (const leave of leavesBySoldier.get(soldierId) ?? []) {
      if (!leaveCovers(leave, date)) continue
      const effect = effectiveEffect(leave, types.get(leave.leave_type_id))
      const counted = effect === AvailabilityEffect.enum.unavailable && statusCounts(leave.status, options)
      leaves.push({ leave_id: leave.id, status: leave.status, effect, counted })
    }
    // Union of the leaves (D-012): one counted leave is enough, overlaps never double count.
    const status = leaves.some((leave) => leave.counted)
      ? AvailabilityEffect.enum.unavailable
      : AvailabilityEffect.enum.available
    return { soldier_id: soldierId, date, status, leaves }
  }

  return {
    on,
    isAvailable: (soldierId, date, options) => on(soldierId, date, options).status === AvailabilityEffect.enum.available,
  }
}

/** Present and absent lists of one day. Every soldier appears in exactly one list, once. */
export interface AvailabilityPartition {
  readonly date: CalendarDate
  readonly available: readonly SoldierDay[]
  readonly unavailable: readonly SoldierDay[]
}

/** Splits the soldiers of one day into present and absent lists (D-032). Repeated ids count once. */
export function partitionAvailability(
  context: AvailabilityContext,
  soldierIds: Iterable<SoldierId>,
  date: CalendarDate,
  options: AvailabilityOptions,
): AvailabilityPartition {
  const available: SoldierDay[] = []
  const unavailable: SoldierDay[] = []
  for (const soldierId of new Set(soldierIds)) {
    const day = context.on(soldierId, date, options)
    if (day.status === AvailabilityEffect.enum.available) available.push(day)
    else unavailable.push(day)
  }
  return { date, available, unavailable }
}
