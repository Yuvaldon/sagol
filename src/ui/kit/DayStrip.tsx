import type { CalendarDate } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { Button as AriaButton } from 'react-aria-components'
import { formatDate } from '../patterns/dates'
import { DAY_STATE_KEYS, type DayState, type StripDay } from './dayState'

// The 14-day strip (D-454): one segment a day, today first as a night-blue circle. A day on base is a full segment, a
// day at home by the leave round a quiet one, another absence a filled one, a request that waits an amber outline; the words are read aloud, so color never stands alone.
// Days away by one leave are one segment across them, and a request that waits carries its type's name (OI-395).
// Where days are chosen (the person card, D-482), each day is a toggle: a tap starts a range and a second tap ends it,
// as on the month, and a chosen day carries a night-blue ring. Its days then wrap into weeks, each day a 44 px target.

const SEGMENTS: Readonly<Record<DayState, string>> = {
  base: 'bg-time-base',
  // The leave round is quiet: it is the regular state. Another absence is an exception, and stands out.
  round: 'border border-line bg-time-round',
  away: 'border border-absence-edge bg-time-approved',
  pending: 'border border-dashed border-status-pending-line bg-time-pending',
}

const WORD = ' '

/** How days are chosen on the strip, as the month chooses them (`Month`'s `select`). */
export interface StripSelect {
  readonly covers: (day: CalendarDate) => boolean
  readonly allows: (day: CalendarDate) => boolean
  readonly onDay: (day: CalendarDate) => void
}

/** How many days, from each day, the run of one leave that starts there holds; 0 for a day inside a run. Base days stand alone. */
function runLengths(days: readonly StripDay[]): number[] {
  const same = (a: StripDay | undefined, b: StripDay) =>
    a !== undefined && a.state !== 'base' && a.state === b.state && (a.leave_id ?? null) === (b.leave_id ?? null)
  return days.map((day, index) => {
    if (same(days[index - 1], day)) return 0
    let length = 1
    for (let next = days[index + length]; next !== undefined && same(days[index + length - 1], next); next = days[index + length]) length += 1
    return length
  })
}

/** A run of one leave's days, drawn from its first day across the next ones (each day a column, the gap between them included). */
function RunSegment({ day, length }: { readonly day: StripDay; readonly length: number }) {
  return (
    <span
      aria-hidden
      style={{ inlineSize: `calc(${String(length)} * 100% + ${String(length - 1)} * var(--spacing-2xs))` }}
      className={`absolute start-none top-none flex h-badge items-center justify-center overflow-hidden rounded-small px-xs ${SEGMENTS[day.state]}`}
    >
      {day.state === 'pending' && day.label !== undefined && day.label !== null ? (
        <span className="truncate text-caption font-semibold text-status-pending-text">{day.label}</span>
      ) : null}
    </span>
  )
}

function DayFace({ day, today, run = null }: { readonly day: StripDay; readonly today: CalendarDate; readonly run?: number | null }) {
  return (
    <>
      {run === null || day.state === 'base' ? (
        <span aria-hidden className={`h-badge w-full rounded-small ${SEGMENTS[day.state]}`} />
      ) : (
        <span aria-hidden className="relative h-badge w-full">
          {run > 0 ? <RunSegment day={day} length={run} /> : null}
        </span>
      )}
      <span
        aria-hidden
        className={`flex size-badge max-w-full items-center justify-center rounded-full text-caption tabular-nums ${
          day.date === today ? 'bg-action-solid font-bold text-on-action' : 'text-text-muted'
        }`}
      >
        {formatDate(day.date, 'day')}
      </span>
    </>
  )
}

export function DayStrip({
  days,
  today,
  labelKey,
  select = null,
}: {
  readonly days: readonly StripDay[]
  readonly today: CalendarDate
  readonly labelKey: I18nKey
  readonly select?: StripSelect | null
}) {
  const runs = runLengths(days)
  return (
    // Where days are chosen, the strip wraps into weeks of seven, so each day is a 44 px target (WCAG 2.5.5).
    <ol aria-label={t(labelKey)} className={select === null ? 'flex items-start gap-2xs' : 'grid grid-cols-7 gap-2xs'}>
      {days.map((day, index) => {
        const named = day.state === 'pending' && day.label !== undefined && day.label !== null ? [t(DAY_STATE_KEYS[day.state]), day.label].join(WORD) : t(DAY_STATE_KEYS[day.state])
        const words = [formatDate(day.date, 'dayMonth'), named].join(WORD)
        if (select === null) {
          return (
            <li key={day.date} className="flex min-w-none flex-1 flex-col items-center gap-xs">
              <DayFace day={day} today={today} run={runs[index] ?? 0} />
              <span className="sr-only">{words}</span>
            </li>
          )
        }
        const chosen = select.covers(day.date)
        const allowed = select.allows(day.date)
        return (
          <li key={day.date} className="flex min-w-touch">
            {/* A day that cannot be chosen says so and stays in reach of the keyboard (D-473). */}
            <AriaButton
              aria-pressed={chosen}
              aria-disabled={!allowed}
              aria-label={allowed ? words : [words, t('kit.dayUnavailable')].join(WORD)}
              onPress={() => {
                if (allowed) select.onDay(day.date)
              }}
              className={`flex min-h-touch min-w-touch flex-1 cursor-pointer flex-col items-center justify-center gap-xs rounded-control py-2xs outline-focus -outline-offset-2 data-focus-visible:outline-2 ${
                chosen ? 'bg-action-soft ring-2 ring-action-solid' : ''
              } ${allowed ? '' : 'cursor-default opacity-60'}`}
            >
              <DayFace day={day} today={today} />
            </AriaButton>
          </li>
        )
      })}
    </ol>
  )
}
