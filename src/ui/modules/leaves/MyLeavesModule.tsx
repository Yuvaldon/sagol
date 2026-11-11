import { NEW_ENTITY, PANEL_IDS } from '@config'
import type { Leave, LeaveType } from '@contracts'
import { t } from '@i18n'
import { useLeaveTypes, useMyLeaves, useMyLeavesAccess, usePanel } from '@logic'
import { Plus } from 'lucide-react'
import { Button as AriaButton } from 'react-aria-components'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { VirtualList } from '../../patterns/VirtualList'
import { Button } from '../../primitives/Button'
import { StatusChip, TypeMark } from './LeaveMarks'
import { leaveDatesText, leaveDaysText, typeNameOf } from './leaveText'

// "My requests" (D-167): the actor's own leaves, the open ones and the history, and "new request" on top. A row opens
// the leave's details, where its steps and comments are (D-119).

const LINE_SEPARATOR = ' · '
const NO_TYPES: readonly never[] = []

function MyLeaveRow({ leave, type }: { readonly leave: Leave; readonly type: LeaveType | null }) {
  const panel = usePanel()
  return (
    <AriaButton
      onPress={() => {
        panel.open(PANEL_IDS.leaves, { entity: leave.id })
      }}
      className="flex min-h-touch w-full min-w-none cursor-pointer items-center gap-sm border-b border-line px-xs py-xs text-start outline-focus -outline-offset-2 data-focus-visible:outline-2 data-hovered:bg-inner"
    >
      <TypeMark type={type} />
      <span className="flex min-w-none flex-1 flex-col gap-2xs">
        <span className="truncate text-name font-semibold">{typeNameOf(type)}</span>
        <span className="truncate text-micro text-text-muted tabular-nums">
          {[leaveDatesText(leave), leaveDaysText(leave)].join(LINE_SEPARATOR)}
        </span>
      </span>
      <StatusChip status={leave.status} />
    </AriaButton>
  )
}

export function MyLeavesModule() {
  const panel = usePanel()
  const access = useMyLeavesAccess()
  const mine = useMyLeaves()
  const types = useLeaveTypes()

  if (mine.status === 'failed') return <FailureNotice error={mine.error} />
  if (mine.status === 'loading' || types.status === 'loading') return <LoadingNotice />

  // A soldier who may not read the types still sees their leaves, under the fallback name.
  const typeList = types.status === 'ready' ? types.value : NO_TYPES
  const typeOf = (leave: Leave) => typeList.find((type) => type.id === leave.leave_type_id) ?? null
  const { open, history } = mine.value
  const newRequest =
    access?.create === true ? (
      <div>
        <Button
          variant="primary"
          onPress={() => {
            panel.open(PANEL_IDS.leaves, { entity: NEW_ENTITY })
          }}
        >
          <Plus aria-hidden size={14} />
          {t('myLeaves.new')}
        </Button>
      </div>
    ) : null

  if (open.length === 0 && history.length === 0) {
    return (
      <EmptyNotice titleKey="myLeaves.emptyTitle" bodyKey={access?.create === true ? 'myLeaves.emptyBody' : 'myLeaves.emptyReadOnly'}>
        {newRequest}
      </EmptyNotice>
    )
  }

  return (
    <div className="flex flex-col gap-md">
      {newRequest}
      <section className="flex flex-col gap-xs">
        <h3 className="text-label font-semibold text-text-muted">{t('myLeaves.openTitle')}</h3>
        {open.length === 0 ? (
          <p className="text-name text-text-muted">{t('myLeaves.emptyOpen')}</p>
        ) : (
          <ul aria-label={t('myLeaves.openTitle')} className="flex flex-col">
            {open.map((leave) => (
              <li key={leave.id}>
                <MyLeaveRow leave={leave} type={typeOf(leave)} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="flex flex-col gap-xs">
        <h3 className="text-label font-semibold text-text-muted">{t('myLeaves.historyTitle')}</h3>
        {history.length === 0 ? (
          <p className="text-name text-text-muted">{t('myLeaves.emptyHistory')}</p>
        ) : (
          <VirtualList
            labelKey="myLeaves.historyTitle"
            items={history}
            keyOf={(leave) => leave.id}
            renderRow={(leave) => <MyLeaveRow leave={leave} type={typeOf(leave)} />}
          />
        )}
      </section>
    </div>
  )
}
