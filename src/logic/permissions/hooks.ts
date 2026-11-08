import type { PermissionCheck } from '@contracts'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { QUERY_KEYS } from '../queries/client'
import { unwrap } from '../queries/results'
import { usePorts } from '../runtime/context'

// "Can I?" for gated controls (D-085, D-091). The adapter answers, because it alone sees the whole
// policy. A pending or failed answer counts as "no", so a control stays hidden. It is a hint: the
// command decides again.

export type CanAnswer = (check: PermissionCheck) => boolean

const keyOf = (check: PermissionCheck) => JSON.stringify(check)

export function useCan(checks: readonly PermissionCheck[]): CanAnswer {
  const { data } = usePorts()
  const query = useQuery({
    queryKey: [...QUERY_KEYS.can, checks],
    queryFn: async () => {
      const answers = await unwrap(data.session.can(checks))
      return Object.fromEntries(checks.map((check, index) => [keyOf(check), answers[index] === true]))
    },
    enabled: checks.length > 0,
    // Answers are keyed by check, so a list that grows keeps the answers it already has.
    placeholderData: keepPreviousData,
  })
  const answers = query.isError ? undefined : query.data
  return useCallback((check) => answers?.[keyOf(check)] === true, [answers])
}

/** Which modules the signed-in soldier may open (D-053). */
const MODULE_CHECKS = {
  units: { permission: { resource: 'units', action: 'view' }, target: { kind: 'organization' } },
  unitLevels: { permission: { resource: 'unit_levels', action: 'view' }, target: { kind: 'organization' } },
  soldiers: { permission: { resource: 'soldiers', action: 'view' }, target: { kind: 'organization' } },
  commandRanks: { permission: { resource: 'command_ranks', action: 'view' }, target: { kind: 'organization' } },
} as const satisfies Record<string, PermissionCheck>

const MODULE_CHECK_LIST: readonly PermissionCheck[] = Object.values(MODULE_CHECKS)

export function useModuleAccess() {
  const can = useCan(MODULE_CHECK_LIST)
  return {
    units: can(MODULE_CHECKS.units),
    unitLevels: can(MODULE_CHECKS.unitLevels),
    soldiers: can(MODULE_CHECKS.soldiers),
    commandRanks: can(MODULE_CHECKS.commandRanks),
  }
}
