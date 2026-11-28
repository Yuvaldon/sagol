import type { CalendarDate } from '@contracts'
import { isBeforeDay, monthSpan, selectDay, selectionCovers, useMyDays, useShellPlace, weeksOf, type DaySelection } from '@logic'
import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { CardDoor } from '../../kit/Card'
import { DayStrip } from '../../kit/DayStrip'
import { Month } from '../../kit/Month'
import { LoadingNotice } from '../../patterns/Notices'
import { PageHead } from '../PageFrame'
import { dayLine, useStanding } from './standing'

// The open block of a soldier's "היום" (D-454): the date, where they are at display size, and what comes next. The
// line of what comes next opens the 14-day strip into the month, in place. Who may request a leave marks days there:
// a tap starts a range and a second tap ends it, and the tray then offers the request (D-458).

function MonthView({
  today,
  selection,
  onSelect,
}: {
  readonly today: CalendarDate
  readonly selection: DaySelection | null
  /** NULL where the soldier may not request a leave now. */
  readonly onSelect: ((selection: DaySelection | null) => void) | null
}) {
  const [offset, setOffset] = useState(0)
  const span = useMemo(() => monthSpan(today, offset), [today, offset])
  const days = useMyDays(span.first, span.days)
  if (days === null) return null
  if (days.status !== 'ready') return <LoadingNotice />
  return (
    <Month
      month={span.first}
      weeks={weeksOf(days.value)}
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
      select={
        onSelect === null
          ? null
          : {
              covers: (day) => selectionCovers(selection, day),
              allows: (day) => !isBeforeDay(day, today),
              onDay: (day) => {
                onSelect(selectDay(selection, day))
              },
            }
      }
    />
  )
}

export interface StatusProps {
  readonly selection: DaySelection | null
  readonly onSelect: ((selection: DaySelection | null) => void) | null
}

/** Where the soldier is, what comes next, and their days: the strip, or the month it opens into. */
export function Status({ selection, onSelect, size, door = false }: StatusProps & { readonly size: 'display' | 'title'; readonly door?: boolean }) {
  const standing = useStanding()
  const place = useShellPlace()
  const [month, setMonth] = useState(false)
  if (standing === null) return null
  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col gap-2xs">
        <p className={`${size === 'display' ? 'text-display' : 'text-title'} font-bold tracking-tight`}>{standing.place}</p>
        <AriaButton
          aria-expanded={month}
          onPress={() => {
            // Closing the month lets go of the days marked in it: the tray never outlives what it is about.
            if (month) onSelect?.(null)
            setMonth(!month)
          }}
          className="flex min-h-touch w-fit max-w-full cursor-pointer items-center gap-xs rounded-control text-start text-body text-text-muted outline-focus outline-offset-2 data-focus-visible:outline-2"
        >
          <span className="min-w-none truncate tabular-nums">{standing.next}</span>
          <ChevronDown aria-hidden size={18} className={`shrink-0 transition-transform duration-ui ease-standard motion-reduce:transition-none ${month ? 'rotate-180' : ''}`} />
        </AriaButton>
      </div>
      {month ? (
        <>
          <MonthView today={standing.today} selection={selection} onSelect={onSelect} />
          {/* The month's foot leads to "הסבב שלי" of "אני", where past months are too (the handoff's Today, expanded). */}
          {door ? (
            <CardDoor
              labelKey="me.myRotation"
              onPress={() => {
                place.openPage('rotation')
              }}
            />
          ) : null}
        </>
      ) : (
        <DayStrip days={standing.days} today={standing.today} labelKey="myLeaves.nextDaysTitle" />
      )}
    </div>
  )
}

export function SoldierBlock({ selection, onSelect }: StatusProps) {
  const standing = useStanding()
  return (
    <section className="flex flex-col gap-xs">
      <PageHead>{standing === null ? null : <p className="text-body text-text-muted tabular-nums">{dayLine(standing.today)}</p>}</PageHead>
      <Status selection={selection} onSelect={onSelect} size="display" door />
    </section>
  )
}
