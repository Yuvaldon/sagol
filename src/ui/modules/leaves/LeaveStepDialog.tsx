import type { AppError, Leave } from '@contracts'
import { useLeaveActions, useLeaveTransition } from '@logic'
import { useState } from 'react'
import { SmallDialog } from '../../patterns/Dialogs'
import { FailureNotice } from '../../patterns/Notices'
import { TextAreaField } from '../../primitives/TextAreaField'

// Rejecting or cancelling a leave asks first (D-119): the leave closes and leaves the board. The note is optional
// and becomes a shared comment, so its field shows only to who may write one.

export type ClosingStep = 'reject' | 'cancel'

const TITLES = { reject: 'leaves.rejectTitle', cancel: 'leaves.cancelTitle' } as const
const CONFIRMS = { reject: 'leaves.reject', cancel: 'leaves.cancel' } as const

export function LeaveStepDialog({
  leave,
  step,
  onClose,
}: {
  readonly leave: Leave
  readonly step: ClosingStep
  readonly onClose: () => void
}) {
  const actions = useLeaveActions(leave)
  const transition = useLeaveTransition()
  const [note, setNote] = useState('')
  const [failure, setFailure] = useState<AppError | null>(null)

  async function confirm() {
    setFailure(null)
    const result = await transition.run(leave, step, actions.comment.shared ? note : '')
    if (result.ok) onClose()
    else setFailure(result.error)
  }

  return (
    <SmallDialog
      titleKey={TITLES[step]}
      hintKey="leaves.closeHint"
      confirmKey={CONFIRMS[step]}
      isPending={transition.isPending}
      onCancel={onClose}
      onConfirm={() => {
        void confirm()
      }}
    >
      {actions.comment.shared ? <TextAreaField labelKey="leaves.note" name="note" value={note} onChange={setNote} error={null} /> : null}
      {failure === null ? null : <FailureNotice error={failure} />}
    </SmallDialog>
  )
}
