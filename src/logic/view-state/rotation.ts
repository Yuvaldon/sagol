import type { CalendarDate, Deployment } from '@contracts'
import { useMemo } from 'react'
import { pickableRotations, scopeRotation, useDateWindow } from './window'

// The rotation the workspace is about, and so its mode (D-217, D-218, D-257, D-222). Pure parts first, then the hook.

/**
 * The rotations a request can be about (D-218, D-222): open, and running, to come or ended but not closed. A member
 * row the actor does not see says nothing: a rotation with no rows holds the whole unit (D-259), so the command, not
 * the screen, answers `not_a_member`.
 */
export function requestRotations(rotations: readonly Deployment[], today: CalendarDate): Deployment[] {
  return pickableRotations(rotations, today).filter((rotation) => rotation.closed_at === null)
}

export interface RotationScope {
  /** False while the rotations or today load. */
  readonly ready: boolean
  /** The rotation of the mode (D-257): NULL is routine. */
  readonly rotation: Deployment | null
  /** Routine (שגרה): no rotation in scope runs, comes or waits to be closed (D-257). */
  readonly none: boolean
  /** Whether the request surfaces exist (D-218): not in routine. */
  readonly requests: boolean
}

const LOADING: RotationScope = { ready: false, rotation: null, none: false, requests: false }

export function useRotationScope(): RotationScope {
  const { rotations, today, rotationsReady } = useDateWindow()
  return useMemo(() => {
    if (today === null || !rotationsReady) return LOADING
    const rotation = scopeRotation(rotations, today)
    return {
      ready: true,
      rotation,
      none: rotation === null,
      requests: requestRotations(rotations, today).length > 0,
    }
  }, [rotations, today, rotationsReady])
}
