import type { AppError } from '@contracts'
import { t } from '@i18n'
import { useLeaveActions, useLeaveTransition } from '@logic'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { failureKey } from '../../errors/messages'
import { Toast } from '../../kit/Toast'
import { RuleGateDialog } from '../../patterns/rules/RuleGate'
import { useRuleGate } from '../../patterns/rules/ruleAnswer'
import { RequestDoneContext, type RequestDone } from './requestDoneContext'

// What just happened to a request (D-467): one toast over "היום" and its page of requests. It outlives the row that
// was answered, which leaves its list with the answer, and it carries "ביטול" where the actor may take the step back:
// an approval by who approves, a rejection by who may reopen the request (D-063).

function DoneToast({ done, onClear, onFailure }: { readonly done: RequestDone; readonly onClear: () => void; readonly onFailure: (error: AppError) => void }) {
  const actions = useLeaveActions(done.leave)
  const transition = useLeaveTransition()
  const gate = useRuleGate()
  const undo = async () => {
    // Taking a step back can break a rule as the step itself can (D-073): the same dialog asks.
    await gate.run(
      (acknowledged) => transition.run(done.leave, 'reopen', '', acknowledged),
      (result) => {
        if (result.ok) onClear()
        else onFailure(result.error)
      },
    )
  }
  return (
    <>
      <Toast
        message={t(done.step === 'approve' ? 'today.approved' : 'today.rejected')}
        {...(actions.reopen
          ? {
              actionKey: 'common.cancel' as const,
              onAction: () => {
                void undo()
              },
            }
          : {})}
        onDone={onClear}
      />
      <RuleGateDialog gate={gate} isPending={transition.isPending} />
    </>
  )
}

type Shown = { readonly kind: 'done'; readonly done: RequestDone } | { readonly kind: 'failed'; readonly error: AppError }

export function RequestDoneScope({ children }: { readonly children: ReactNode }) {
  const [shown, setShown] = useState<Shown | null>(null)
  const clear = useCallback(() => {
    setShown(null)
  }, [])
  const report = useCallback((done: RequestDone) => {
    setShown({ kind: 'done', done })
  }, [])
  const fail = useCallback((error: AppError) => {
    setShown({ kind: 'failed', error })
  }, [])
  const toast = useMemo(() => {
    if (shown === null) return null
    // A step back that was refused says so in the same place, and offers nothing more.
    if (shown.kind === 'failed') return <Toast message={t(failureKey(shown.error))} onDone={clear} />
    return <DoneToast key={shown.done.leave.id} done={shown.done} onClear={clear} onFailure={fail} />
  }, [shown, clear, fail])
  return (
    <RequestDoneContext value={report}>
      {children}
      {toast}
    </RequestDoneContext>
  )
}
