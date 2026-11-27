import { DATE_WINDOW } from '@config'
import type { AvailabilityRuleId, Deployment, Leave, LeaveBatch, Result, Soldier } from '@contracts'
import { addDays } from '@domain'
import { useMemo } from 'react'
import { useRotationMembership } from '../deployments/hooks'
import type { WithProperties } from '../properties/properties'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { usePorts } from '../runtime/context'
import { scopeRotation, useDateWindow } from '../view-state/window'
import { useSoldiers } from '../roster/hooks'
import { useLeaveCreation, useLeaves } from './hooks'
import { rotationSoldiers, roundAnswerIssues, toLeaveRoundInput, type LeaveRoundValues, type RoundContext } from './planner'

// The leave-round planner's reads and its command (D-270, D-316).

export interface LeaveRoundSetup {
  /** NULL while the rotations, their members, the units or the memberships load. */
  readonly context: RoundContext | null
  /** The rotation a new plan starts in: the one in view, else the one that runs today, else the first open one. */
  readonly preferred: Deployment | null
}

/** The open rotations in scope (D-211) and who serves in them (D-336): a plan is made in one of them. */
export function useLeaveRoundSetup(): LeaveRoundSetup {
  const { window, rotations, rotationsReady, today } = useDateWindow()
  const membership = useRotationMembership()
  const context = useMemo(
    () => (!rotationsReady || membership === null ? null : { rotations: rotations.filter((rotation) => rotation.closed_at === null), members: membership }),
    [rotations, rotationsReady, membership],
  )
  const open = context?.rotations ?? NONE
  const preferred =
    open.find((rotation) => rotation.id === window?.rotationId) ?? (today === null ? null : scopeRotation(open, today)) ?? open[0] ?? null
  return { context, preferred }
}

/**
 * The plan, sent as one collective leave: all or nothing, so no optimistic rows (D-179). `acknowledged` are the soft
 * rules the actor agreed to break, sent again after the dialog (D-047, D-142). An answer lands on the plan's fields.
 */
export function useCreateLeaveRounds() {
  const { data } = usePorts()
  return useCommand(
    [QUERY_KEYS.leaves, QUERY_KEYS.leaveBatches],
    async ({
      values,
      context,
      acknowledged = [],
    }: {
      values: LeaveRoundValues & WithProperties
      context: RoundContext
      acknowledged?: readonly AvailabilityRuleId[]
    }): Promise<Result<{ batch: LeaveBatch; leaves: Leave[] }>> => {
      const { input, rounds } = toLeaveRoundInput(values, context, acknowledged)
      const result = await data.commands.leaves.createBatch(input)
      if (result.ok || result.error.code !== 'validation_failed') return result
      return { ok: false, error: { ...result.error, issues: roundAnswerIssues(result.error.issues, rounds) } }
    },
  )
}

const NONE: readonly Deployment[] = []

/** "סבב יציאות · תכנון" (OI-389, D-482): where a plan starts, and who is left out of every round there. */
export interface RoundPlanning {
  /** The rotation a new plan starts in. */
  readonly rotation: Deployment
  /** Of the soldiers the actor may plan for who serve in it, how many have no leave of a round there; NULL while it loads. */
  readonly unplanned: number | null
}

/**
 * The planner's own entry: for who may create leaves for more than one soldier while an open rotation exists (D-316),
 * as the new-leave form offered it; NULL for anyone else. A leave of a round is a leave of a batch (D-268) in the
 * rotation, waiting or approved; nothing is stored for "planned" (rule 3).
 */
export function useRoundPlanning(): RoundPlanning | null {
  const soldiers = useSoldiers()
  const creation = useLeaveCreation(soldiers.status === 'ready' ? soldiers.value : NO_SOLDIERS)
  const { context, preferred } = useLeaveRoundSetup()
  const plans = creation.soldiers.length > 1
  // Only who plans reads the rotation's leaves: "היום" asks this of everyone.
  const span = useMemo(
    () => (preferred === null || !plans ? null : { from: preferred.start_date, to: preferred.end_date ?? addDays(preferred.start_date, DATE_WINDOW.maxDays - 1) }),
    [preferred, plans],
  )
  const leaves = useLeaves(span)
  return useMemo(() => {
    if (context === null || preferred === null || creation.soldiers.length < 2) return null
    if (leaves.status !== 'ready') return { rotation: preferred, unplanned: null }
    const planned = new Set(leaves.value.filter((leave) => leave.batch_id !== null && leave.deployment_id === preferred.id).map((leave) => leave.soldier_id))
    const serving = rotationSoldiers(
      preferred,
      context.members,
      creation.soldiers.map((soldier) => soldier.id),
    )
    return { rotation: preferred, unplanned: serving.filter((soldierId) => !planned.has(soldierId)).length }
  }, [context, preferred, creation.soldiers, leaves])
}

const NO_SOLDIERS: readonly Soldier[] = []
