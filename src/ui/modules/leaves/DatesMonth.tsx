import type { CalendarDate } from '@contracts'
import { daysFrom, isBeforeDay, monthSpan, selectDay, selectionCovers, weeksOf, type DaySelection } from '@logic'
import { useMemo, useState } from 'react'
import { Month } from '../../kit/Month'

// The days of a new leave picked on a month (D-454), as a flight is booked: one tap is a day, a second makes a
// range, and a day that has passed is not offered. It writes the same two dates the fields beside it hold.

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
  const [offset, setOffset] = useState(0)
  const span = useMemo(() => monthSpan(today, offset), [today, offset])
  const weeks = useMemo(() => weeksOf(daysFrom(span.first, span.days).map((date) => ({ date, state: 'base' as const }))), [span])
  const selection: DaySelection | null = start === null || end === null || isBeforeDay(end, start) ? null : { start, end }
  return (
    <Month
      month={span.first}
      weeks={weeks}
      today={today}
      previousKey="today.previousMonth"
      nextKey="today.nextMonth"
      onPrevious={
        offset === 0
          ? null
          : () => {
              setOffset(offset - 1)
            }
      }
      onNext={() => {
        setOffset(offset + 1)
      }}
      select={{
        covers: (day) => selectionCovers(selection, day),
        allows: (day) => !isBeforeDay(day, today),
        onDay: (day) => {
          // A tap on the only day marked would clear it; a leave always has its days, so the day stays.
          const next = selectDay(selection, day)
          if (next !== null) onChange(next)
        },
      }}
    />
  )
}
