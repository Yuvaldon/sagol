import { PANEL_IDS } from '@config'
import type { Leave, LeaveType } from '@contracts'
import { useClosedLeaves, useLeaveTypes, usePanel, useSoldiersWithArchived } from '@logic'
import { Button as AriaButton } from 'react-aria-components'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { VirtualList } from '../../patterns/VirtualList'
import { LeaveBadge, TypeMark } from './LeaveMarks'
import { leaveDatesText, leaveDaysText, personNames, typeNameOf } from './leaveText'

// The requests that closed (D-120), which the board does not draw: each with its status, and a row opens the leave,
// where it can be reopened. What waits for the actor is on "היום" and on its page of requests (D-467, D-474).

const LINE_SEPARATOR = ' · '
const NO_ROWS: readonly never[] = []

function ClosedRow({ leave, type, name }: { readonly leave: Leave; readonly type: LeaveType | null; readonly name: string }) {
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
      <LeaveBadge status={leave.status} />
    </div>
  )
}

export function ClosedLeavesModule() {
  const leaves = useClosedLeaves()
  const soldiers = useSoldiersWithArchived()
  const types = useLeaveTypes()
  if (leaves.status === 'failed') return <FailureNotice error={leaves.error} />
  if (leaves.status === 'loading' || soldiers.status === 'loading' || types.status === 'loading') return <LoadingNotice />
  if (leaves.value.length === 0) return <EmptyNotice titleKey="inbox.emptyClosedTitle" bodyKey="inbox.emptyClosedBody" />
  const nameOf = personNames(soldiers.status === 'ready' ? soldiers.value : NO_ROWS)
  const typeList = types.status === 'ready' ? types.value : NO_ROWS
  return (
    <VirtualList
      labelKey="inbox.closedLabel"
      items={leaves.value}
      keyOf={(leave) => leave.id}
      renderRow={(leave) => (
        <ClosedRow leave={leave} type={typeList.find((type) => type.id === leave.leave_type_id) ?? null} name={nameOf(leave.soldier_id)} />
      )}
    />
  )
}
