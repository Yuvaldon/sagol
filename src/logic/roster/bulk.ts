import type { AppError, Permission, PolicyTarget, Soldier, SoldierId, Unit, UnitId, UnitMembership } from '@contracts'
import { soldierTarget } from '@domain'
import { useMemo } from 'react'
import { checkOf } from '../permissions/checks'
import { useCan } from '../permissions/hooks'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { usePorts } from '../runtime/context'
import { moveFormIssues, toChangeMembershipInput, type MoveFormValues } from './forms'
import { openMembershipOf } from './roster'

// "העברה" of several soldiers at once (the handoff's tray, D-482): each soldier closes their placement and opens one in
// the chosen unit from the chosen day, by the single `changeMembership` command, one after another, as the quick entry
// and the bulk approval do. There is no bulk command, and each answer stands alone.

const MOVE: Permission = { resource: 'memberships', action: 'update' }
/** A move closes the placement the actor reads: who may not read a soldier's placements may not move them (D-096). */
const READ: Permission = { resource: 'memberships', action: 'view' }
const unitTarget = (unitId: UnitId): PolicyTarget => ({ kind: 'unit', unit_id: unitId })

/**
 * Who of the soldiers the actor may move, and the units they may move them to (D-096): a soldier whose placements they
 * read and may change. A hint: each command decides again.
 */
export function useMovePermissions(soldiers: readonly Soldier[], units: readonly Unit[]) {
  const checks = useMemo(
    () => [
      ...soldiers.flatMap((soldier) => [checkOf(MOVE, soldierTarget(soldier.id)), checkOf(READ, soldierTarget(soldier.id))]),
      ...units.map((unit) => checkOf(MOVE, unitTarget(unit.id))),
    ],
    [soldiers, units],
  )
  const can = useCan(checks)
  return useMemo(
    () => ({
      moves: (soldierId: SoldierId) => can(checkOf(MOVE, soldierTarget(soldierId))) && can(checkOf(READ, soldierTarget(soldierId))),
      moveTo: (unitId: UnitId) => can(checkOf(MOVE, unitTarget(unitId))),
    }),
    [can],
  )
}

/** Each soldier's answer, by id: moved, or refused with the adapter's reason. */
export type MoveAnswers = ReadonlyMap<SoldierId, { readonly ok: true } | { readonly ok: false; readonly error: AppError }>

/** Moves each soldier to `values.unit_id` from `values.effective_date`. A refusal does not stop the rest. */
export function useMoveSoldiers() {
  const { data } = usePorts()
  return useCommand(
    [QUERY_KEYS.unitMemberships],
    async ({ soldierIds, memberships, values }: { soldierIds: readonly SoldierId[]; memberships: readonly UnitMembership[]; values: MoveFormValues }) => {
      const answers = new Map<SoldierId, { readonly ok: true } | { readonly ok: false; readonly error: AppError }>()
      for (const soldierId of soldierIds) {
        const open = openMembershipOf(memberships, soldierId)
        const [issue, ...more] = moveFormIssues(soldierId, open, values)
        if (issue !== undefined) {
          answers.set(soldierId, { ok: false, error: { code: 'validation_failed', issues: [issue, ...more] } })
          continue
        }
        const result = await data.commands.soldiers.changeMembership(toChangeMembershipInput(soldierId, open, values))
        answers.set(soldierId, result.ok ? { ok: true } : { ok: false, error: result.error })
      }
      const answer: { ok: true; value: MoveAnswers } = { ok: true, value: answers }
      return answer
    },
  )
}
