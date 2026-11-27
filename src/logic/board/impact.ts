import { AvailabilityEffect, LeaveId, LeaveStatus, type CalendarDate, type Leave, type LeaveType, type RuleViolation, type SoldierId } from '@contracts'
import { compareDates } from '@domain'
import { useMemo } from 'react'
import type { LeaveCandidate } from '../leaves/forms'
import { useLeaveTypes } from '../leaves/hooks'
import type { Loaded } from '../queries/loaded'
import { useLeaveRuleCheck } from '../rules/hooks'
import type { LeaveDates } from '../timeline/editing'
import { rotationOn, useDateWindow } from '../view-state/window'
import type { BoardLeave } from './leaves'
import type { BoardDay } from './views'

// The impact line (the handoff's board spec, §1.9; D-480): at the moment of a decision, a selection's tray or a request
// revealed by a swipe, the first day the step would take below what a rule asks, with the fraction it would leave.
// It appears only then, and only where the rules answer (D-162, D-463): a pending request does not count until it is
// approved, so approving one is what can break a rule.

export interface Impact {
  readonly day: CalendarDate
  /** Who would be on base that day after the step. */
  readonly present: number
  readonly total: number
}

/**
 * The first day a step breaks, of the board's days, with the soldier it takes away: NULL when it breaks none, or none of
 * the days the board holds. `approved` is each soldier's approved leaves, so one already away is not counted twice.
 */
export function impactOf(
  violations: readonly RuleViolation[],
  days: readonly BoardDay[],
  approved: ReadonlyMap<SoldierId, readonly BoardLeave[]>,
  soldierId: SoldierId,
): Impact | null {
  const broken = [...new Set(violations.flatMap((violation) => violation.days.map((day) => day.date)))].sort(compareDates)
  for (const date of broken) {
    const day = days.find((candidate) => candidate.day === date)
    if (day === undefined) continue
    const away = (approved.get(soldierId) ?? []).some(
      (leave) => leave.effect === AvailabilityEffect.enum.unavailable && leave.start_date <= date && leave.end_date >= date,
    )
    return { day: date, present: Math.max(0, day.total - day.away - (away ? 0 : 1)), total: day.total }
  }
  return null
}

/** A leave away on the days, as the rules would judge it: of the rotation that holds its first day (D-222). */
export function absenceCandidate(
  soldierId: SoldierId,
  dates: LeaveDates,
  deploymentId: Leave['deployment_id'],
  type: Pick<LeaveType, 'id'>,
): LeaveCandidate {
  return {
    id: LeaveId.parse(crypto.randomUUID()),
    soldier_id: soldierId,
    leave_type_id: type.id,
    start_date: dates.start_date,
    end_date: dates.end_date,
    status: LeaveStatus.enum.approved,
    availability_effect_override: AvailabilityEffect.enum.unavailable,
    deployment_id: deploymentId,
  }
}

/**
 * What a new leave away on the days would break (D-142): loading or failed until the rules answer, and empty where
 * they do not answer for this actor, or no rotation holds the days.
 */
export function useAbsenceCheck(soldierId: SoldierId | null, dates: LeaveDates | null): Loaded<readonly RuleViolation[]> {
  const { rotations } = useDateWindow()
  const types = useLeaveTypes()
  const candidate = useMemo(() => {
    if (soldierId === null || dates === null || types.status !== 'ready') return null
    const rotation = rotationOn(rotations, dates.start_date)
    const type = types.value.find((candidate) => candidate.archived_at === null)
    return rotation === null || type === undefined ? null : absenceCandidate(soldierId, dates, rotation.id, type)
  }, [soldierId, dates, types, rotations])
  return useLeaveRuleCheck(candidate)
}

/** What approving a request would break: the request as approved (a pending request is not counted until then). */
export function useApprovalCheck(leave: Leave | null): Loaded<readonly RuleViolation[]> {
  const candidate = useMemo(() => (leave === null || leave.status !== LeaveStatus.enum.pending ? null : { ...leave, status: LeaveStatus.enum.approved }), [leave])
  return useLeaveRuleCheck(candidate, leave)
}
