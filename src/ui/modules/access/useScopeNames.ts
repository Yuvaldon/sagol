import { useSoldiers, useUnitLevels, useUnits } from '@logic'
import { useMemo } from 'react'
import type { ScopeNames } from './scopeText'

/** The names a scope row reads; what has not loaded yet reads as the anchor alone. */
export function useScopeNames(): ScopeNames {
  const units = useUnits()
  const levels = useUnitLevels()
  const soldiers = useSoldiers()
  return useMemo(
    () => ({
      units: units.status === 'ready' ? units.value : [],
      levels: levels.status === 'ready' ? levels.value : [],
      soldiers: soldiers.status === 'ready' ? soldiers.value : [],
    }),
    [units, levels, soldiers],
  )
}
