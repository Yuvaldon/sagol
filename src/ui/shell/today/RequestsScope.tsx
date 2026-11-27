import type { AppError, Leave } from '@contracts'
import { t } from '@i18n'
import { useLeaveActions, useLeaveTransition } from '@logic'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { failureKey } from '../../errors/messages'
import { Toast, ToastRegion } from '../../kit/Toast'
import { LeaveStepDialog } from '../../modules/leaves/LeaveStepDialog'
import { RuleGateDialog } from '../../patterns/rules/RuleGate'
import { useRuleGate } from '../../patterns/rules/ruleAnswer'
import { useShellChrome } from '../chrome'
import { REQUEST_ATTRIBUTE, RequestActionsContext, type RequestActions } from './requestActions'

// The answers to the requests of "היום" and of its page (D-467). The rows only ask; what an answer needs lives here,
// above the lists, because a request that is answered leaves its list at once and the last one takes the card with
// it: the rule question of an approval (D-047), the note of a rejection (D-119), a refusal, and the toast that says
// what happened. The toast carries "ביטול" where the actor may take the step back: an approval by who approves, a
// rejection by who may reopen the request (D-063).

interface Done {
  readonly leave: Leave
  readonly step: 'approve' | 'reject'
}

type Shown = { readonly kind: 'done'; readonly done: Done } | { readonly kind: 'failed'; readonly error: AppError }

function rowButtons(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`[${REQUEST_ATTRIBUTE}]`)]
}

function DoneToast({ done, onClear, onFailure }: { readonly done: Done; readonly onClear: () => void; readonly onFailure: (error: AppError) => void }) {
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
        // The toast stays while its "ביטול" is on its way or asks about a rule: the question is its own.
        held={transition.isPending || gate.asked !== null}
        onDone={onClear}
      />
      <RuleGateDialog gate={gate} isPending={transition.isPending} />
    </>
  )
}

export function RequestsScope({ children }: { readonly children: ReactNode }) {
  const transition = useLeaveTransition()
  const gate = useRuleGate()
  const chrome = useShellChrome()
  const [rejecting, setRejecting] = useState<Leave | null>(null)
  const [shown, setShown] = useState<Shown | null>(null)
  /** The place among the rows of the request being answered: the row that takes it gets the keyboard. */
  const answered = useRef<number | null>(null)
  const clear = useCallback(() => {
    setShown(null)
  }, [])
  const fail = useCallback((error: AppError) => {
    setShown({ kind: 'failed', error })
  }, [])
  const { run } = gate
  const { run: send } = transition
  const note = useCallback((leave: Leave) => {
    answered.current = rowButtons().findIndex((button) => button.getAttribute(REQUEST_ATTRIBUTE) === leave.id)
  }, [])
  const busy = transition.isPending
  const approve = useCallback(
    (leave: Leave) => {
      // One answer at a time: a press while another is on its way is let go, and the button keeps the keyboard.
      if (busy) return
      setShown(null)
      note(leave)
      void run(
        (acknowledged) => send(leave, 'approve', '', acknowledged),
        (result) => {
          if (result.ok) setShown({ kind: 'done', done: { leave: result.value, step: 'approve' } })
          else fail(result.error)
        },
      )
    },
    [busy, run, send, note, fail],
  )
  const reject = useCallback(
    (leave: Leave) => {
      setShown(null)
      note(leave)
      setRejecting(leave)
    },
    [note],
  )
  const actions = useMemo<RequestActions>(() => ({ approve, reject }), [approve, reject])

  // The answered row is gone, and with it the button that held the keyboard: the row now in its place takes it, or
  // the one before it, or the page's heading. The keyboard is never left on nothing.
  const { focusHeading } = chrome
  useEffect(() => {
    if (shown?.kind !== 'done' || answered.current === null) return
    const place = answered.current
    answered.current = null
    const held = document.activeElement
    if (held !== null && held !== document.body && held.isConnected) return
    const rows = rowButtons()
    const next = rows[place] ?? rows[place - 1]
    if (next === undefined) focusHeading()
    else next.focus()
  }, [shown, focusHeading])

  return (
    <RequestActionsContext value={actions}>
      {/* Before the page in the document, so the toast's action is one step back from the page's heading. */}
      <ToastRegion>
        {shown === null ? null : shown.kind === 'failed' ? (
          // A refusal stays until it is read: it has no time of its own, and "סגירה" puts it away.
          <Toast message={t(failureKey(shown.error))} actionKey="common.close" onAction={clear} held onDone={clear} />
        ) : (
          <DoneToast key={shown.done.leave.id} done={shown.done} onClear={clear} onFailure={fail} />
        )}
      </ToastRegion>
      {children}
      <RuleGateDialog gate={gate} isPending={transition.isPending} />
      {rejecting === null ? null : (
        <LeaveStepDialog
          leave={rejecting}
          step="reject"
          onDone={(leave) => {
            setShown({ kind: 'done', done: { leave, step: 'reject' } })
          }}
          onClose={() => {
            setRejecting(null)
          }}
        />
      )}
    </RequestActionsContext>
  )
}
