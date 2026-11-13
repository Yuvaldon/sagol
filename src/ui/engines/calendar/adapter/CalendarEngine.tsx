import { t } from '@i18n'
import { boardDays, calendarWeeks, fullName, type BoardDay } from '@logic'
import { RuleEnforcement } from '@contracts'
import { useId, useMemo } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { formatDate } from '../../../patterns/dates'
import { BoardEngine, type BoardFrame } from '../../../board/BoardEngine'
import { BreachMark } from '../../../board/BreachMark'
import { BREACH_TONES, breachLabel, useBreaches, type Breaches } from '../../../board/breaches'
import { TEXT_SEPARATOR } from '../../../board/labels'
import { EngineScroller } from '../../../board/EngineScroller'
import { LeaveChip } from '../../../board/LeaveChip'
import { useIsDesktop } from '../../../patterns/media'

// The calendar view (D-174): the window's days in weeks of seven, a month grid at every width (D-339). From md a day
// shows how many are away and who is on leave, absences first; it grows with its leaves, and nothing hides behind a
// "+N". On a phone a day is a compact cell: its number, today's mark, how many are away and the heat row's tone when it
// breaks a rule, and a tap opens its report, or its rules when it has no report to open. The places before the window's first day and after its last stay empty:
// the board reads no day outside the window.

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
      className="flex min-w-none flex-col gap-xs border-b border-s border-line bg-surface p-sm"
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
        <ul className="flex flex-col gap-xs">
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

/** A phone's day (D-339): the whole cell opens the report; its name is the full date, the rest is its description. */
function CompactDay({ day, frame, breaches }: { readonly day: BoardDay; readonly frame: BoardFrame; readonly breaches: Breaches }) {
  const describedBy = useId()
  const isToday = day.day === frame.model.today
  const open = frame.openDay === null ? null : frame.openDay(day.day)
  const breach = breaches.byDay.get(day.day) ?? null
  const tone = breach === null ? 'bg-surface' : BREACH_TONES[breach.worst ?? RuleEnforcement.enum.soft]
  const muted = breach === null ? 'text-text-muted' : ''
  const date = formatDate(day.day, 'full')
  const description = [
    ...(day.away === 0 ? [] : [`${t('engines.away')} ${String(day.away)}`]),
    ...(breach === null ? [] : [breachLabel(breach)]),
  ].join(TEXT_SEPARATOR)
  const face = (
    <>
      <span aria-hidden className={`text-label ${muted}`}>
        {formatDate(day.day, 'weekdayNarrow')}
      </span>
      <span
        aria-hidden
        className={`tabular-nums font-semibold ${isToday ? 'inline-flex min-w-icon items-center justify-center rounded-pill bg-today px-xs text-on-action' : ''}`}
      >
        {formatDate(day.day, 'day')}
      </span>
      <span aria-hidden className={`min-h-icon text-label tabular-nums ${muted}`}>
        {day.away === 0 ? null : String(day.away)}
      </span>
    </>
  )
  const cell = `flex min-h-touch w-full flex-col items-center justify-center gap-2xs py-xs ${tone}`
  const press = `${cell} cursor-pointer outline-focus -outline-offset-2 data-focus-visible:outline-2`
  const described = description === '' ? {} : { 'aria-describedby': describedBy }
  return (
    <li className="min-w-none border-b border-s border-line" aria-current={isToday ? 'date' : undefined}>
      <h2 className="text-name">
        {open !== null ? (
          <AriaButton onPress={open} {...described} className={press}>
            <span className="sr-only">
              {t('presence.openDay')} {date}
            </span>
            {face}
          </AriaButton>
        ) : breach === null ? (
          <div className={cell}>
            <span className="sr-only">{date}</span>
            {face}
          </div>
        ) : (
          // Without a report to open, a day that breaks a rule opens its rules, as its mark does from md (D-290).
          <AriaButton
            onPress={() => {
              breaches.open(day.day)
            }}
            {...described}
            className={press}
          >
            <span className="sr-only">{date}</span>
            {face}
          </AriaButton>
        )}
      </h2>
      {/* Outside the heading and the button, so it describes them and is not read twice in their name. */}
      {description === '' ? null : (
        <span id={describedBy} className="sr-only">
          {description}
        </span>
      )}
    </li>
  )
}

function Calendar({ frame }: { readonly frame: BoardFrame }) {
  const cells = useMemo(() => calendarWeeks(boardDays(frame.model)).flat(), [frame.model])
  const breaches = useBreaches(frame)
  const desktop = useIsDesktop()
  const Cell = desktop ? Day : CompactDay
  return (
    <ol className="grid grid-cols-7 border-t border-e border-line">
      {cells.map((cell, index) =>
        cell === null ? (
          // A place in the week outside the window, on the grid only.
          // oxlint-disable-next-line react/no-array-index-key
          <li key={index} aria-hidden className="border-b border-s border-line" />
        ) : (
          <Cell key={cell.day} day={cell} frame={frame} breaches={breaches} />
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
