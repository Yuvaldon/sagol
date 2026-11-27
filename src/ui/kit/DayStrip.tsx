import type { CalendarDate } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { Button as AriaButton } from 'react-aria-components'
import { formatDate } from '../patterns/dates'
import { DAY_STATE_KEYS, type DayState, type StripDay } from './dayState'

// The 14-day strip (D-454): one segment a day, today first as a night-blue circle. A day on base is a full segment, a
// day at home by the leave round a quiet one, another absence a filled one, a request that waits an amber outline; the words are read aloud, so color never stands alone.
// Where days are chosen (the person card, D-482), each day is a toggle: a tap starts a range and a second tap ends it,
// as on the month, and a chosen day carries a night-blue ring.

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

function DayFace({ day, today }: { readonly day: StripDay; readonly today: CalendarDate }) {
  return (
    <>
      <span aria-hidden className={`h-sm w-full rounded-full ${SEGMENTS[day.state]}`} />
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
  return (
    <ol aria-label={t(labelKey)} className="flex items-start gap-2xs">
      {days.map((day) => {
        const words = [formatDate(day.date, 'dayMonth'), t(DAY_STATE_KEYS[day.state])].join(WORD)
        if (select === null) {
          return (
            <li key={day.date} className="flex min-w-none flex-1 flex-col items-center gap-xs">
              <DayFace day={day} today={today} />
              <span className="sr-only">{words}</span>
            </li>
          )
        }
        const chosen = select.covers(day.date)
        const allowed = select.allows(day.date)
        return (
          <li key={day.date} className="flex min-w-none flex-1">
            {/* A day that cannot be chosen says so and stays in reach of the keyboard (D-473). */}
            <AriaButton
              aria-pressed={chosen}
              aria-disabled={!allowed}
              aria-label={allowed ? words : [words, t('kit.dayUnavailable')].join(WORD)}
              onPress={() => {
                if (allowed) select.onDay(day.date)
              }}
              className={`flex min-h-touch min-w-none flex-1 cursor-pointer flex-col items-center gap-xs rounded-control py-2xs outline-focus -outline-offset-2 data-focus-visible:outline-2 ${
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
