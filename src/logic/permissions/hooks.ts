import type { PermissionCheck } from '@contracts'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { QUERY_KEYS } from '../queries/client'
import { unwrap } from '../queries/results'
import { usePorts } from '../runtime/context'
import { useToday } from '../session/today'

// "Can I?" for gated controls (D-085, D-091). The adapter answers, because it alone sees the whole
// policy. A pending or failed answer counts as "no", so a control stays hidden. It is a hint: the
// command decides again.

export type CanAnswer = (check: PermissionCheck) => boolean

const keyOf = (check: PermissionCheck) => JSON.stringify(check)

export interface CanAnswers {
  readonly can: CanAnswer
  /** Whether the adapter has answered this check, or failed to. Until then `can` says "no" without knowing. */
  readonly known: CanAnswer
}

export function useCan(checks: readonly PermissionCheck[]): CanAnswer {
  return useCanAnswers(checks).can
}

/** The hints, and which of them have an answer yet: a state may wait for one, a control never does (D-122). */
export function useCanAnswers(checks: readonly PermissionCheck[]): CanAnswers {
  const { data } = usePorts()
  // Policy reads today (D-053), so a new day asks again (D-107).
  const today = useToday()
  const query = useQuery({
    queryKey: [...QUERY_KEYS.can, today, checks],
    queryFn: async () => {
      const answers = await unwrap(data.session.can(checks))
      return Object.fromEntries(checks.map((check, index) => [keyOf(check), answers[index] === true]))
    },
    enabled: checks.length > 0,
    // Answers are keyed by check, so a list that grows keeps the answers it already has.
    placeholderData: keepPreviousData,
  })
  const failed = query.isError
  const answers = failed ? undefined : query.data
  const can = useCallback<CanAnswer>((check) => answers?.[keyOf(check)] === true, [answers])
  const known = useCallback<CanAnswer>((check) => failed || answers?.[keyOf(check)] !== undefined, [answers, failed])
  return useMemo(() => ({ can, known }), [can, known])
}

/** Which modules the signed-in soldier may open (D-053). */
const MODULE_CHECKS = {
  units: { permission: { resource: 'units', action: 'view' }, target: { kind: 'organization' } },
  unitLevels: { permission: { resource: 'unit_levels', action: 'view' }, target: { kind: 'organization' } },
  soldiers: { permission: { resource: 'soldiers', action: 'view' }, target: { kind: 'organization' } },
  commandRanks: { permission: { resource: 'command_ranks', action: 'view' }, target: { kind: 'organization' } },
  leaveTypes: { permission: { resource: 'leave_types', action: 'view' }, target: { kind: 'organization' } },
  tags: { permission: { resource: 'tags', action: 'view' }, target: { kind: 'organization' } },
  properties: { permission: { resource: 'properties', action: 'view' }, target: { kind: 'organization' } },
  /** A global rule is organization data, so any scope of `view` opens the module (D-053, D-140). */
  rules: { permission: { resource: 'availability_rules', action: 'view' }, target: { kind: 'organization' } },
  /** Roles and their bindings are organization data (D-028, D-165). */
  roles: { permission: { resource: 'roles', action: 'view' }, target: { kind: 'organization' } },
  /** A deployment is a target of its unit; any scope of `view` opens the module (D-179). */
  deployments: { permission: { resource: 'deployments', action: 'view' }, target: { kind: 'organization' } },
  /** The dashboard is a commander's: a unit scope of leaves `view` opens it, and its rows are what that scope reads (D-349, D-359). */
  dashboard: { permission: { resource: 'leaves', action: 'view' }, target: { kind: 'some_unit' } },
} as const satisfies Record<string, PermissionCheck>

export const MODULE_CHECK_LIST: readonly PermissionCheck[] = Object.values(MODULE_CHECKS)

export function useModuleAccess() {
  const can = useCan(MODULE_CHECK_LIST)
  return {
    units: can(MODULE_CHECKS.units),
    unitLevels: can(MODULE_CHECKS.unitLevels),
    soldiers: can(MODULE_CHECKS.soldiers),
    commandRanks: can(MODULE_CHECKS.commandRanks),
    leaveTypes: can(MODULE_CHECKS.leaveTypes),
    tags: can(MODULE_CHECKS.tags),
    properties: can(MODULE_CHECKS.properties),
    rules: can(MODULE_CHECKS.rules),
    roles: can(MODULE_CHECKS.roles),
    deployments: can(MODULE_CHECKS.deployments),
    dashboard: can(MODULE_CHECKS.dashboard),
  }
}
