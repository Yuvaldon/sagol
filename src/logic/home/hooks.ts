import { DEVICE_KEYS } from '@config'
import type { PermissionCheck } from '@contracts'
import { LEAVE_PERMISSIONS } from '@domain'
import { useCallback, useMemo } from 'react'
import { useDeviceFlag } from '../device/hooks'
import { checkOn } from '../permissions/checks'
import { MODULE_CHECK_LIST, useCanAnswers } from '../permissions/hooks'
import { useSoldiers } from '../roster/hooks'
import { useSession } from '../session/hooks'

// Where the app opens (D-265). Who manages, approving anyone they see or opening any module, starts on the board;
// whoever else has a soldier record starts on "mine". The last home chosen on this device wins over the derived one.

export interface Home {
  /** Whether every answer the choice reads has arrived; until then nothing moves. */
  readonly ready: boolean
  /** Whether "mine" is a destination: the actor has a soldier record they may read the leaves of. */
  readonly offersMine: boolean
  /** Whether home is "mine"; the board otherwise. */
  readonly mine: boolean
  /** Remember the home just chosen: "mine" or the board. */
  readonly choose: (mine: boolean) => void
}

const NO_CHECKS: readonly PermissionCheck[] = []

export function useHome(): Home {
  const session = useSession()
  const own = session.status === 'ready' && session.value.status === 'linked' ? session.value.soldier_id : null
  const soldiers = useSoldiers()
  const seen = soldiers.status === 'ready' ? soldiers.value : null
  const viewOwn = useMemo(() => (own === null ? null : checkOn(LEAVE_PERMISSIONS.view, own)), [own])
  const approve = useMemo(
    () => (seen === null ? NO_CHECKS : seen.map((soldier) => checkOn(LEAVE_PERMISSIONS.approve, soldier.id))),
    [seen],
  )
  const checks = useMemo(
    () => [...MODULE_CHECK_LIST, ...approve, ...(viewOwn === null ? NO_CHECKS : [viewOwn])],
    [approve, viewOwn],
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
  const choose = useCallback((next: boolean) => setAway(next !== derivedMine), [setAway, derivedMine])
  return { ready, offersMine, mine, choose }
}
