import type { PermissionCheck, SeniorityOverride, SoldierId } from '@contracts'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { checkOn } from '../permissions/checks'
import { useCan } from '../permissions/hooks'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { loaded, type Loaded } from '../queries/loaded'
import { unwrap } from '../queries/results'
import { usePorts } from '../runtime/context'
import { toCreateSeniorityOverrideInput, type SeniorityOverrideFormValues } from './seniority'

// Reading, creating and revoking seniority overrides (D-029, D-179).

const EVERY_OVERRIDE = { soldier_ids: null, include_revoked: true }

/** Every override the actor sees, revoked ones too: the filters and the policy skip those (D-131, OI-081). */
export function useSeniorityOverrides(): Loaded<readonly SeniorityOverride[]> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.seniorityOverrides, EVERY_OVERRIDE],
      queryFn: () => unwrap(data.repositories.seniority_overrides.list(EVERY_OVERRIDE)),
    }),
  )
}

export function useSeniorityOverrideCommands(soldierId: SoldierId) {
  const { data } = usePorts()
  const overrides = data.commands.seniority_overrides
  const keys = [QUERY_KEYS.seniorityOverrides]
  const create = useCommand(keys, (values: SeniorityOverrideFormValues) =>
    overrides.create(toCreateSeniorityOverrideInput(soldierId, values)),
  )
  const revoke = useCommand(keys, (override: SeniorityOverride) => overrides.revoke({ id: override.id }))
  return { create, revoke }
}

// ---------------------------------------------------------------------- hints

const SENIORITY = {
  view: { resource: 'seniority_overrides', action: 'view' },
  create: { resource: 'seniority_overrides', action: 'create' },
  revoke: { resource: 'seniority_overrides', action: 'delete' },
} as const

/** What the actor may do with one soldier's overrides: they are targets of the soldier (D-179). A hint. */
export function useSeniorityPermissions(soldierId: SoldierId) {
  const checks = useMemo<PermissionCheck[]>(
    () => [checkOn(SENIORITY.view, soldierId), checkOn(SENIORITY.create, soldierId), checkOn(SENIORITY.revoke, soldierId)],
    [soldierId],
  )
  const can = useCan(checks)
  return {
    view: can(checkOn(SENIORITY.view, soldierId)),
    create: can(checkOn(SENIORITY.create, soldierId)),
    revoke: can(checkOn(SENIORITY.revoke, soldierId)),
  }
}
