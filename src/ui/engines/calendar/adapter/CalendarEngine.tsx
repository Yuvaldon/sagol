import { BOARD, NEW_ENTITY, PANEL_IDS } from '@config'
import type { CalendarDate } from '@contracts'
import { t } from '@i18n'
import {
  boardDays,
  calendarWeeks,
  cellRequests,
  dayLeaves,
  filterUnitOf,
  monthSpan,
  selectDay,
  selectionCovers,
  useBoardDay,
  useBoardWindow,
  useDateWindow,
  useHeatRow,
  useLeaveCreation,
  useRulesDay,
  usePanel,
  type BoardDay,
  type DaySelection,
} from '@logic'
import { CalendarRange, ChevronLeft } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { BoardEngine, type BoardFrame } from '../../../board/BoardEngine'
import { BoardScreen, type BoardHeadProps } from '../../../board/BoardScreen'
import { useLongPress, useSwipe, type SwipeDirection } from '../../../board/gestures'
import { daysText } from '../../../board/labels'
import { RequestRow, RoundRow } from '../../../board/LeaveRows'
import { useScopeName } from '../../../board/scopeName'
import { useSheetIntent } from '../../../board/sheetIntent'
import { Fraction } from '../../../kit/Fraction'
import { Tray } from '../../../kit/Tray'
import { formatDate } from '../../../patterns/dates'
import { useIsDesktop } from '../../../patterns/media'
import { useShellChrome } from '../../../shell/chrome'
import { RequestsScope } from '../../../shell/today/RequestsScope'
import { UnitDrawer } from '../../../shell/today/UnitDrawer'
import { iconOf } from '../../../theme/icons'

// The calendar (the handoff's board spec, §3 "Calendar — where the gaps are"; D-480): the month fills the height above
// the selected day's drawer. A cell names its requests, up to three and then "+N", and is soft amber when the day is
// below what a rule asks (§1.9, §1.10); the leave round, the regular state, is not drawn. A tap selects a day and a
// second tap opens its drawer to the middle stop; a day of another month moves the board there. Holding a day starts a
// range, which the tray offers as a new leave; "בחירת טווח" in the drawer is the same without holding (D-458). A swipe
// across the month moves between months, up and down between the drawer's stops; the arrows by the title and the
// drawer's handle do the same by tap.

type Stop = 'edge' | 'middle' | 'full'
const STOPS: readonly Stop[] = ['edge', 'middle', 'full']
const FOCUS = 'outline-focus -outline-offset-2 data-focus-visible:outline-2'
const SEPARATOR = ' · '
const WORD = ' '
const BAR_ICON = 12

function moved(stop: Stop, by: -1 | 1): Stop {
  return STOPS[Math.min(STOPS.length - 1, Math.max(0, STOPS.indexOf(stop) + by))] ?? stop
}

function firstName(entry: { readonly soldier: { readonly first_name: string; readonly nickname: string | null } }): string {
  return entry.soldier.nickname ?? entry.soldier.first_name
}

function Bars({ day, compact }: { readonly day: BoardDay; readonly compact: boolean }) {
  const requests = cellRequests(day)
  const shown = requests.slice(0, BOARD.cellBars)
  const more = requests.length - shown.length
  if (requests.length === 0) return null
  return (
    <span aria-hidden className="flex w-full min-w-none flex-col gap-2xs">
      {shown.map((entry) => {
        const pending = entry.leave.status === 'pending'
        const Icon = iconOf(entry.leave.type?.icon_key ?? null)
        const look = pending ? 'border border-status-pending-line bg-time-pending' : 'bg-time-approved'
        return compact ? (
          <span key={entry.leave.id} className={`h-xs w-full rounded-full ${look}`} />
        ) : (
          <span key={entry.leave.id} className={`flex min-w-none items-center gap-2xs rounded-small px-2xs text-caption text-time-label ${look}`}>
            {Icon === null ? null : <Icon size={BAR_ICON} className="shrink-0" />}
            <span className="truncate">{firstName(entry)}</span>
          </span>
        )
      })}
      {more > 0 && !compact ? <span className="text-caption text-text-muted tabular-nums">{[t('board.morePrefix'), String(more)].join('')}</span> : null}
    </span>
  )
}

function dayName(day: BoardDay, today: CalendarDate, low: boolean): string {
  const present = day.total - day.away
  return [
    formatDate(day.day, 'full'),
    ...(day.day === today ? [t('board.todayTag')] : []),
    [String(present), t('kit.fractionOf'), String(day.total), t('board.onBase')].join(WORD),
    ...(low ? [t('kit.fractionLow')] : []),
    ...cellRequests(day).map((entry) => [entry.soldier.first_name, entry.soldier.last_name].join(WORD)),
  ].join(SEPARATOR)
}

