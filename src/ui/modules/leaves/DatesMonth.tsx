import type { CalendarDate } from '@contracts'
import { daysFrom, isBeforeDay, monthSpan, monthsBetween, selectionCovers, weeksOf, type DaySelection } from '@logic'
import { useMemo, useState } from 'react'
import { Month } from '../../kit/Month'

// The days of a new leave picked on a month (D-454), as a flight is booked: the first tap is a day, the second makes
// it a range, and a day that has passed is not offered. It writes the same two dates the fields beside it hold, and
// follows them: the month in sight is the month of the first date, also after it was typed.

/** The month shown: how far it is from today's, and the start date it was last moved to. */
interface Shown {
  readonly offset: number
  readonly start: CalendarDate | null
}

export function DatesMonth({
  today,
  start,
  end,
  onChange,
}: {
  readonly today: CalendarDate
  readonly start: CalendarDate | null
  readonly end: CalendarDate | null
  readonly onChange: (selection: DaySelection) => void
}) {
  const offsetOf = (day: CalendarDate | null) => (day === null ? 0 : Math.max(0, monthsBetween(today, day)))
  const [shown, setShown] = useState<Shown>(() => ({ offset: offsetOf(start), start }))
  // A first date that changed outside the month (typed, or set by another row's day) brings its month into sight.
  if (shown.start !== start) setShown({ offset: offsetOf(start), start })
  // The range being built: the day of a first tap, until a second tap ends the range. A form's dates always hold a
  // day, so "one day" in them never means a first tap was made.
  const [anchor, setAnchor] = useState<CalendarDate | null>(null)
  const span = useMemo(() => monthSpan(today, shown.offset), [today, shown.offset])
  const weeks = useMemo(() => weeksOf(daysFrom(span.first, span.days).map((date) => ({ date }))), [span])
  const selection: DaySelection | null = start === null || end === null || isBeforeDay(end, start) ? null : { start, end }
  const move = (step: number) => {
    setShown({ offset: shown.offset + step, start })
  }
  return (
    <Month
      month={span.first}
      weeks={weeks}
      today={today}
      previousKey="today.previousMonth"
      nextKey="today.nextMonth"
      onPrevious={
        shown.offset === 0
          ? null
          : () => {
              move(-1)
            }
      }
      onNext={() => {
        move(1)
      }}
      select={{
        covers: (day) => selectionCovers(selection, day),
        allows: (day) => !isBeforeDay(day, today),
        onDay: (day) => {
          if (anchor === null) {
            setAnchor(day)
            onChange({ start: day, end: day })
            return
          }
          setAnchor(null)
          onChange(isBeforeDay(day, anchor) ? { start: day, end: anchor } : { start: anchor, end: day })
        },
      }}
    />
  )
}
