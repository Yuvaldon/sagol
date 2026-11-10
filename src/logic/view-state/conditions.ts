import { LeaveStatus, LeaveTypeId, type Leave } from '@contracts'
import { z } from 'zod'

// The board's leave conditions (D-132), apart from the hooks, so the search schema can read them.

/** The statuses the board draws, and so the ones a leave condition can choose (D-111, D-132). */
export const BoardLeaveStatus = LeaveStatus.extract(['pending', 'approved'])
export type BoardLeaveStatus = z.infer<typeof BoardLeaveStatus>

/** The search param `leaves`. An empty list is never written: a chip that is not there is absent. */
export const LeaveConditions = z.object({
  statuses: z.array(BoardLeaveStatus).min(1).optional(),
  type_ids: z.array(LeaveTypeId).min(1).optional(),
})
export type LeaveConditions = z.infer<typeof LeaveConditions>

export const NO_LEAVE_CONDITIONS: LeaveConditions = {}

export function hasLeaveConditions(conditions: LeaveConditions): boolean {
  return conditions.statuses !== undefined || conditions.type_ids !== undefined
}

/** True when the leave meets every condition (D-132). */
export function leaveMatches(conditions: LeaveConditions, leave: Pick<Leave, 'status' | 'leave_type_id'>): boolean {
  const { statuses, type_ids: typeIds } = conditions
  if (statuses !== undefined && !statuses.some((status) => status === leave.status)) return false
  return typeIds === undefined || typeIds.includes(leave.leave_type_id)
}
