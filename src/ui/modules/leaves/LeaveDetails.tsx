import type { AppError, Leave, LeaveTransition, LeaveType, LeaveTypeGroup, Soldier } from '@contracts'
import { t, type I18nKey } from '@i18n'
import {
  useTimezone,
  useLeave,
  useLeaveActions,
  useLeaveCreation,
  useLeaveTransition,
  useLeaveTypeGroups,
  useLeaveTypes,
  usePanel,
  useSoldiersWithArchived,
} from '@logic'
import { Check, Copy, Pencil, RotateCcw, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { formatInstant } from '../../patterns/dates'
import { Button } from '../../primitives/Button'
import { RuleGateDialog } from '../../patterns/rules/RuleGate'
import { useRuleGate } from '../../patterns/rules/ruleAnswer'
import { LeaveDuplicateForm } from './LeaveDuplicateForm'
import { LeaveEditForm } from './LeaveEditForm'
import { LeaveStepDialog, type ClosingStep } from './LeaveStepDialog'
import { LeaveThread } from './LeaveThread'
import { LeaveBadge, TypeMark } from './LeaveMarks'
import { leaveDatesText, leaveDaysText, personNames, typeNameOf } from './leaveText'

// One leave (D-119): what it is, what the actor may do with it now, and its thread. A step shows at once and is
// taken back when the command refuses; the refusal stays on screen, over the leave as it is stored.

const DETAIL_SEPARATOR = ' · '
const ACTION =
  'inline-flex min-h-tab cursor-pointer items-center justify-center gap-xs rounded-control px-md text-body font-semibold outline-focus outline-offset-2 data-disabled:cursor-default data-disabled:opacity-60 data-focus-visible:outline-2'

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
  const gate = useRuleGate()
  const [editing, setEditing] = useState<number | null>(null)
  const [duplicating, setDuplicating] = useState(false)
  const creation = useLeaveCreation(soldiers)
  const [asking, setAsking] = useState<ClosingStep | null>(null)
  const [failure, setFailure] = useState<AppError | null>(null)
  const nameOf = personNames(soldiers)
  const type = types.find((candidate) => candidate.id === leave.leave_type_id) ?? null
  const timezone = useTimezone()

  async function step(next: LeaveTransition) {
    setFailure(null)
    await gate.run(
      (acknowledged) => transition.run(leave, next, '', acknowledged),
      (result) => {
        if (!result.ok) setFailure(result.error)
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
            <AriaButton
              isDisabled={transition.isPending}
              className={`${ACTION} bg-action-solid text-on-action`}
              onPress={() => {
                void step('approve')
              }}
            >
              <Check aria-hidden size={14} />
              {t('leaves.approve')}
            </AriaButton>
          ) : null}
          {actions.reject ? (
            <AriaButton
              className={`${ACTION} border border-line bg-surface text-text`}
              onPress={() => {
                setAsking('reject')
              }}
            >
              <X aria-hidden size={14} />
              {t('leaves.reject')}
            </AriaButton>
          ) : null}
          {actions.reopen ? (
            <AriaButton
              className={`${ACTION} border border-line bg-surface text-text`}
              isDisabled={transition.isPending}
              onPress={() => {
                void step('reopen')
              }}
            >
              <RotateCcw aria-hidden size={14} />
              {t('leaves.reopen')}
            </AriaButton>
          ) : null}
          {actions.edit ? (
            <AriaButton
              className={`${ACTION} border border-line bg-surface text-text`}
              onPress={() => {
                setFailure(null)
                setEditing(0)
              }}
            >
              <Pencil aria-hidden size={14} />
              {t('leaves.edit')}
            </AriaButton>
          ) : null}
          {creation.duplicable.length > 0 ? (
            <AriaButton
              className={`${ACTION} border border-line bg-surface text-text`}
              onPress={() => {
                setFailure(null)
                setDuplicating(true)
              }}
            >
              <Copy aria-hidden size={14} />
              {t('leaves.duplicate')}
            </AriaButton>
          ) : null}
          {actions.cancel ? (
            <AriaButton
              className={`${ACTION} border border-line bg-surface text-text`}
              onPress={() => {
                setAsking('cancel')
              }}
            >
              {t('leaves.cancel')}
            </AriaButton>
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
