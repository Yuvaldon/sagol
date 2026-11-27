import type { CalendarDate } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { formatDate } from '../patterns/dates'
import { DAY_STATE_KEYS, type StripDay } from './dayState'

// The month the strip opens into (D-454): seven columns, the month's name between two arrows. Where days can be
// chosen it is a grid: one day takes the Tab key, the arrow keys move between the days (and on to the next month at
// an edge), Home and End reach the week's ends, Page Up and Page Down change the month, and Enter or Space marks the
// day. A day that cannot be chosen is still reached and read, and says it is unavailable. Where days are not chosen
// the month is a table that only shows.

const WORD = ' '
const WEEK = 7
const FOCUS = 'outline-focus outline-offset-2 data-focus-visible:outline-2'
const ARROW = `inline-flex size-touch cursor-pointer items-center justify-center rounded-full text-text-muted aria-disabled:cursor-default aria-disabled:opacity-60 ${FOCUS}`
const DAY_FOCUS = 'outline-focus outline-offset-2 focus-visible:outline-2'

const STATES = {
  base: '',
  // The leave round is not drawn in the month: it is the regular state (the handoff's board spec, 1.10).
  round: '',
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

function lookOf(day: StripDay, today: CalendarDate, chosen: boolean): string {
  return `flex size-touch items-center justify-center rounded-full text-small tabular-nums ${
    chosen ? 'bg-action-solid font-bold text-on-action' : `${STATES[day.state]} ${day.date === today ? 'font-bold text-text ring-2 ring-action-solid' : 'text-text'}`
  }`
}

/** Where a key moves the day in sight, in days; the inline direction follows the page (right to left). */
function stepOf(key: string, column: number, rtl: boolean): number | null {
  const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
  const backward = rtl ? 'ArrowRight' : 'ArrowLeft'
  if (key === forward) return 1
  if (key === backward) return -1
  if (key === 'ArrowDown') return WEEK
  if (key === 'ArrowUp') return -WEEK
  if (key === 'Home') return -column
  if (key === 'End') return WEEK - 1 - column
  return null
}

function Grid({ weeks, today, select, onPrevious, onNext }: Pick<MonthProps, 'weeks' | 'today' | 'onPrevious' | 'onNext'> & { readonly select: NonNullable<MonthProps['select']> }) {
  const days = weeks.flat().filter((day) => day !== null)
  const cells = useRef(new Map<CalendarDate, HTMLElement>())
  // The day that takes the Tab key: today while it is in the month, the month's first day otherwise.
  const [active, setActive] = useState<CalendarDate | null>(null)
  // After a key carried the keyboard past the month's edge: which end of the new month takes it.
  const entering = useRef<'first' | 'last' | null>(null)
  const first = days[0]?.date
  const last = days.at(-1)?.date
  const tabStop = active !== null && days.some((day) => day.date === active) ? active : (days.find((day) => day.date === today)?.date ?? first ?? null)
  useEffect(() => {
    if (entering.current === null) return
    const target = entering.current === 'first' ? first : last
    entering.current = null
    if (target === undefined) return
    setActive(target)
    cells.current.get(target)?.focus()
  }, [first, last])

  const move = (event: KeyboardEvent<HTMLElement>, index: number, column: number) => {
    if (event.key === 'PageDown' || event.key === 'PageUp') {
      event.preventDefault()
      const leave = event.key === 'PageDown' ? onNext : onPrevious
      if (leave === null) return
      entering.current = 'first'
      leave()
      return
    }
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl'
    const step = stepOf(event.key, column, rtl)
    if (step === null) return
    event.preventDefault()
    const target = days[index + step]
    if (target !== undefined) {
      setActive(target.date)
      cells.current.get(target.date)?.focus()
      return
    }
    // Past the month's edge the next month, or the one before where there is one, takes the keyboard.
    if (step > 0) {
      entering.current = 'first'
      onNext()
    } else if (onPrevious !== null) {
      entering.current = 'last'
      onPrevious()
    }
  }

  return weeks.map((week, row) => (
    // A month's weeks never reorder, so their place is their key.
    <div key={row} role="row" className="grid grid-cols-7 justify-items-center">
      {week.map((day, column) => {
        if (day === null) return <span key={column} role="gridcell" />
        const chosen = select.covers(day.date)
        const allowed = select.allows(day.date)
        const index = days.indexOf(day)
        return (
          <div
            key={day.date}
            ref={(element) => {
              if (element === null) cells.current.delete(day.date)
              else cells.current.set(day.date, element)
            }}
            role="gridcell"
            tabIndex={day.date === tabStop ? 0 : -1}
            aria-selected={chosen}
            aria-disabled={allowed ? undefined : true}
            onClick={() => {
              setActive(day.date)
              if (allowed) select.onDay(day.date)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                if (allowed) select.onDay(day.date)
                return
              }
              move(event, index, column)
            }}
            className={`${lookOf(day, today, chosen)} ${allowed ? 'cursor-pointer' : 'text-past'} ${DAY_FOCUS}`}
          >
            <span aria-hidden>{formatDate(day.date, 'day')}</span>
            <span className="sr-only">{nameOf(day)}</span>
          </div>
        )
      })}
    </div>
  ))
}

function Table({ weeks, today }: Pick<MonthProps, 'weeks' | 'today'>) {
  return weeks.map((week, row) => (
    <div key={row} role="row" className="grid grid-cols-7 justify-items-center">
      {week.map((day, column) =>
        day === null ? (
          <span key={column} role="cell" />
        ) : (
          <span key={day.date} role="cell" className={lookOf(day, today, false)}>
            <span aria-hidden>{formatDate(day.date, 'day')}</span>
            <span className="sr-only">{nameOf(day)}</span>
          </span>
        ),
      )}
    </div>
  ))
}

export function Month({ month, weeks, today, previousKey, nextKey, onPrevious, onNext, select }: MonthProps) {
  const header = weeks.find((week) => week.every((day) => day !== null))
  return (
    <div className="flex flex-col gap-sm">
      <div className="flex items-center justify-between">
        {/* It stays in reach of the keyboard while it has nowhere to go, so focus is never left on nothing. */}
        <AriaButton
          aria-label={t(previousKey)}
          {...(onPrevious === null ? { 'aria-disabled': true } : {})}
          onPress={() => {
            onPrevious?.()
          }}
          className={ARROW}
        >
          <ChevronRight aria-hidden size={18} />
        </AriaButton>
        <p aria-live="polite" className="text-body font-bold">
          {formatDate(month, 'monthYear')}
        </p>
        <AriaButton aria-label={t(nextKey)} onPress={onNext} className={ARROW}>
          <ChevronLeft aria-hidden size={18} />
        </AriaButton>
      </div>
      <div role={select === null ? 'table' : 'grid'} aria-label={formatDate(month, 'monthYear')} className="flex flex-col gap-xs">
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
        {select === null ? <Table weeks={weeks} today={today} /> : <Grid weeks={weeks} today={today} select={select} onPrevious={onPrevious} onNext={onNext} />}
      </div>
    </div>
  )
}
