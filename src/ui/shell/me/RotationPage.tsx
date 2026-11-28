import { NEW_ENTITY, PANEL_IDS } from '@config'
import type { CalendarDate } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { isBeforeDay, monthSpan, selectDay, selectionCovers, useMyDays, useMyRotation, usePanel, useSession, weeksOf, type DaySelection } from '@logic'
import { useMemo, useState } from 'react'
import { Month } from '../../kit/Month'
import { Tray } from '../../kit/Tray'
import { leaveDaysText } from '../../modules/leaves/leaveText'
import { FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { PageFrame } from '../PageFrame'
import { PageTop } from '../manage/PageTop'

// "הסבב שלי" (the handoff's My rotation, D-488): the summary of the soldier's rotation (days on base and at home so far,
// and their requests approved), then their month, which also goes back to past months, with the day selection of
// "היום": days chosen become a request, for who may make one now (D-458). The legend says what the month draws.

const SEPARATOR = ' · '

function Figure({ value, labelKey }: { readonly value: number; readonly labelKey: I18nKey }) {
  return (
    <div className="flex flex-col">
      <dt className="order-2 text-small text-text-muted">{t(labelKey)}</dt>
      <dd className="order-1 text-display font-bold tabular-nums">{value}</dd>
    </div>
  )
}

function Summary() {
  const mine = useMyRotation()
  if (mine === null) return <p className="text-body text-text-muted">{t('me.noRotation')}</p>
  if (mine.status === 'failed') return <FailureNotice error={mine.error} />
  if (mine.status === 'loading') return <LoadingNotice />
  const { figures } = mine.value
  return (
    <dl aria-label={t('me.rotationSummary')} className="grid grid-cols-3 gap-md">
      <Figure value={figures.base.sofar} labelKey="myRotation.baseDays" />
      <Figure value={figures.home.sofar} labelKey="myRotation.homeDays" />
      <Figure value={figures.approvedRequests} labelKey="me.approvedRequests" />
    </dl>
  )
}

/** What the month draws: a day away, and a request that waits (the board's month draws no leave round, `03` §1.10). */
function Legend() {
  return (
    <ul aria-label={t('me.legend')} className="flex flex-wrap gap-lg text-small text-text-muted">
      <li className="flex items-center gap-xs">
        <span aria-hidden className="h-sm w-xl rounded-full bg-time-approved" />
        {t('me.legendAway')}
      </li>
      <li className="flex items-center gap-xs">
        <span aria-hidden className="h-sm w-xl rounded-full border border-dashed border-status-pending-line bg-time-pending" />
        {t('me.legendPending')}
      </li>
    </ul>
  )
}

function MonthOf({
  today,
  selection,
  onSelect,
}: {
  readonly today: CalendarDate
  readonly selection: DaySelection | null
  readonly onSelect: ((selection: DaySelection | null) => void) | null
}) {
  const [offset, setOffset] = useState(0)
  const span = useMemo(() => monthSpan(today, offset), [today, offset])
  const days = useMyDays(span.first, span.days)
  if (days === null) return null
  if (days.status === 'failed') return <FailureNotice error={days.error} />
  if (days.status !== 'ready') return <LoadingNotice />
  return (
    <Month
      month={span.first}
      weeks={weeksOf(days.value)}
      today={today}
      previousKey="today.previousMonth"
      nextKey="today.nextMonth"
      onPrevious={() => {
        setOffset(offset - 1)
      }}
      onNext={() => {
        setOffset(offset + 1)
      }}
      select={
        onSelect === null
          ? null
          : {
              covers: (day) => selectionCovers(selection, day),
              allows: (day) => !isBeforeDay(day, today),
              onDay: (day) => {
                onSelect(selectDay(selection, day))
              },
            }
      }
    />
  )
}

export function RotationPage({ requests, today }: { readonly requests: boolean; readonly today: CalendarDate | null }) {
  const panel = usePanel()
  const session = useSession()
  const mine = useMyRotation()
  const own = session.status === 'ready' && session.value.status === 'linked' ? session.value.soldier_id : null
  const [selection, setSelection] = useState<DaySelection | null>(null)
  const tray =
    selection === null || own === null ? null : (
      <Tray
        labelKey="today.selection"
        action={[t('today.requestDays'), leaveDaysText({ start_date: selection.start, end_date: selection.end })].join(SEPARATOR)}
        onAction={() => {
          panel.open(PANEL_IDS.leaves, { entity: NEW_ENTITY, draft: { soldier_id: own, start_date: selection.start, end_date: selection.end } })
          setSelection(null)
        }}
        clearKey="today.clearSelection"
        onClear={() => {
          setSelection(null)
        }}
      />
    )
  return (
    <PageFrame tray={tray}>
      <PageTop titleKey="me.myRotation" detail={mine?.status === 'ready' ? mine.value.rotation.name : null} />
      <Summary />
      {today === null ? null : <MonthOf today={today} selection={selection} onSelect={requests && own !== null ? setSelection : null} />}
      <Legend />
    </PageFrame>
  )
}
