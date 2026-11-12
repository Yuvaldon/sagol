import type { CalendarDate, Deployment, FilterExpression, PermissionCheck, Soldier } from '@contracts'
import { addDays } from '@domain'
import { useMemo } from 'react'
import { useFilterSource } from '../filters/source'
import { useLeaves, useLeaveTypes } from '../leaves/hooks'
import { checkOn } from '../permissions/checks'
import { useCanAnswers } from '../permissions/hooks'
import type { Loaded } from '../queries/loaded'
import { dateWindowOf } from '../view-state/window'
import { usePlacementHints } from '../roster/hooks'
import { filterUnitOf } from '../view-state/filter'
import { presenceLists, type PresenceLists } from './presence'
import { dayReport, type DayReport } from './report'

// The present and absent lists of a day, read like the board (D-134), and the day report (D-193).

/** The lists of `day`. Loading while the day is unknown. */
export function usePresence(day: CalendarDate | null, filter: FilterExpression | null): Loaded<PresenceLists> {
  const window = useMemo(() => (day === null ? null : dateWindowOf({ from: day, to: day }, day)), [day])
  const source = useFilterSource()
  const leaves = useLeaves(window)
  const types = useLeaveTypes()
  const checks = useMemo(
    (): readonly PermissionCheck[] => (source.status === 'ready' ? source.value.soldiers.map(leavesCheckOf) : []),
    [source],
  )
  const answers = useCanAnswers(checks)
  return useMemo((): Loaded<PresenceLists> => {
    if (day === null) return { status: 'loading' }
    if (source.status !== 'ready') return source
    if (leaves.status !== 'ready') return leaves
    if (types.status !== 'ready') return types
    // The lists wait for every answer, so a soldier never moves out of them a moment later (D-161).
    if (!checks.every(answers.known)) return { status: 'loading' }
    const readsLeavesOf = (soldier: Soldier) => answers.can(leavesCheckOf(soldier))
    return {
      status: 'ready',
      value: presenceLists({ source: source.value, filter, leaves: leaves.value, types: types.value, day, readsLeavesOf }),
    }
  }, [day, source, leaves, types, filter, checks, answers])
}

function leavesCheckOf(soldier: Soldier): PermissionCheck {
  return checkOn({ resource: 'leaves', action: 'view' }, soldier.id)
}

const NO_SOLDIERS: readonly Soldier[] = []

/**
 * The report of `days` (D-193): the leaves of the day before the first through the day after the last, so the first
 * and the last day know who leaves and who returns. Loading while the days are unknown.
 */
export function useDayReport(
  days: readonly CalendarDate[],
  filter: FilterExpression | null,
  rotations: readonly Deployment[],
): Loaded<DayReport> {
  const first = days[0]
  const last = days.at(-1)
  const span = useMemo(
    () => (first === undefined || last === undefined ? null : { from: addDays(first, -1), to: addDays(last, 1) }),
    [first, last],
  )
  const source = useFilterSource()
  const leaves = useLeaves(span)
  const types = useLeaveTypes()
  const soldiers = source.status === 'ready' ? source.value.soldiers : NO_SOLDIERS
  const checks = useMemo((): readonly PermissionCheck[] => soldiers.map(leavesCheckOf), [soldiers])
  const answers = useCanAnswers(checks)
  const placements = usePlacementHints(soldiers)
  return useMemo((): Loaded<DayReport> => {
    if (span === null) return { status: 'loading' }
    if (source.status !== 'ready') return source
    if (leaves.status !== 'ready') return leaves
    if (types.status !== 'ready') return types
    // The report waits for every answer, so a soldier never moves out of it a moment later (D-161, D-122).
    if (!checks.every(answers.known) || !placements.settled) return { status: 'loading' }
    const unit = filterUnitOf(filter)
    return {
      status: 'ready',
      value: dayReport({
        source: source.value,
        filter,
        leaves: leaves.value,
        types: types.value,
        days,
        scopeUnitId: unit.kind === 'unit' ? unit.unitId : null,
        rotations,
        readsLeavesOf: (soldier) => answers.can(leavesCheckOf(soldier)),
        readsPlacements: placements.readsOrPending,
      }),
    }
  }, [span, source, leaves, types, checks, answers, placements, filter, days, rotations])
}
