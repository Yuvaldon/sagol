import type { CalendarDate, Deployment, DeploymentMember } from '@contracts'
import { useMemo } from 'react'
import { useDeploymentMembers } from '../deployments/hooks'
import { pickableRotations, useDateWindow } from './window'

// The rotation the workspace is about (D-217, D-218). Pure parts first, then the hook.

/**
 * The rotations a request can be about (D-218): running or to come, with a member the actor sees. A soldier sees only
 * their own membership, so their requests follow the rotations they serve in; a commander sees their soldiers'.
 */
export function requestRotations(
  rotations: readonly Deployment[],
  members: readonly Pick<DeploymentMember, 'deployment_id'>[],
  today: CalendarDate,
): Deployment[] {
  const manned = new Set<string>(members.map((member) => member.deployment_id))
  return pickableRotations(rotations, today).filter((rotation) => manned.has(rotation.id))
}

export interface RotationScope {
  /** False while the rotations, their members or today load. */
  readonly ready: boolean
  /** No rotation running or to come in scope: the viewport shows its empty state (D-218). */
  readonly none: boolean
  /** Whether the request surfaces exist (D-218). */
  readonly requests: boolean
}

const LOADING: RotationScope = { ready: false, none: false, requests: false }

export function useRotationScope(): RotationScope {
  const { rotations, today, rotationsReady } = useDateWindow()
  const members = useDeploymentMembers()
  return useMemo(() => {
    if (today === null || !rotationsReady || members.status !== 'ready') return LOADING
    return {
      ready: true,
      none: pickableRotations(rotations, today).length === 0,
      requests: requestRotations(rotations, members.value, today).length > 0,
    }
  }, [rotations, today, rotationsReady, members])
}
