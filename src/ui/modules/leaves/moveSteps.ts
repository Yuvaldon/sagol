import type { Loaded, RoundMove } from '@logic'

// What the leave card offers on a leave of the round (D-481): a moved one is approved as a move or kept at its original
// dates, never rejected; one whose thread is still read, or failed, is not rejected either, so a move is never
// rejected by accident. Keeping the original dates edits the leave, so it needs the edit as well as the approval.

export interface MoveSteps {
  readonly reject: boolean
  readonly keepOriginal: boolean
  /** The approval is "אישור ההזזה". */
  readonly approvesMove: boolean
}

export function moveSteps(
  round: boolean,
  move: Loaded<RoundMove | null>,
  actions: { readonly approve: boolean; readonly reject: boolean; readonly edit: boolean },
): MoveSteps {
  const moved = move.status === 'ready' ? move.value : null
  return {
    reject: actions.reject && (!round || (move.status === 'ready' && moved === null)),
    keepOriginal: moved !== null && actions.approve && actions.edit,
    approvesMove: moved !== null,
  }
}