interface MonthProps {
  readonly weeks: readonly (readonly (BoardDay | null)[])[]
  readonly month: CalendarDate
  readonly today: CalendarDate
  readonly selected: CalendarDate
  readonly range: DaySelection | null
  readonly low: ReadonlySet<CalendarDate>
  readonly compact: boolean
  readonly onDay: (day: CalendarDate) => void
  readonly onHold: (day: CalendarDate) => void
}

function Cell({ day, month, today, selected, range, low, compact, onDay, onHold }: Omit<MonthProps, 'weeks'> & { readonly day: BoardDay }) {
  const hold = useLongPress(() => {
    onHold(day.day)
  })
  const outside = startOfMonth(day.day) !== month
  const isToday = day.day === today
  const chosen = day.day === selected
  const ranged = selectionCovers(range, day.day)
  const below = low.has(day.day)
  const digits = isToday
    ? 'bg-action-solid font-bold text-on-action'
    : outside
      ? 'text-text-faint'
      : day.day < today
        ? 'text-past'
        : 'text-text'
  return (
    <AriaButton
      aria-pressed={chosen}
      onPointerDownCapture={hold.onPointerDown}
      onPointerMove={hold.onPointerMove}
      onPointerUpCapture={hold.onPointerUp}
      onPointerCancel={hold.onPointerCancel}
      onPress={() => {
        if (hold.consumed()) return
        onDay(day.day)
      }}
      className={`flex min-h-none min-w-none cursor-pointer select-none flex-col items-center gap-2xs rounded-control px-2xs ${compact ? 'justify-center' : 'pt-xs'} ${
        ranged ? 'bg-action-soft' : below ? 'bg-status-pending-cell' : ''
      } ${chosen ? 'ring-2 ring-action-solid ring-inset' : ''} ${FOCUS}`}
    >
      <span className="sr-only">{dayName(day, today, below)}</span>
      <span aria-hidden className={`inline-flex size-control shrink-0 items-center justify-center rounded-full text-body tabular-nums ${digits}`}>
        {formatDate(day.day, 'day')}
      </span>
      <Bars day={day} compact={compact} />
    </AriaButton>
  )
}

function Month({ weeks, ...cell }: MonthProps) {
  const header = weeks.find((week) => week.every((day) => day !== null)) ?? weeks[0] ?? []
  return (
    <>
      <div className="grid shrink-0 grid-cols-7 pb-xs">
        {header.map((day, index) =>
          day === null ? (
            // oxlint-disable-next-line react/no-array-index-key
            <span key={index} />
          ) : (
            <span key={day.day} className="text-center text-small font-bold text-text-muted">
              <span aria-hidden>{formatDate(day.day, 'weekdayNarrow')}</span>
              <span className="sr-only">{formatDate(day.day, 'weekdayLong')}</span>
            </span>
          ),
        )}
      </div>
      <div className={`flex min-h-none flex-col gap-2xs ${cell.compact ? '' : 'flex-1'}`}>
        {weeks.map((week, row) => (
          // A month's weeks never reorder, so their place is their key.
          // oxlint-disable-next-line react/no-array-index-key
          <div key={row} className={`grid grid-cols-7 gap-2xs ${cell.compact ? 'h-bar' : 'min-h-none flex-1'}`}>
            {week.map((day, column) =>
              day === null ? (
                // oxlint-disable-next-line react/no-array-index-key
                <span key={column} />
              ) : (
                <Cell key={day.day} day={day} {...cell} />
              ),
            )}
          </div>
        ))}
      </div>
    </>
  )
}

function DayList({ day, frame, counted }: { readonly day: CalendarDate; readonly frame: BoardFrame; readonly counted: readonly BoardDay[] }) {
  const leaves = useMemo(() => dayLeaves(counted, day), [counted, day])
  const empty = leaves.roundLeaving.length + leaves.roundHome.length + leaves.roundReturning.length + leaves.requests.length === 0
  if (empty) return <p className="py-lg text-center text-body text-text-muted">{t('board.dayNoLeaves')}</p>
  return (
    <ul className="flex flex-col rounded-card bg-surface px-lg py-xs">
      <RoundRow entries={leaves.roundLeaving} tag={t('board.leavingToday')} groupTag={t('board.leavingTodayMany')} frame={frame} counted={counted} />
      <RoundRow entries={leaves.roundHome} tag={null} groupTag={t('board.home')} frame={frame} counted={counted} />
      <RoundRow entries={leaves.roundReturning} tag={t('board.returningToday')} groupTag={t('board.returningTodayMany')} frame={frame} counted={counted} />
      {leaves.requests.map((request) => (
        <RequestRow
          key={request.entry.leave.id}
          entry={request.entry}
          tag={request.leaving ? t('board.leavingToday') : request.returning ? t('board.returningToday') : null}
          frame={frame}
          counted={counted}
        />
      ))}
    </ul>
  )
}

