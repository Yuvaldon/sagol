import type { AvailabilityRuleId, Deployment, Leave, LeaveBatch, Result } from '@contracts'
import { useMemo } from 'react'
import { useDeploymentMembers } from '../deployments/hooks'
import type { WithProperties } from '../properties/properties'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { usePorts } from '../runtime/context'
import { scopeRotation, useDateWindow } from '../view-state/window'
import { roundAnswerIssues, toLeaveRoundInput, type LeaveRoundValues, type RoundContext } from './planner'

// The leave-round planner's reads and its command (D-270, D-316).

export interface LeaveRoundSetup {
  /** NULL while the rotations or their members load. */
  readonly context: RoundContext | null
  /** The rotation a new plan starts in: the one in view, else the one that runs today, else the first open one. */
  readonly preferred: Deployment | null
}

/** The open rotations in scope (D-211) and their members: a plan is made in one of them. */
export function useLeaveRoundSetup(): LeaveRoundSetup {
  const { window, rotations, rotationsReady, today } = useDateWindow()
  const members = useDeploymentMembers()
  const memberRows = members.status === 'ready' ? members.value : null
  const context = useMemo(
    () => (!rotationsReady || memberRows === null ? null : { rotations: rotations.filter((rotation) => rotation.closed_at === null), members: memberRows }),
    [rotations, rotationsReady, memberRows],
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
