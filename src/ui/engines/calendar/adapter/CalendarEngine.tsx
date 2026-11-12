import { t } from '@i18n'
import { boardDays, calendarWeeks, fullName, type BoardDay } from '@logic'
import { useMemo } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { formatDate } from '../../../patterns/dates'
import { BoardEngine, type BoardFrame } from '../../../board/BoardEngine'
import { BreachMark } from '../../../board/BreachMark'
import { useBreaches, type Breaches } from '../../../board/breaches'
import { EngineScroller } from '../../../board/EngineScroller'
import { LeaveChip } from '../../../board/LeaveChip'

// The calendar view (D-174): the window's days in weeks of seven, each with how many are away and who is on leave,
// absences first. A day grows with its leaves; nothing hides behind a "+N". Below md the days stack, one under the other.
// The places before the window's first day and after its last stay empty: the board reads no day outside the window.

const HEADING = 'flex items-center gap-sm'

function Day({ day, frame, breaches }: { readonly day: BoardDay; readonly frame: BoardFrame; readonly breaches: Breaches }) {
  const isToday = day.day === frame.model.today
  // A day with a report opens it from its heading (D-193).
  const open = frame.openDay === null ? null : frame.openDay(day.day)
  // A day that breaks a rule says so beside its heading, and opens its rules (D-290, OI-221).
  const breach = breaches.byDay.get(day.day) ?? null
  const face = (
    <>
      <span className="text-text-muted">{formatDate(day.day, 'weekdayShort')}</span>
      <span
        className={`tabular-nums font-semibold ${isToday ? 'inline-flex min-w-icon items-center justify-center rounded-pill bg-today px-xs text-on-action' : ''}`}
      >
        {formatDate(day.day, 'day')}
      </span>
      <span className="sr-only">{formatDate(day.day, 'dayMonth')}</span>
      {day.away === 0 ? null : (
        <span className="ms-auto text-label text-text-muted tabular-nums">
          {t('engines.away')} {day.away}
        </span>
      )}
    </>
  )
  return (
    <li
      className="flex min-w-none flex-col gap-xs border-b border-line bg-surface p-sm md:border-s"
      aria-current={isToday ? 'date' : undefined}
    >
      <div className="flex items-start gap-xs">
        <h2 className="min-w-none flex-1 text-name">
          {open === null ? <div className={HEADING}>{face}</div> : (
            <AriaButton
              onPress={open}
              className={`${HEADING} -m-xs w-full cursor-pointer rounded-control p-xs text-start outline-focus data-focus-visible:outline-2 data-hovered:bg-inner`}
            >
              <span className="sr-only">{t('presence.openDay')}</span>
              {face}
            </AriaButton>
          )}
        </h2>
        {breach === null ? null : <BreachMark day={breach} open={breaches.open} dated={false} />}
      </div>
      {day.entries.length === 0 ? null : (
        <ul className="flex flex-wrap gap-xs md:flex-col md:flex-nowrap">
          {day.entries.map((entry) => (
            <li key={entry.leave.id} className="max-w-full">
              <LeaveChip leave={entry.leave} colors={frame.colors} onOpen={frame.openLeave} name={fullName(entry.soldier)} dates={false} />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function Calendar({ frame }: { readonly frame: BoardFrame }) {
  const cells = useMemo(() => calendarWeeks(boardDays(frame.model)).flat(), [frame.model])
  const breaches = useBreaches(frame)
  return (
    <ol className="grid grid-cols-1 border-t border-line md:grid-cols-7 md:border-e">
      {cells.map((cell, index) =>
        cell === null ? (
          // A place in the week outside the window, on the grid only.
          // oxlint-disable-next-line react/no-array-index-key
          <li key={index} aria-hidden className="hidden border-b border-s border-line md:block" />
        ) : (
          <Day key={cell.day} day={cell} frame={frame} breaches={breaches} />
        ),
      )}
    </ol>
  )
}

/** The calendar engine. */
export function CalendarEngine() {
  return (
    <BoardEngine>{(frame) => <EngineScroller labelKey="engines.calendarLabel">{() => <Calendar frame={frame} />}</EngineScroller>}</BoardEngine>
  )
}
