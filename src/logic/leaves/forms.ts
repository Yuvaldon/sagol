import { CreateLeaveInput, type Leave, type OrganizationId, type SoldierId, type Timestamp } from '@contracts'
import { optionalText, planLeaveCreation, type AvailabilityLeave } from '@domain'

// A new leave before the command answers: as rules see it (D-142), and as the board shows it (optimistic update).

/** A leave as rules see it, before the command writes it (D-142), with the rotation whose tags count for it (D-260, D-222). */
export type LeaveCandidate = AvailabilityLeave & Pick<Leave, 'deployment_id'>

/**
 * The leave as the command will write it, shown before it answers (optimistic update). Its status and review
 * come from the same plan the command follows, so the bar does not change when the answer lands.
 */
export function optimisticLeave(
  input: CreateLeaveInput,
  actor: { readonly soldier_id: SoldierId; readonly organization_id: OrganizationId },
  now: Timestamp,
): Leave {
  const plan = planLeaveCreation('create', input.as_approved, actor.soldier_id, now)
  return {
    id: input.id,
    organization_id: actor.organization_id,
    deployment_id: input.deployment_id,
    soldier_id: input.soldier_id,
    leave_type_id: input.leave_type_id,
    batch_id: null,
    start_date: input.start_date,
    end_date: input.end_date,
    ...plan.next,
    availability_effect_override: input.availability_effect_override,
    reason: optionalText(input.reason),
    properties: input.properties,
    created_at: now,
    created_by: actor.soldier_id,
    updated_at: now,
    updated_by: actor.soldier_id,
    version: 1,
  }
}
