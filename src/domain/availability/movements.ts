import { AvailabilityEffect, type CalendarDate, type SoldierId } from '@contracts'
import { addDays } from '../time'
import type { AvailabilityContext, AvailabilityOptions, SoldierDay } from './days'

// Who leaves and who comes back on a day (D-193). Derived from the day's status and its neighbours', so overlapping
// and back-to-back leaves never count a departure or a return that does not happen. Pure.

/** One soldier on one day of a report: the day's availability, and whether it starts or ends an absence. */
export interface SoldierMovement {
  readonly day: SoldierDay
  /** Absent on the day and present the day before: the absence starts on the day. */
  readonly leaving: boolean
  /** Absent on the day and present the day after: the absence ends on the day, the last day away (end inclusive). */
  readonly returning: boolean
}

/** The day's lists. Every soldier is in exactly one of present and absent; leaving and returning are part of absent. */
export interface DayMovements {
  readonly date: CalendarDate
  readonly present: readonly SoldierMovement[]
  readonly absent: readonly SoldierMovement[]
  readonly leaving: readonly SoldierMovement[]
  readonly returning: readonly SoldierMovement[]
}

const unavailable = (day: SoldierDay) => day.status === AvailabilityEffect.enum.unavailable

/** One soldier's movement on `date`. A one-day absence both leaves and returns. */
export function soldierMovement(
  context: AvailabilityContext,
  soldierId: SoldierId,
  date: CalendarDate,
  options: AvailabilityOptions,
): SoldierMovement {
  const day = context.on(soldierId, date, options)
  if (!unavailable(day)) return { day, leaving: false, returning: false }
  return {
    day,
    leaving: context.isAvailable(soldierId, addDays(date, -1), options),
    returning: context.isAvailable(soldierId, addDays(date, 1), options),
  }
}

/** The lists of one day, in the order of `soldierIds`. Repeated ids count once. */
export function dayMovements(
  context: AvailabilityContext,
  soldierIds: Iterable<SoldierId>,
  date: CalendarDate,
  options: AvailabilityOptions,
): DayMovements {
  const present: SoldierMovement[] = []
  const absent: SoldierMovement[] = []
  for (const soldierId of new Set(soldierIds)) {
    const movement = soldierMovement(context, soldierId, date, options)
    if (unavailable(movement.day)) absent.push(movement)
    else present.push(movement)
  }
  return {
    date,
    present,
    absent,
    leaving: absent.filter((movement) => movement.leaving),
    returning: absent.filter((movement) => movement.returning),
  }
}
