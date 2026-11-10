import type { CalendarDate, FilterExpression } from '@contracts'
import { useMemo } from 'react'
import { useFilterSource } from '../filters/source'
import { useLeaves, useLeaveTypes } from '../leaves/hooks'
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
  return useMemo((): Loaded<PresenceLists> => {
    if (day === null) return { status: 'loading' }
    if (source.status !== 'ready') return source
    if (leaves.status !== 'ready') return leaves
    if (types.status !== 'ready') return types
    return { status: 'ready', value: presenceLists({ source: source.value, filter, leaves: leaves.value, types: types.value, day }) }
  }, [day, source, leaves, types, filter])
}
