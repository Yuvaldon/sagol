import { DEVICE_KEYS } from '@config'
import type { PermissionCheck } from '@contracts'
import { LEAVE_PERMISSIONS } from '@domain'
import { useCallback, useMemo } from 'react'
import { useDeviceFlag } from '../device/hooks'
import { checkOn } from '../permissions/checks'
import { useCanAnswers } from '../permissions/hooks'
import { useSoldiers } from '../roster/hooks'
import { useSession } from '../session/hooks'

// Where the app opens (D-265). Who manages someone else starts on the board: who may approve or read the leaves of a
// soldier other than themselves, or create in any module across the organization. A view of one's own record opens a
// module too, so viewing one is no sign of managing. Whoever else has a soldier record starts on "mine". The last home
// chosen on this device wins over the derived one.

export interface Home {
  /** Whether every answer the choice reads has arrived; until then nothing moves. */
  readonly ready: boolean
  /** Whether "mine" is a destination: the actor has a soldier record they may read the leaves of. */
  readonly offersMine: boolean
  /** Whether home is "mine"; the board otherwise. */
  readonly mine: boolean
  /** Remember the home just chosen: "mine" or the board. Nothing is kept until it is ready. */
  readonly choose: (mine: boolean) => void
}

const NO_CHECKS: readonly PermissionCheck[] = []

/** Creating in a module across the organization: no scope narrower than the organization covers it (D-053). */
const ORGANIZATION_CHECKS: readonly PermissionCheck[] = [
  { permission: { resource: 'units', action: 'create' }, target: { kind: 'organization' } },
  { permission: { resource: 'unit_levels', action: 'create' }, target: { kind: 'organization' } },
  { permission: { resource: 'soldiers', action: 'create' }, target: { kind: 'organization' } },
  { permission: { resource: 'command_ranks', action: 'create' }, target: { kind: 'organization' } },
  { permission: { resource: 'leave_types', action: 'create' }, target: { kind: 'organization' } },
  { permission: { resource: 'tags', action: 'create' }, target: { kind: 'organization' } },
  { permission: { resource: 'properties', action: 'create' }, target: { kind: 'organization' } },
  { permission: { resource: 'availability_rules', action: 'create' }, target: { kind: 'organization' } },
  { permission: { resource: 'roles', action: 'create' }, target: { kind: 'organization' } },
  { permission: { resource: 'deployments', action: 'create' }, target: { kind: 'organization' } },
]

export function useHome(): Home {
  const session = useSession()
  const own = session.status === 'ready' && session.value.status === 'linked' ? session.value.soldier_id : null
  const soldiers = useSoldiers()
  const seen = soldiers.status === 'ready' ? soldiers.value : null
  const viewOwn = useMemo(() => (own === null ? null : checkOn(LEAVE_PERMISSIONS.view, own)), [own])
  const others = useMemo(
    () =>
      seen === null
        ? NO_CHECKS
        : seen
            .filter((soldier) => soldier.id !== own)
            .flatMap((soldier) => [checkOn(LEAVE_PERMISSIONS.approve, soldier.id), checkOn(LEAVE_PERMISSIONS.view, soldier.id)]),
    [seen, own],
  )
  const checks = useMemo(
    () => [...ORGANIZATION_CHECKS, ...others, ...(viewOwn === null ? NO_CHECKS : [viewOwn])],
    [others, viewOwn],
  )
  const { can, known } = useCanAnswers(checks)
  const away = useDeviceFlag(DEVICE_KEYS.homeAway)

  const ready = session.status === 'ready' && soldiers.status !== 'loading' && checks.every(known)
  const manages = checks.some((check) => check !== viewOwn && can(check))
  const offersMine = viewOwn !== null && can(viewOwn)
  // A manager's derived home is the board; anyone else's is "mine".
  const derivedMine = !manages
  const mine = offersMine && derivedMine !== away.value
  const setAway = away.set
  // Until every answer has arrived the derived home is a guess, and a choice measured against it would be kept wrong.
  const choose = useCallback(
    (next: boolean) => {
      if (ready) setAway(next !== derivedMine)
    },
    [ready, setAway, derivedMine],
  )
  return { ready, offersMine, mine, choose }
}
