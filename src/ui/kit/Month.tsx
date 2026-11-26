import type { CalendarDate } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button as AriaButton } from 'react-aria-components'
import { formatDate } from '../patterns/dates'
import { DAY_STATE_KEYS, type StripDay } from './dayState'

// The month the strip opens into (D-454): seven columns, the month's name between two arrows. Where days can be
// chosen each day is a button, pressed while it is inside the selection; otherwise the month only shows.

const WORD = ' '
const FOCUS = 'outline-focus outline-offset-2 data-focus-visible:outline-2'
const ARROW = `inline-flex size-touch cursor-pointer items-center justify-center rounded-full text-text-muted data-disabled:cursor-default data-disabled:opacity-60 ${FOCUS}`

const STATES = {
  base: '',
  away: 'bg-time-approved',
  pending: 'border border-dashed border-status-pending-line bg-time-pending',
} as const

export interface MonthProps {
  /** A day of the month shown: it names the month. */
  readonly month: CalendarDate
  readonly weeks: readonly (readonly (StripDay | null)[])[]
  readonly today: CalendarDate
  readonly previousKey: I18nKey
  readonly nextKey: I18nKey
  /** NULL where the month before cannot be shown. */
  readonly onPrevious: (() => void) | null
  readonly onNext: () => void
  /** NULL where days are not chosen here. */
  readonly select: {
    readonly covers: (day: CalendarDate) => boolean
    readonly allows: (day: CalendarDate) => boolean
    readonly onDay: (day: CalendarDate) => void
  } | null
}

function nameOf(day: StripDay): string {
  return [formatDate(day.date, 'full'), t(DAY_STATE_KEYS[day.state])].join(WORD)
}

function DayCell({ day, today, select }: { readonly day: StripDay; readonly today: CalendarDate; readonly select: MonthProps['select'] }) {
  const chosen = select?.covers(day.date) === true
  const look = `flex size-touch items-center justify-center rounded-full text-small tabular-nums ${
    chosen ? 'bg-action-solid font-bold text-on-action' : `${STATES[day.state]} ${day.date === today ? 'font-bold text-text ring-2 ring-action-solid' : 'text-text'}`
  }`
  const number = formatDate(day.date, 'day')
  if (select === null) {
    return (
      <span className={look}>
        <span aria-hidden>{number}</span>
        <span className="sr-only">{nameOf(day)}</span>
      </span>
    )
  }
  return (
    <AriaButton
      aria-pressed={chosen}
      isDisabled={!select.allows(day.date)}
      onPress={() => {
        select.onDay(day.date)
      }}
      className={`${look} cursor-pointer data-disabled:cursor-default data-disabled:text-past ${FOCUS}`}
    >
      <span aria-hidden>{number}</span>
      <span className="sr-only">{nameOf(day)}</span>
    </AriaButton>
  )
}

export function Month({ month, weeks, today, previousKey, nextKey, onPrevious, onNext, select }: MonthProps) {
  const header = weeks.find((week) => week.every((day) => day !== null))
  return (
    <div className="flex flex-col gap-sm">
      <div className="flex items-center justify-between">
        <AriaButton aria-label={t(previousKey)} isDisabled={onPrevious === null} onPress={() => {
            onPrevious?.()
          }} className={ARROW}>
          <ChevronRight aria-hidden size={18} />
        </AriaButton>
        <p aria-live="polite" className="text-body font-bold">
          {formatDate(month, 'monthYear')}
        </p>
        <AriaButton aria-label={t(nextKey)} onPress={onNext} className={ARROW}>
          <ChevronLeft aria-hidden size={18} />
        </AriaButton>
      </div>
      <div role="grid" aria-label={formatDate(month, 'monthYear')} className="flex flex-col gap-xs">
        <div role="row" className="grid grid-cols-7 justify-items-center">
          {header?.map((day) =>
            day === null ? null : (
              <span key={day.date} role="columnheader" className="text-caption text-text-muted">
                <span aria-hidden>{formatDate(day.date, 'weekdayNarrow')}</span>
                <span className="sr-only">{formatDate(day.date, 'weekdayLong')}</span>
              </span>
            ),
          )}
        </div>
        {weeks.map((week, index) => (
          // A month's weeks never reorder, so their place is their key.
          <div key={index} role="row" className="grid grid-cols-7 justify-items-center">
            {week.map((day, column) =>
              day === null ? (
                <span key={column} role="gridcell" />
              ) : (
                <span key={day.date} role="gridcell">
                  <DayCell day={day} today={today} select={select} />
                </span>
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