function DaySheet({
  day,
  today,
  counted,
  low,
  stop,
  onStop,
  onRange,
  frame,
}: {
  readonly day: CalendarDate
  readonly today: CalendarDate
  readonly counted: readonly BoardDay[]
  readonly low: boolean
  readonly stop: Stop
  readonly onStop: (stop: Stop) => void
  /** Starts a range on the day, without holding it; NULL where no leave can be asked here. */
  readonly onRange: (() => void) | null
  readonly frame: BoardFrame
}) {
  const heading = useId()
  const unitName = useScopeName()
  const rules = useRulesDay()
  const [drawer, setDrawer] = useState(false)
  const swipe = useSwipe((direction) => {
    if (direction === 'up') onStop(moved(stop, 1))
    if (direction === 'down') onStop(moved(stop, -1))
  })
  const shown = counted.find((candidate) => candidate.day === day)
  const line = [formatDate(day, 'weekdayLong'), ...(day === today ? [t('board.todayTag')] : [])].join(SEPARATOR)
  return (
    <section
      aria-labelledby={heading}
      className={`glass-drawer flex flex-col rounded-t-card shadow-drawer ${stop === 'edge' ? 'shrink-0' : 'min-h-none flex-1'}`}
    >
      <div onPointerDown={swipe.onPointerDown} onPointerUp={swipe.onPointerUp} onPointerCancel={swipe.onPointerCancel} className="flex shrink-0 touch-none flex-col">
        <div className="flex justify-center">
          <AriaButton
            aria-label={t(stop === 'full' ? 'board.sheetShrink' : 'board.sheetGrow')}
            aria-expanded={stop !== 'edge'}
            onPress={() => {
              if (swipe.consumed()) return
              // A tap on the handle moves one stop on; past the full one, back to the edge.
              onStop(stop === 'full' ? 'edge' : moved(stop, 1))
            }}
            className="flex h-touch w-action cursor-pointer items-center justify-center rounded-full outline-focus -outline-offset-2 data-focus-visible:outline-2"
          >
            <span aria-hidden className="h-xs w-grip rounded-full bg-line" />
          </AriaButton>
        </div>
        <header className="flex items-center justify-between gap-sm px-lg pb-md">
          <h3 id={heading} className="flex min-w-none items-center gap-sm">
            <span className="text-display font-bold tracking-tight tabular-nums">{formatDate(day, 'day')}</span>
            <span className="flex min-w-none flex-col">
              <span className="truncate text-heading font-bold">{line}</span>
              <span className="truncate text-body text-text-muted">{[t('board.inMonth'), formatDate(day, 'month')].join('')}</span>
            </span>
          </h3>
          <div className="flex shrink-0 items-center gap-2xs">
            {onRange === null ? null : (
              <AriaButton
                aria-label={t('board.pickRange')}
                onPress={onRange}
                className={`inline-flex size-touch cursor-pointer items-center justify-center rounded-full text-text-muted ${FOCUS}`}
              >
                <CalendarRange aria-hidden size={20} />
              </AriaButton>
            )}
            {shown === undefined ? null : (
              <AriaButton
                onPress={() => {
                  setDrawer(true)
                }}
                className={`flex cursor-pointer items-center gap-2xs rounded-control ${FOCUS}`}
              >
                <span className="sr-only">{t('board.onBase')}</span>
                <Fraction value={shown.total - shown.away} of={shown.total} low={low} />
                <ChevronLeft aria-hidden size={18} className="text-text-muted" />
              </AriaButton>
            )}
          </div>
        </header>
      </div>
      {low ? (
        // A day below a rule says which, and who is missing, in the rules of its day (D-141).
        <div className="shrink-0 px-lg pb-sm">
          <AriaButton
            onPress={() => {
              rules.openOn(day)
            }}
            className={`flex min-h-touch w-full cursor-pointer items-center justify-between gap-sm rounded-control bg-status-pending-bg px-md text-small font-semibold text-status-pending-text ${FOCUS}`}
          >
            {t('board.rulesBroken')}
            <ChevronLeft aria-hidden size={16} />
          </AriaButton>
        </div>
      ) : null}
      {stop === 'edge' ? (
        <div aria-hidden className="h-above-bottom-bar shrink-0" />
      ) : (
        <div className="min-h-none flex-1 overflow-y-auto px-lg pb-page-end">
          <DayList day={day} frame={frame} counted={counted} />
        </div>
      )}
      {drawer ? (
        <UnitDrawer
          name={unitName}
          day={day}
          onClose={() => {
            setDrawer(false)
          }}
        />
      ) : null}
    </section>
  )
}

