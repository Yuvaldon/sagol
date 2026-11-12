import type { Deployment, DeploymentMember, PermissionCheck, Result, Unit, UnitId } from '@contracts'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { checkOf } from '../permissions/checks'
import { useCan } from '../permissions/hooks'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { loaded, type Loaded } from '../queries/loaded'
import { unwrap } from '../queries/results'
import { usePorts } from '../runtime/context'
import { useSession } from '../session/hooks'
import {
  toCreateDeploymentInput,
  toSetDeploymentMembersInput,
  toUpdateDeploymentInput,
  type DeploymentFormValues,
  type DeploymentMemberValues,
} from './deployments'

// Reading and changing deployments and their members (D-019, D-179).

const WITH_ARCHIVED = { include_archived: true }
const EVERY_DEPLOYMENT = { deployment_ids: null }

/** Every deployment the actor sees, archived ones too: a rule keeps naming its deployment (D-071). */
export function useDeployments(): Loaded<readonly Deployment[]> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.deployments, WITH_ARCHIVED],
      queryFn: () => unwrap(data.repositories.deployments.list(WITH_ARCHIVED)),
    }),
  )
}

/** The members of every deployment the actor sees, of the soldiers the actor sees. */
export function useDeploymentMembers(): Loaded<readonly DeploymentMember[]> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.deploymentMembers, EVERY_DEPLOYMENT],
      queryFn: () => unwrap(data.repositories.deployment_members.list(EVERY_DEPLOYMENT)),
    }),
  )
}

export function useDeploymentCommands() {
  const { data } = usePorts()
  const deployments = data.commands.deployments
  const keys = [QUERY_KEYS.deployments, QUERY_KEYS.deploymentMembers]
  const create = useCommand(keys, (values: DeploymentFormValues) => deployments.create(toCreateDeploymentInput(values)))
  const update = useCommand(
    keys,
    async ({ deployment, openedVersion, values }: { deployment: Deployment; openedVersion: number; values: DeploymentFormValues }) => {
      const input = toUpdateDeploymentInput(deployment, openedVersion, values)
      const unchanged: Result<Deployment> = { ok: true, value: deployment }
      return input === null ? unchanged : deployments.update(input)
    },
  )
  const archive = useCommand(keys, (deployment: Deployment) =>
    deployments.archive({ id: deployment.id, expected_version: deployment.version }),
  )
  const setMembers = useCommand(
    keys,
    ({ deployment, openedVersion, members }: { deployment: Deployment; openedVersion: number; members: readonly DeploymentMemberValues[] }) =>
      deployments.setMembers(toSetDeploymentMembersInput(deployment, openedVersion, members)),
  )
  /** Closes an ended rotation, or opens it again (D-258). */
  const close = useCommand(keys, (deployment: Deployment) =>
    deployments.close({ id: deployment.id, expected_version: deployment.version }),
  )
  const reopen = useCommand(keys, (deployment: Deployment) =>
    deployments.reopen({ id: deployment.id, expected_version: deployment.version }),
  )
  return { create, update, archive, setMembers, close, reopen }
}

// ---------------------------------------------------------------------- hints

const deploymentCheck = (action: 'view' | 'create' | 'update' | 'delete', unitId: UnitId): PermissionCheck =>
  checkOf({ resource: 'deployments', action }, { kind: 'unit', unit_id: unitId })

/**
 * Where the actor may create, change and archive deployments: a deployment is a target of its unit (D-179). A hint:
 * the command decides again.
 */
export function useDeploymentPermissions(units: readonly Unit[], deployments: readonly Deployment[]) {
  const checks = useMemo(() => {
    const scopes = new Set<UnitId>([...units.map((unit) => unit.id), ...deployments.map((deployment) => deployment.unit_id)])
    return [...scopes].flatMap((unitId) => [
      deploymentCheck('create', unitId),
      deploymentCheck('update', unitId),
      deploymentCheck('delete', unitId),
    ])
  }, [units, deployments])
  const can = useCan(checks)
  const session = useSession()
  const soldierId = session.status === 'ready' && session.value.status === 'linked' ? session.value.soldier_id : null
  return useMemo(
    () => ({
      createIn: (unitId: UnitId) => can(deploymentCheck('create', unitId)),
      createAny: units.some((unit) => can(deploymentCheck('create', unit.id))),
      update: (deployment: Deployment) => can(deploymentCheck('update', deployment.unit_id)),
      /** Moving a deployment needs `update` where it lands too. */
      moveTo: (unitId: UnitId) => can(deploymentCheck('update', unitId)),
      archive: (deployment: Deployment) => can(deploymentCheck('delete', deployment.unit_id)),
      /** Its creator may close and reopen a rotation without `update` (D-258, OI-249). */
      closeOrReopen: (deployment: Deployment) =>
        (soldierId !== null && deployment.created_by === soldierId) || can(deploymentCheck('update', deployment.unit_id)),
    }),
    [can, units, soldierId],
  )
}
