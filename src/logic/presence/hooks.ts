import type { CalendarDate, FilterExpression, PermissionCheck, Soldier } from '@contracts'
import { useMemo } from 'react'
import { useFilterSource } from '../filters/source'
import { useLeaves, useLeaveTypes } from '../leaves/hooks'
import { checkOn } from '../permissions/checks'
import { useCanAnswers } from '../permissions/hooks'
import type { Loaded } from '../queries/loaded'
import { dateWindowOf } from '../view-state/window'
import { presenceLists, type PresenceLists } from './presence'

// The present and absent lists of a day, read like the board (D-134).

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
