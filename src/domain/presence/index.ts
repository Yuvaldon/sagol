import {
  AvailabilityEffect,
  SoldierStatus,
  type CalendarDate,
  type Permission,
  type PresenceWithMe,
  type Soldier,
  type SoldierId,
} from '@contracts'
import { APPROVED_ONLY, createAvailabilityContext, type AvailabilityLeave, type AvailabilityLeaveType } from '../availability'
import { buildUnitTree, descendantsOf, primaryUnitOn, type MembershipSpan, type UnitNode } from '../hierarchy'
import { compareCodeUnits } from '../json'

// "איתך היום" (D-478): who of a soldier's own unit is on base on a day, by name. Pure: the data layer reads the rows
// and answers only what this returns, so a holder of `presence:view` learns no leave, no type and no other day.

/** Checked on the holder themself: the read is about who is with them. */
export const PRESENCE_VIEW: Permission = { resource: 'presence', action: 'view' }

/** The columns the answer reads of a soldier. Full `Soldier` rows fit. */
export type PresenceSoldier = Pick<Soldier, 'id' | 'first_name' | 'last_name' | 'status' | 'archived_at'>

export interface PresenceWithMeInput {
  readonly holderId: SoldierId
  readonly date: CalendarDate
  readonly units: Iterable<UnitNode>
  readonly soldiers: Iterable<PresenceSoldier>
  readonly memberships: Iterable<MembershipSpan>
  readonly leaves: Iterable<AvailabilityLeave>
  readonly leave_types: Iterable<AvailabilityLeaveType>
}

/**
 * The active soldiers whose primary unit on the day is the holder's own or a unit under it, beside the holder, who
 * are not away by an approved leave (a request that waits counts for nothing, D-134). NULL when the holder has no unit
 * on the day. Never the units above the holder's. In id order; the screen orders people by name (D-094).
 */
export function presenceWithMe(input: PresenceWithMeInput): PresenceWithMe | null {
  const memberships = [...input.memberships]
  const unitId = primaryUnitOn(memberships, input.holderId, input.date)
  if (unitId === null) return null
  const reach = new Set([unitId, ...descendantsOf(buildUnitTree(input.units), unitId)])
  const availability = createAvailabilityContext({ leaves: input.leaves, leave_types: input.leave_types })
  const soldiers = [...input.soldiers]
    .filter((soldier) => {
      if (soldier.id === input.holderId || soldier.archived_at !== null) return false
      if (soldier.status !== SoldierStatus.enum.active) return false
      const unit = primaryUnitOn(memberships, soldier.id, input.date)
      if (unit === null || !reach.has(unit)) return false
      return availability.on(soldier.id, input.date, APPROVED_ONLY).status !== AvailabilityEffect.enum.unavailable
    })
    .sort((a, b) => compareCodeUnits(a.id, b.id))
    .map(({ id, first_name, last_name }) => ({ id, first_name, last_name }))
  return { date: input.date, soldiers }
}
