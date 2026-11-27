import type { AppError, Leave, LeaveTransition, LeaveType, LeaveTypeGroup, Soldier } from '@contracts'
import { t, type I18nKey } from '@i18n'
import {
  movedLeaveValues,
  useEditLeave,
  useTimezone,
  useLeave,
  useLeaveActions,
  useLeaveMove,
  useLeaveCreation,
  useLeaveTransition,
  useLeaveTypeGroups,
  useLeaveTypes,
  usePanel,
  useSoldiersWithArchived,
} from '@logic'
import { ArrowLeftRight, Check, Copy, History, Pencil, RotateCcw, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useFullStop } from '../../kit/drawerStop'
import { FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { formatInstant } from '../../patterns/dates'
import { Button } from '../../primitives/Button'
import { RuleGateDialog } from '../../patterns/rules/RuleGate'
import { useRuleGate } from '../../patterns/rules/ruleAnswer'
import { LeaveDuplicateForm } from './LeaveDuplicateForm'
import { moveSteps } from './moveSteps'
import { LeaveEditForm } from './LeaveEditForm'
import { LeaveStepDialog, type ClosingStep } from './LeaveStepDialog'
import { LeaveThread } from './LeaveThread'
import { LeaveBadge, TypeMark } from './LeaveMarks'
import { leaveDatesText, leaveDaysText, personNames, typeNameOf } from './leaveText'

// One leave (D-119): what it is, what the actor may do with it now, and its thread. A step shows at once and is
// taken back when the command refuses; the refusal stays on screen, over the leave as it is stored. A leave of the
// round is moved by "בקשת הזזה"; once moved it says from where to where, and its approver approves the move or keeps
// the original dates, never rejects it (the handoff's `02`, "Moving a leave out of the leave round"; OI-394).

const DETAIL_SEPARATOR = ' · '

function Detail({ labelKey, children }: { readonly labelKey: I18nKey; readonly children: ReactNode }) {
  return (
    <div className="flex flex-col gap-xs">
      <dt className="text-label font-semibold text-text-muted">{t(labelKey)}</dt>
      <dd className="text-control">{children}</dd>
    </div>
  )
}

function LeaveView({
  leave,
  soldiers,
  groups,
  types,
}: {
  readonly leave: Leave
  readonly soldiers: readonly Soldier[]
  readonly groups: readonly LeaveTypeGroup[]
  readonly types: readonly LeaveType[]
}) {
  const actions = useLeaveActions(leave)
  const transition = useLeaveTransition()
  const edit = useEditLeave()
  const move = useLeaveMove(leave)
  const moved = move.status === 'ready' ? move.value : null
  const round = leave.batch_id !== null
  const steps = moveSteps(round, move, actions)
  const gate = useRuleGate()
  const [editing, setEditing] = useState<number | null>(null)
  const [duplicating, setDuplicating] = useState(false)
  const creation = useLeaveCreation(soldiers)
  const [asking, setAsking] = useState<ClosingStep | null>(null)
  const [failure, setFailure] = useState<AppError | null>(null)
  const nameOf = personNames(soldiers)
  const type = types.find((candidate) => candidate.id === leave.leave_type_id) ?? null
  const timezone = useTimezone()
  // A form needs the room: the drawer grows to its full stop for it.
  const grow = useFullStop()

  async function step(next: LeaveTransition) {
    setFailure(null)
    await gate.run(
      (acknowledged) => transition.run(leave, next, '', acknowledged),
      (result) => {
        if (!result.ok) setFailure(result.error)
      },
    )
  }

  /** The original dates back from the thread, then the approval: two steps the actor may take, in one press. */
  async function keepOriginal() {
    if (moved === null) return
    setFailure(null)
    await gate.run(
      (acknowledged) => edit.run(leave, movedLeaveValues(leave, moved.from), acknowledged),
      async (result) => {
        if (!result.ok) {
          setFailure(result.error)
          return
        }
        if (result.value.status !== 'pending') return
        await gate.run(
          (acknowledged) => transition.run(result.value, 'approve', '', acknowledged),
          (approved) => {
            if (!approved.ok) setFailure(approved.error)
          },
        )
      },
    )
  }

  if (editing !== null) {
    return (
      <LeaveEditForm
        key={editing}
        leave={leave}
        groups={groups}
        types={types}
        onDone={() => {
          setEditing(null)
        }}
        onReload={() => {
          setEditing((count) => (count ?? 0) + 1)
        }}
      />
    )
  }

  if (duplicating) {
    return (
      <LeaveDuplicateForm
        leave={leave}
        soldiers={creation.duplicable}
        canApprove={creation.canApprove}
        onDone={() => {
          setDuplicating(false)
        }}
      />
    )
  }

  const reviewed =
    leave.reviewed_by === null
      ? null
      : [nameOf(leave.reviewed_by), ...(leave.reviewed_at === null || timezone === null ? [] : [formatInstant(leave.reviewed_at, timezone)])].join(
          DETAIL_SEPARATOR,
        )

  return (
    <div className="flex flex-col gap-xl">
      <section aria-label={t('leaves.detailsLabel')} className="flex flex-col gap-md">
        {/* The card of the leave (D-454): its days large, then its type and how many days; the drawer names the type. */}
        <div className="flex flex-col gap-md rounded-card bg-surface p-lg">
          <div className="flex items-start justify-between gap-sm">
            <div className="flex min-w-none flex-col gap-2xs">
              <p className="text-title font-bold tracking-tight tabular-nums">{leaveDatesText(leave)}</p>
              <p className="flex items-center gap-xs text-body text-text-muted">
                <TypeMark type={type} />
                <span className="truncate tabular-nums">{[typeNameOf(type), leaveDaysText(leave)].join(DETAIL_SEPARATOR)}</span>
              </p>
            </div>
            <LeaveBadge status={leave.status} />
          </div>
          {moved === null ? null : (
            <p className="text-body font-semibold text-status-pending-text tabular-nums">
              {[t('leaves.movedFrom'), leaveDatesText(moved.from), ' ', t('leaves.movedTo'), leaveDatesText(moved.to)].join('')}
            </p>
          )}
          <dl className="flex flex-col gap-md">
            <Detail labelKey="leaves.soldier">{nameOf(leave.soldier_id)}</Detail>
            {leave.reason === null ? null : <Detail labelKey="leaves.reason">{leave.reason}</Detail>}
            {reviewed === null ? null : <Detail labelKey="leaves.reviewedBy">{reviewed}</Detail>}
          </dl>
        </div>
        {failure === null ? null : <FailureNotice error={failure} />}
        {/* What can be done with the leave, each with the same weight (D-454); approving alone is the filled one. */}
        <div role="group" aria-label={t('leaves.actionsLabel')} className="grid grid-cols-2 gap-sm empty:hidden">
          {actions.approve ? (
            <Button
              variant="tileSolid"
              isDisabled={transition.isPending}
              onPress={() => {
                void step('approve')
              }}
            >
              <Check aria-hidden size={14} />
              {t(steps.approvesMove ? 'leaves.approveMove' : 'leaves.approve')}
            </Button>
          ) : null}
          {steps.keepOriginal ? (
            <Button
              variant="tile"
              isDisabled={transition.isPending || edit.isPending}
              onPress={() => {
                void keepOriginal()
              }}
            >
              <History aria-hidden size={14} />
              {t('leaves.keepOriginal')}
            </Button>
          ) : null}
          {steps.reject ? (
            <Button
              variant="tile"
              onPress={() => {
                setAsking('reject')
              }}
            >
              <X aria-hidden size={14} />
              {t('leaves.reject')}
            </Button>
          ) : null}
          {actions.reopen ? (
            <Button
              variant="tile"
              isDisabled={transition.isPending}
              onPress={() => {
                void step('reopen')
              }}
            >
              <RotateCcw aria-hidden size={14} />
              {t('leaves.reopen')}
            </Button>
          ) : null}
          {actions.edit ? (
            <Button
              variant="tile"
              onPress={() => {
                setFailure(null)
                grow()
                setEditing(0)
              }}
            >
              {round ? <ArrowLeftRight aria-hidden size={14} /> : <Pencil aria-hidden size={14} />}
              {t(round ? 'leaves.requestMove' : 'leaves.edit')}
            </Button>
          ) : null}
          {creation.duplicable.length > 0 ? (
            <Button
              variant="tile"
              onPress={() => {
                setFailure(null)
                grow()
                setDuplicating(true)
              }}
            >
              <Copy aria-hidden size={14} />
              {t('leaves.duplicate')}
            </Button>
          ) : null}
          {actions.cancel ? (
            <Button
              variant="tile"
              onPress={() => {
                setAsking('cancel')
              }}
            >
              {t('leaves.cancel')}
            </Button>
          ) : null}
        </div>
      </section>
      <LeaveThread leave={leave} types={types} nameOf={nameOf} />
      <RuleGateDialog gate={gate} isPending={transition.isPending} />
      {asking === null ? null : (
        <LeaveStepDialog
          leave={leave}
          step={asking}
          onClose={() => {
            setAsking(null)
          }}
        />
      )}
    </div>
  )
}

const NO_ROWS: readonly never[] = []

/** The `leaves` panel on a leave's id. An id that is no leave, or one the actor cannot see, says "not found". */
export function LeaveDetails({ id }: { readonly id: string }) {
  const panel = usePanel()
  const leave = useLeave(id)
  const soldiers = useSoldiersWithArchived()
  const types = useLeaveTypes()
  const groups = useLeaveTypeGroups()

  if (leave.status === 'failed') {
    if (leave.error.code !== 'not_found') return <FailureNotice error={leave.error} />
    return (
      <div className="flex flex-col items-center gap-md py-xl text-center">
        <p className="text-name text-text-muted">{t('leaves.notFound')}</p>
        <Button onPress={panel.close}>{t('common.close')}</Button>
      </div>
    )
  }
  if (leave.status === 'loading' || soldiers.status === 'loading' || types.status === 'loading' || groups.status === 'loading') {
    return <LoadingNotice />
  }
  // Names and types are decoration here: whoever may not read them still reads the leave.
  return (
    <LeaveView
      leave={leave.value}
      soldiers={soldiers.status === 'ready' ? soldiers.value : NO_ROWS}
      groups={groups.status === 'ready' ? groups.value : NO_ROWS}
      types={types.status === 'ready' ? types.value : NO_ROWS}
    />
  )
}
