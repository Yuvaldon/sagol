import type { CalendarDate } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { formatDate } from '../patterns/dates'
import { DAY_STATE_KEYS, type DayState, type StripDay } from './dayState'

// The 14-day strip (D-454): one segment a day, today first as a night-blue circle. A day on base is a full segment, a
// day at home a quiet one, a request that waits an amber outline; the words are read aloud, so color never stands alone.

const SEGMENTS: Readonly<Record<DayState, string>> = {
  base: 'bg-time-base',
  away: 'border border-absence-edge bg-time-approved',
  pending: 'border border-dashed border-status-pending-line bg-time-pending',
}

const WORD = ' '

export function DayStrip({ days, today, labelKey }: { readonly days: readonly StripDay[]; readonly today: CalendarDate; readonly labelKey: I18nKey }) {
  return (
    <ol aria-label={t(labelKey)} className="flex items-start gap-2xs">
      {days.map((day) => (
        <li key={day.date} className="flex min-w-none flex-1 flex-col items-center gap-xs">
          <span aria-hidden className={`h-sm w-full rounded-full ${SEGMENTS[day.state]}`} />
          <span
            aria-hidden
            className={`flex size-badge max-w-full items-center justify-center rounded-full text-caption tabular-nums ${
              day.date === today ? 'bg-action-solid font-bold text-on-action' : 'text-text-muted'
            }`}
          >
            {formatDate(day.date, 'day')}
          </span>
          <span className="sr-only">{[formatDate(day.date, 'dayMonth'), t(DAY_STATE_KEYS[day.state])].join(WORD)}</span>
        </li>
      ))}
    </ol>
  )
}
