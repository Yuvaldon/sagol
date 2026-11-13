import type { CalendarDate, Deployment } from '@contracts'
import { compareDates } from '@domain'
import { useMemo } from 'react'
import { useDeploymentPermissions } from '../deployments/hooks'
import { useMyLeavesAccess } from '../leaves/workflowHooks'
import { useUnits } from '../units/hooks'
import { useRotationScope } from '../view-state/rotation'
import { useDateWindow } from '../view-state/window'

// The bottom strip's quick action (D-266, D-296): it follows the role, then the mode. While a rotation runs or is to
// come, "בקשה חדשה" for who may request for themselves; in routine, "פתיחת סבב" for who may open one. A unit always
// exists (D-262, D-315), so there is no "found the tree" action (D-076). An ended rotation not yet closed has none:
// requests come before and during a rotation, not after it. Entering a leave for someone else is never the quick action.

export type QuickAction = 'new_leave' | 'open_rotation'

/** What the quick action reads; pure, so the role × mode table is tested without a screen. */
export interface QuickActionFacts {
  /** The mode (D-257): routine, a rotation that runs or comes, or one that ended and is not closed. */
  readonly mode: 'routine' | 'running' | 'ended'
  /** A rotation a request can be about exists (D-218). */
  readonly requests: boolean
  /** The actor may request leave for their own soldier (D-167). */
  readonly requestsForSelf: boolean
  /** The actor may open a rotation in a unit they see. */
  readonly opensRotation: boolean
}

export function quickActionOf(facts: QuickActionFacts): QuickAction | null {
  if (facts.mode === 'running') return facts.requests && facts.requestsForSelf ? 'new_leave' : null
  if (facts.mode === 'ended') return null
  return facts.opensRotation ? 'open_rotation' : null
}

/** Whether the mode's rotation has ended: its planned end is before today (D-222). */
export function rotationEnded(rotation: Pick<Deployment, 'end_date'>, today: CalendarDate): boolean {
  return rotation.end_date !== null && compareDates(rotation.end_date, today) < 0
}

const NO_UNITS: readonly never[] = []

/** The actor's quick action now; NULL while anything it reads loads, and when the role and the mode offer none. */
export function useQuickAction(): QuickAction | null {
  const scope = useRotationScope()
  const { rotations, today } = useDateWindow()
  const mine = useMyLeavesAccess()
  const units = useUnits()
  const live = units.status === 'ready' ? units.value : NO_UNITS
  const { createAny } = useDeploymentPermissions(live, rotations)
  return useMemo(() => {
    if (!scope.ready || today === null || units.status !== 'ready') return null
    const mode = scope.rotation === null ? 'routine' : rotationEnded(scope.rotation, today) ? 'ended' : 'running'
    return quickActionOf({
      mode,
      requests: scope.requests,
      requestsForSelf: mine?.create === true,
      opensRotation: createAny,
    })
  }, [scope, today, units.status, mine, createAny])
}
