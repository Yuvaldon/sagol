import { PANEL_IDS } from '@config'
import { AvailabilityEffect, type Leave, type LeaveType } from '@contracts'
import { t } from '@i18n'
import { useLeaveTypes, useMyLeaves, useMyLeavesAccess, useMyNextDays, usePanel } from '@logic'
import { useRef } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { formatDate } from '../../patterns/dates'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { VirtualList } from '../../patterns/VirtualList'
import { StatusChip, TypeMark } from './LeaveMarks'
import { leaveDatesText, leaveDaysText, typeNameOf } from './leaveText'
import { MyRotationSection } from './MyRotationSection'

// "Mine" (D-265, D-167): the actor's next days, in or out, then their own leaves, the open ones and the history. A row
// opens the leave's details, where its steps and comments are (D-119). A new request is the strip's quick action.

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

/** My next days, today first: in, or out under the leave that keeps me out. */
function NextDays({ days, typeOf }: { readonly days: ReturnType<typeof useMyNextDays>; readonly typeOf: (leave: Leave['id']) => LeaveType | null }) {
  if (days === null || days.status === 'loading') return null
  // A failed read says so: an empty list would read as no days at all.
  if (days.status === 'failed') return <FailureNotice error={days.error} />
  return (
    <section className="flex flex-col gap-xs">
      <h3 className="text-label font-semibold text-text-muted">{t('myLeaves.nextDaysTitle')}</h3>
      <ul aria-label={t('myLeaves.nextDaysTitle')} className="flex flex-col">
        {days.value.map((day, index) => {
          const keeping = day.leaves.find((leave) => leave.counted) ?? null
          const out = day.status === AvailabilityEffect.enum.unavailable
          return (
            <li key={day.date} className="flex min-h-touch items-center gap-sm border-b border-line px-xs py-xs">
              <span className="flex min-w-none flex-1 flex-col gap-2xs">
                <span className="truncate text-name font-semibold">
                  {index === 0 ? t('myLeaves.today') : formatDate(day.date, 'weekdayShort')}
                </span>
                <span className="truncate text-micro text-text-muted tabular-nums">{formatDate(day.date, 'dayMonth')}</span>
              </span>
              <span className={out ? 'text-name font-semibold' : 'text-name text-text-muted'}>
                {out ? (keeping === null ? t('myLeaves.dayOut') : typeNameOf(typeOf(keeping.leave_id))) : t('myLeaves.dayIn')}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function MyLeavesModule() {
  const access = useMyLeavesAccess()
  const mine = useMyLeaves()
  const next = useMyNextDays()
  const types = useLeaveTypes()
  // "בקשות פתוחות" brings the open requests into view (D-350).
  const openRef = useRef<HTMLElement>(null)

  if (mine.status === 'failed') return <FailureNotice error={mine.error} />
  if (mine.status === 'loading' || types.status === 'loading') return <LoadingNotice />

  // A soldier who may not read the types still sees their leaves, under the fallback name.
  const typeList = types.status === 'ready' ? types.value : NO_TYPES
  const typeOf = (leave: Leave) => typeList.find((type) => type.id === leave.leave_type_id) ?? null
  const { open, history } = mine.value
  const all = [...open, ...history]
  const typeOfLeave = (id: Leave['id']) => {
    const leave = all.find((row) => row.id === id)
    return leave === undefined ? null : typeOf(leave)
  }
  const typeById = (id: LeaveType['id']) => typeList.find((type) => type.id === id) ?? null
  const top = (
    <>
      <MyRotationSection
        typeOf={typeById}
        onOpenRequests={() => {
          openRef.current?.scrollIntoView({ block: 'start' })
          openRef.current?.focus()
        }}
      />
      <NextDays days={next} typeOf={typeOfLeave} />
    </>
  )

  if (all.length === 0) {
    return (
      <div className="flex flex-col gap-md">
        {top}
        <EmptyNotice titleKey="myLeaves.emptyTitle" bodyKey={access?.create === true ? 'myLeaves.emptyCreate' : 'myLeaves.emptyReadOnly'} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-md">
      {top}
      <section ref={openRef} tabIndex={-1} className="flex flex-col gap-xs outline-none">
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
