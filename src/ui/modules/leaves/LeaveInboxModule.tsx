import { PANEL_IDS } from '@config'
import type { AppError, Leave, LeaveType, SoldierId } from '@contracts'
import { t, type I18nKey } from '@i18n'
import {
  useClosedLeaves,
  useLeaveTransition,
  useLeaveTypes,
  usePanel,
  usePendingRequests,
  useSoldiersWithArchived,
  type Loaded,
} from '@logic'
import { useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { VirtualList } from '../../patterns/VirtualList'
import { Button } from '../../primitives/Button'
import { LeaveStepDialog } from './LeaveStepDialog'
import { StatusChip, TypeMark } from './LeaveMarks'
import { leaveDatesText, leaveDaysText, personNames, typeNameOf } from './leaveText'

// The requests inbox (D-120): the pending requests the actor may approve, with "approve" and "reject" on each row,
// and the closed ones, which the board does not draw. A row opens the leave's details.

const LINE_SEPARATOR = ' · '
const NO_ROWS: readonly never[] = []

function RequestRow({
  leave,
  type,
  name,
  onApprove,
  onReject,
}: {
  readonly leave: Leave
  readonly type: LeaveType | null
  readonly name: string
  /** NULL on a closed leave: it shows its status instead of the two steps. */
  readonly onApprove: (() => void) | null
  readonly onReject: (() => void) | null
}) {
  const panel = usePanel()
  return (
    <div className="flex items-center gap-sm border-b border-line py-xs">
      <AriaButton
        onPress={() => {
          panel.open(PANEL_IDS.leaves, { entity: leave.id })
        }}
        className="flex min-h-touch min-w-none flex-1 cursor-pointer items-center gap-sm rounded-control px-xs text-start outline-focus -outline-offset-2 data-focus-visible:outline-2 data-hovered:bg-inner"
      >
        <TypeMark type={type} />
        <span className="flex min-w-none flex-col gap-2xs">
          <span className="truncate text-name font-semibold">{name}</span>
          <span className="truncate text-micro text-text-muted tabular-nums">
            {[typeNameOf(type), leaveDatesText(leave), leaveDaysText(leave)].join(LINE_SEPARATOR)}
          </span>
        </span>
      </AriaButton>
      {onApprove === null || onReject === null ? (
        <StatusChip status={leave.status} />
      ) : (
        <>
          <Button onPress={onApprove}>{t('leaves.approve')}</Button>
          <Button onPress={onReject}>{t('leaves.reject')}</Button>
        </>
      )}
    </div>
  )
}

function RequestList({
  leaves,
  labelKey,
  emptyTitleKey,
  emptyBodyKey,
  steps,
}: {
  readonly leaves: Loaded<readonly Leave[]>
  readonly labelKey: I18nKey
  readonly emptyTitleKey: I18nKey
  readonly emptyBodyKey: I18nKey
  /** Whether rows offer "approve" and "reject". */
  readonly steps: boolean
}) {
  const soldiers = useSoldiersWithArchived()
  const types = useLeaveTypes()
  const transition = useLeaveTransition()
  const [rejecting, setRejecting] = useState<Leave | null>(null)
  const [failure, setFailure] = useState<AppError | null>(null)

  if (leaves.status === 'failed') return <FailureNotice error={leaves.error} />
  if (leaves.status === 'loading' || soldiers.status === 'loading' || types.status === 'loading') return <LoadingNotice />
  if (leaves.value.length === 0) return <EmptyNotice titleKey={emptyTitleKey} bodyKey={emptyBodyKey} />

  const nameOf = personNames(soldiers.status === 'ready' ? soldiers.value : NO_ROWS)
  const typeList = types.status === 'ready' ? types.value : NO_ROWS
  const typeOf = (leave: Leave) => typeList.find((type) => type.id === leave.leave_type_id) ?? null
  const soldierName = (id: SoldierId) => nameOf(id)

  async function approve(leave: Leave) {
    setFailure(null)
    const result = await transition.run(leave, 'approve')
    if (!result.ok) setFailure(result.error)
  }

  return (
    <div className="flex flex-col gap-md">
      {failure === null ? null : <FailureNotice error={failure} />}
      <VirtualList
        labelKey={labelKey}
        items={leaves.value}
        keyOf={(leave) => leave.id}
        renderRow={(leave) => (
          <RequestRow
            leave={leave}
            type={typeOf(leave)}
            name={soldierName(leave.soldier_id)}
            onApprove={
              steps
                ? () => {
                    void approve(leave)
                  }
                : null
            }
            onReject={
              steps
                ? () => {
                    setFailure(null)
                    setRejecting(leave)
                  }
                : null
            }
          />
        )}
      />
      {rejecting === null ? null : (
        <LeaveStepDialog
          leave={rejecting}
          step="reject"
          onClose={() => {
            setRejecting(null)
          }}
        />
      )}
    </div>
  )
}

export function PendingRequestsModule() {
  return (
    <RequestList
      leaves={usePendingRequests()}
      labelKey="inbox.pendingLabel"
      emptyTitleKey="inbox.emptyPendingTitle"
      emptyBodyKey="inbox.emptyPendingBody"
      steps
    />
  )
}

export function ClosedLeavesModule() {
  return (
    <RequestList
      leaves={useClosedLeaves()}
      labelKey="inbox.closedLabel"
      emptyTitleKey="inbox.emptyClosedTitle"
      emptyBodyKey="inbox.emptyClosedBody"
      steps={false}
    />
  )
}
