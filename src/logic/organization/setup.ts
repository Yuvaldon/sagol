import { SETUP_STEPS, type PanelId, type SetupStepId } from '@config'
import type { PermissionCheck } from '@contracts'
import { useRankBindings } from '../access/hooks'
import { useDeployments } from '../deployments/hooks'
import { useLeaveTypes } from '../leaves/hooks'
import { useCan } from '../permissions/hooks'
import type { Loaded } from '../queries/loaded'
import { useCommandRanks, useSoldiers } from '../roster/hooks'
import { useTags } from '../tags/hooks'
import { useUnitLevels, useUnits } from '../units/hooks'

// The organization's setup (D-033, D-180): its steps in order, each one for who may create what it sets up across the
// organization. A step is done once a live row of what it sets up exists; nothing about the setup is stored.

export interface SetupStep {
  readonly id: SetupStepId
  readonly panel: PanelId
  readonly done: boolean
}

/** The rows a step sets up, archived ones too. */
export type SetupRows = readonly { readonly archived_at: string | null }[]

/** The steps allowed, in order, each done once it has a live row. */
export function setupSteps(allowed: readonly SetupStepId[], rows: Partial<Readonly<Record<SetupStepId, SetupRows>>>): SetupStep[] {
  return SETUP_STEPS.filter((step) => allowed.includes(step.id)).map((step) => ({
    id: step.id,
    panel: step.panel,
    done: (rows[step.id] ?? []).some((row) => row.archived_at === null),
  }))
}

const ORGANIZATION = { kind: 'organization' } as const

const STEP_CHECKS = SETUP_STEPS.map((step) => {
  const check: PermissionCheck = { permission: { resource: step.resource, action: 'create' }, target: ORGANIZATION }
  return { id: step.id, check }
})

const CHECK_LIST: readonly PermissionCheck[] = STEP_CHECKS.map((step) => step.check)

/** The steps this actor may do. None means there is no setup for them, and it does not show (D-076). */
export function useSetupAccess(): readonly SetupStepId[] {
  const can = useCan(CHECK_LIST)
  return STEP_CHECKS.filter((step) => can(step.check)).map((step) => step.id)
}

/** The steps this actor may do, each with whether it is done. */
export function useSetupProgress(): Loaded<readonly SetupStep[]> {
  const allowed = useSetupAccess()
  const units = useUnits()
  const sources: Readonly<Record<SetupStepId, Loaded<SetupRows>>> = {
    unit_levels: useUnitLevels(),
    units,
    command_ranks: useCommandRanks(),
    rank_bindings: useRankBindings(),
    leave_types: useLeaveTypes(),
    tags: useTags(),
    soldiers: useSoldiers(),
    deployments: useDeployments(),
  }
  const rows: Partial<Record<SetupStepId, SetupRows>> = {}
  for (const id of allowed) {
    const source = sources[id]
    if (source.status !== 'ready') return source
    rows[id] = source.value
  }
  // The root comes with the claim (D-251), so the units step is done once a unit under it exists (D-223).
  if (units.status === 'ready' && rows.units !== undefined) rows.units = units.value.filter((unit) => unit.parent_id !== null)
  return { status: 'ready', value: setupSteps(allowed, rows) }
}
