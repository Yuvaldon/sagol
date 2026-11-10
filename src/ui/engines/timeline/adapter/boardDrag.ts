import { NEW_ENTITY, PANEL_IDS } from '@config'
import { RuleEnforcement, type AppError, type RuleViolation, type Soldier, type SoldierId } from '@contracts'
import {
  datesOfRange,
  movedLeaveValues,
  newLeaveDraft,
  sameDates,
  useEditLeave,
  useLeaveRuleWarnings,
  usePanel,
  useTimelineEditing,
  type DateWindow,
  type LeaveDates,
} from '@logic'
import { useMemo, useState } from 'react'
import { useRuleGate, type RuleGate } from '../../../patterns/rules/ruleAnswer'
import type { TimelineDrag, TimelineDragProps, TimelineDragTone } from '../view/model'

// A drag on the board, between the view and the commands (D-143): who may move what, what the drop would do while the
// drag goes on, and the drop itself, one `leaves.update` with the dates through the rule gate (D-123, D-142).

/** What the card says while a drag goes on. */
export interface DragCardState {
  readonly creating: boolean
  readonly soldier: Soldier | null
  readonly dates: LeaveDates
  /** An approved leave that the move returns to pending (D-064). */
  readonly returnsToPending: boolean
  readonly warnings: readonly RuleViolation[]
}

export interface BoardDrag {
  /** What the board's marks and rows may do (D-143). */
  readonly movable: (leaveId: string) => boolean
  readonly creatable: (soldierId: SoldierId) => boolean
  readonly props: TimelineDragProps
  /** The card of the drag on screen, NULL while there is none. */
  readonly card: DragCardState | null
  /** Why the last drop was refused, until the next drag or a press on "close". */
  readonly failure: AppError | null
  clearFailure(): void
  readonly gate: RuleGate
  readonly isPending: boolean
}

function toneOf(warnings: readonly RuleViolation[]): TimelineDragTone {
  if (warnings.some((violation) => violation.enforcement === RuleEnforcement.enum.hard)) return 'hard'
  return warnings.length > 0 ? 'soft' : 'ok'
}

export function useBoardDrag(window: DateWindow, soldiers: readonly Soldier[]): BoardDrag {
  const { leaveOf, canMove, canCreate, move: moveOf } = useTimelineEditing(window, soldiers)
  const panel = usePanel()
  const edit = useEditLeave()
  const gate = useRuleGate()
  const [drag, setDrag] = useState<TimelineDrag | null>(null)
  const [held, setHeld] = useState<TimelineDrag | null>(null)
  const [failure, setFailure] = useState<AppError | null>(null)

  const dates = drag === null ? null : datesOfRange(window.from, drag.range)
  const startDate = dates?.start_date ?? null
  const endDate = dates?.end_date ?? null
  const leave = drag === null || drag.markKey === null ? null : leaveOf(drag.markKey)
  // One judgment per set of days, not per pointer move.
  const move = useMemo(
    () => (leave === null || startDate === null || endDate === null ? null : moveOf(leave, { start_date: startDate, end_date: endDate })),
    [moveOf, leave, startDate, endDate],
  )
  const warnings = useLeaveRuleWarnings(move?.candidate ?? null, leave)

  const soldierOf = (rowKey: string) => soldiers.find((soldier) => soldier.id === rowKey) ?? null

  const drop = (dropped: TimelineDrag) => {
    setDrag(null)
    setFailure(null)
    const next = datesOfRange(window.from, dropped.range)
    if (dropped.markKey === null) {
      const soldier = soldierOf(dropped.rowKey)
      if (soldier !== null) panel.open(PANEL_IDS.leaves, { entity: NEW_ENTITY, draft: newLeaveDraft(soldier.id, next) })
      return
    }
    const stored = leaveOf(dropped.markKey)
    if (stored === null || sameDates(stored, next)) return
    const values = movedLeaveValues(stored, next)
    // A rule the command names opens the dialog, and acknowledging sends it again (D-047, D-142). The mark stays where
    // it was dropped until the answer.
    void gate.run(
      (acknowledged) => {
        setHeld(dropped)
        return edit.run(stored, values, acknowledged)
      },
      (result) => {
        setHeld(null)
        if (!result.ok) setFailure(result.error)
      },
    )
  }

  return {
    movable: (leaveId) => {
      const stored = leaveOf(leaveId)
      return stored !== null && canMove(stored)
    },
    creatable: canCreate,
    props: {
      onChange: (next) => {
        setFailure(null)
        setDrag(next)
      },
      onDrop: drop,
      tone: toneOf(warnings),
      held,
    },
    card:
      drag === null || dates === null
        ? null
        : {
            creating: drag.markKey === null,
            soldier: soldierOf(drag.rowKey),
            dates,
            returnsToPending: move?.returnsToPending === true,
            warnings,
          },
    failure,
    clearFailure: () => {
      setFailure(null)
    },
    // Closing the dialog without sending again puts the mark back.
    gate: {
      ...gate,
      close: () => {
        gate.close()
        setHeld(null)
      },
    },
    isPending: edit.isPending,
  }
}
