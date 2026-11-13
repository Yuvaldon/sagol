import { RuleEnforcement, type CalendarDate } from '@contracts'
import { t } from '@i18n'
import type { HeatDay } from '@logic'
import { Button as AriaButton } from 'react-aria-components'
import { formatDate } from '../patterns/dates'
import { BREACH_TONES, breachLabel, type Breaches } from './breaches'

// A day's breach as the calendar and the list draw it (D-290, OI-221), in the heat row's tones (D-141).

/** One day's breach: its count, or its date and count, in the heat row's tones. */
export function BreachMark({ day, open, dated }: { readonly day: HeatDay; readonly open: (day: CalendarDate) => void; readonly dated: boolean }) {
  return (
    <AriaButton
      aria-label={breachLabel(day)}
      onPress={() => {
        open(day.date)
      }}
      className={`inline-flex min-h-touch min-w-touch shrink-0 cursor-pointer items-center justify-center gap-xs rounded-pill px-sm text-label font-bold tabular-nums outline-focus outline-offset-1 md:min-h-control md:min-w-control data-focus-visible:outline-2 ${BREACH_TONES[day.worst ?? RuleEnforcement.enum.soft]}`}
    >
      {dated ? <span className="font-normal">{formatDate(day.date, 'dayMonth')}</span> : null}
      {String(day.broken)}
    </AriaButton>
  )
}

/** The list's summary of the window's breaches, above its rows. Absent when nothing breaks. */
export function BreachSummary({ breaches }: { readonly breaches: Breaches }) {
  if (breaches.days.length === 0) return null
  return (
    <section aria-label={t('rules.heatRow')} className="flex flex-wrap items-center gap-xs px-lg pt-md">
      <h2 className="text-label text-text-muted">{t('rules.heatBroken')}</h2>
      <ul className="flex flex-wrap gap-xs">
        {breaches.days.map((day) => (
          <li key={day.date}>
            <BreachMark day={day} open={breaches.open} dated />
          </li>
        ))}
      </ul>
    </section>
  )
}