function Calendar({ frame, onStep }: { readonly frame: BoardFrame; readonly onStep: (step: -1 | 1) => void }) {
  const { day, select } = useBoardDay()
  const panel = usePanel()
  const intent = useSheetIntent()
  const [stop, setStop] = useState<Stop>(() => intent.take() ?? 'edge')
  const [range, setRange] = useState<DaySelection | null>(null)
  const { model, window } = frame
  const counted = useMemo(() => boardDays(model), [model])
  const weeks = useMemo(() => calendarWeeks(counted), [counted])
  const unit = filterUnitOf(frame.filter)
  const heat = useHeatRow(window, unit.kind === 'unit' ? unit.unitId : null)
  const low = useMemo(
    () => new Set(heat.status === 'ready' && heat.value !== null ? heat.value.filter((one) => one.broken > 0).map((one) => one.date) : []),
    [heat],
  )
  const soldiers = useMemo(() => model.items.flatMap((item) => (item.kind === 'soldier' ? [item.soldier] : [])), [model.items])
  const creation = useLeaveCreation(soldiers)
  const asks = creation.soldiers.length > 0
  const swipe = useSwipe((direction: SwipeDirection) => {
    // The month runs right to left: a finger moving right brings the next month in.
    if (direction === 'right') onStep(1)
    if (direction === 'left') onStep(-1)
    if (direction === 'up') setStop(moved(stop, 1))
    if (direction === 'down') setStop(moved(stop, -1))
  })
  const selected = day ?? model.today
  const month = startOfMonth(selected)
  const onDay = (next: CalendarDate) => {
    if (swipe.consumed()) return
    if (range !== null) {
      setRange(selectDay(range, next))
      return
    }
    if (startOfMonth(next) !== month || next !== selected) {
      select(next)
      return
    }
    if (stop === 'edge') setStop('middle')
  }
  const days = range === null ? null : { start_date: range.start, end_date: range.end }
  // While days are picked, the tray stands in the tab bar's place.
  const { cover } = useShellChrome()
  const covering = range !== null
  useEffect(() => {
    cover(covering)
    return () => {
      cover(false)
    }
  }, [cover, covering])
  return (
    <div className="flex h-full flex-col">
      {stop === 'full' ? null : (
        <div
          role="region"
          aria-label={t('engines.calendarLabel')}
          onPointerDownCapture={swipe.onPointerDown}
          onPointerUpCapture={swipe.onPointerUp}
          onPointerCancel={swipe.onPointerCancel}
          className={`flex touch-none flex-col px-sm pb-sm ${stop === 'middle' ? 'shrink-0' : 'min-h-none flex-1'}`}
        >
          <Month
            weeks={weeks}
            month={month}
            today={model.today}
            selected={selected}
            range={range}
            low={low}
            compact={stop === 'middle'}
            onDay={onDay}
            onHold={(held) => {
              if (!asks) return
              select(held)
              setRange({ start: held, end: held })
            }}
          />
        </div>
      )}
      <DaySheet
        day={selected}
        today={model.today}
        counted={counted}
        low={low.has(selected)}
        stop={stop}
        onStop={setStop}
        onRange={
          asks
            ? () => {
                setRange({ start: selected, end: selected })
                setStop('edge')
              }
            : null
        }
        frame={frame}
      />
      {days === null ? null : (
        <div className="pointer-events-none absolute inset-x-lg bottom-lg z-5 flex justify-center">
          <Tray
            labelKey="board.rangeTray"
            action={[t('board.leaveForSoldiers'), daysText(days)].join(SEPARATOR)}
            onAction={() => {
              panel.open(PANEL_IDS.leaves, { entity: NEW_ENTITY, draft: days })
              setRange(null)
            }}
            clearKey="board.clearSelection"
            onClear={() => {
              setRange(null)
            }}
          />
        </div>
      )}
    </div>
  )
}

/** The calendar engine: the month of the selected day, on every device (D-480). */
export function CalendarEngine() {
  const desktop = useIsDesktop()
  const board = useBoardWindow('calendar', !desktop)
  const { day, today } = useBoardDay()
  const { goToToday } = useDateWindow()
  const head: BoardHeadProps = {
    month: day,
    steps: { previousKey: 'board.previousMonth', nextKey: 'board.nextMonth', canStep: board.canStep, step: board.step },
    away: day !== null && day !== today,
    onToday: goToToday,
  }
  return (
    <BoardScreen head={head}>
      <RequestsScope>
        <BoardEngine window={board.window} today={today}>
          {(frame) => <Calendar frame={frame} onStep={board.step} />}
        </BoardEngine>
      </RequestsScope>
    </BoardScreen>
  )
}

/** The first day of a day's month. */
function startOfMonth(day: CalendarDate): CalendarDate {
  return monthSpan(day, 0).first
}
