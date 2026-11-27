import { BOARD, DATE_WINDOW, NEW_ENTITY, PANEL_IDS } from '@config'
import type { CalendarDate, SoldierId } from '@contracts'
import { t } from '@i18n'
import {
  boardDays,
  fullName,
  impactOf,
  selectDay,
  selectionCovers,
  useAbsenceCheck,
  useBoardDay,
  useLeaveCreation,
  usePanel,
  type BoardItem,
  type BoardLeave,
  type DaySelection,
} from '@logic'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import type { BoardFrame } from '../../../board/BoardEngine'
import { daysText, headingLabel, leaveText } from '../../../board/labels'
import { useSwipe } from '../../../board/gestures'
import { useScopeName } from '../../../board/scopeName'
import { Tray } from '../../../kit/Tray'
import { formatDate } from '../../../patterns/dates'
import { useShellChrome } from '../../../shell/chrome'
import { UnitDrawer } from '../../../shell/today/UnitDrawer'
import { iconOf } from '../../../theme/icons'
import { assignLanes } from '../core/lanes'
import { rowOffText } from './model'

// The timeline on a phone (the handoff's board spec, §3 "Timeline — who won't be here"; D-480): a row per person, the
// day strip fixed above the rows. Each row is one person bar (§1.10): on base dark, the leave round a quiet gray, an
// approved request lighter with its type's icon, a pending one amber. The leave round is part of the row, so a moved
// leave shows where it went. A day's header selects it and opens the unit's drawer on it; a name opens the person; a
// bar opens its leave card, where its dates change (D-458: a phone's bar is not dragged). Days on base in a row are
// picked for a new leave, and the tray then offers it, with the impact line when it would break a rule. No summary
// row and no threshold marking (§3).

const FOCUS = 'outline-focus -outline-offset-2 data-focus-visible:outline-2'
const SEPARATOR = ' · '
/** A run of days: the row's height, a canvas hairline before it to part it from the run before. */
const RUN = 'flex shrink-0 items-center'
const GAP = 'border-s-2 border-canvas first:border-s-0'
const ICON = 16

type DayState = 'off' | 'base' | 'round' | 'approved' | 'pending'

interface Run {
  readonly key: string
  readonly state: DayState
  readonly start: number
  readonly length: number
  readonly leave: BoardLeave | null
}

const LOOKS: Readonly<Record<Exclude<DayState, 'off'>, string>> = {
  base: 'bg-time-base',
  round: 'bg-time-round',
  approved: 'bg-time-approved text-time-label',
  pending: 'bg-time-pending text-time-label ring-1 ring-status-pending-line ring-inset',
}

/** What is drawn on a day: a request over the round, the round over the base; a marker leaves the day on base. */
function topOf(leaves: readonly BoardLeave[], day: CalendarDate): BoardLeave | null {
  const on = leaves.filter((leave) => leave.start_date <= day && leave.end_date >= day && leave.effect === 'unavailable')
  return on.find((leave) => leave.layer === 'request') ?? on.find((leave) => leave.layer === 'round') ?? null
}

/** A leave's days in the window, as a lane item; NULL outside it. */
function placeOf(leave: BoardLeave, days: readonly CalendarDate[]): { readonly start: number; readonly length: number } | null {
  const start = days.findIndex((day) => day >= leave.start_date)
  const last = days.findLastIndex((day) => day <= leave.end_date)
  return start < 0 || last < start ? null : { start, length: last - start + 1 }
}

/**
 * The leaves the bar itself draws (D-111): of the requests, and apart of the rounds, those of the first lane, so two that
 * overlap never hide one under the other; the rest take lanes below the bar.
 */
function barLeaves(leaves: readonly BoardLeave[], days: readonly CalendarDate[]): readonly BoardLeave[] {
  const firstLane = (layer: BoardLeave['layer']) => {
    const placed = leaves.flatMap((leave) => {
      const at = leave.effect === 'unavailable' && leave.layer === layer ? placeOf(leave, days) : null
      return at === null ? [] : [{ leave, ...at }]
    })
    const { lanes } = assignLanes(placed)
    return placed.filter((_, index) => lanes[index] === 0).map((item) => item.leave)
  }
  return [...firstLane('request'), ...firstLane('round')]
}

function stateOf(leave: BoardLeave | null): Exclude<DayState, 'off'> {
  if (leave === null) return 'base'
  if (leave.layer === 'round') return 'round'
  return leave.status === 'pending' ? 'pending' : 'approved'
}

/** A row's days as runs: one per leave, and one per stretch on base or out of the unit. */
function runsOf(days: readonly CalendarDate[], inScope: readonly boolean[], leaves: readonly BoardLeave[]): Run[] {
  const runs: Run[] = []
  days.forEach((day, index) => {
    const leave = inScope[index] === true ? topOf(leaves, day) : null
    const state: DayState = inScope[index] === true ? stateOf(leave) : 'off'
    const key = leave?.id ?? state
    const last = runs.at(-1)
    if (last !== undefined && last.key === key && last.start + last.length === index) runs[runs.length - 1] = { ...last, length: last.length + 1 }
    else runs.push({ key, state, start: index, length: 1, leave })
  })
  return runs
}

interface Placed {
  readonly leave: BoardLeave
  readonly start: number
  readonly length: number
}

/** The leaves the bar shows no run of, in lanes of their own (D-111). */
function extraLanes(days: readonly CalendarDate[], runs: readonly Run[], leaves: readonly BoardLeave[]): { readonly lanes: readonly (readonly Placed[])[] } {
  const shown = new Set(runs.flatMap((run) => (run.leave === null ? [] : [run.leave.id])))
  const placed = leaves.flatMap((leave): Placed[] => {
    const at = shown.has(leave.id) ? null : placeOf(leave, days)
    return at === null ? [] : [{ leave, ...at }]
  })
  if (placed.length === 0) return { lanes: [] }
  const { lanes, count } = assignLanes(placed)
  return { lanes: Array.from({ length: count }, (_, lane) => placed.filter((_, index) => lanes[index] === lane)) }
}

function useWidth(element: HTMLElement | null): number {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    if (element === null) return undefined
    const observer = new ResizeObserver(() => {
      setWidth(element.clientWidth)
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [element])
  return width
}

/** The cells of a run, with a hairline between days. */
function Cells({ length, dayPx }: { readonly length: number; readonly dayPx: number }) {
  return Array.from({ length }, (_, index) => (
    // A run's days never reorder, so their place is their key.
    // oxlint-disable-next-line react/no-array-index-key
    <span key={index} aria-hidden className="h-full shrink-0 border-s border-canvas first:border-s-0" style={{ width: dayPx }} />
  ))
}

interface Picking {
  readonly soldierId: SoldierId
  readonly selection: DaySelection
}

function Row({
  item,
  frame,
  dayPx,
  picking,
  onPick,
  swiped,
}: {
  readonly item: Extract<BoardItem, { kind: 'soldier' }>
  readonly frame: BoardFrame
  readonly dayPx: number
  readonly picking: Picking | null
  /** NULL where no leave can be asked for the person. */
  readonly onPick: ((day: CalendarDate) => void) | null
  /** Whether the press that just ended was a swipe, and so no tap. */
  readonly swiped: () => boolean
}) {
  const { days } = frame.model
  const runs = useMemo(() => {
    const leaves = frame.model.leaves.get(item.soldier.id) ?? []
    return runsOf(days, item.inScope, barLeaves(leaves, days))
  }, [days, item, frame.model.leaves])
  const extra = useMemo(() => extraLanes(days, runs, frame.model.leaves.get(item.soldier.id) ?? []), [days, runs, frame.model.leaves, item.soldier.id])
  const name = fullName(item.soldier)
  const offText = rowOffText(item, days)
  const detail = item.rank?.short_title ?? item.rank?.title ?? null
  const { openSoldier } = frame
  const selection = picking?.soldierId === item.soldier.id ? picking.selection : null
  return (
    <div className="flex min-h-touch items-center border-b border-divider-strong">
      <div className="sticky start-none z-2 flex shrink-0 flex-col justify-center self-stretch bg-canvas pe-sm ps-lg" style={{ width: BOARD.timeline.nameColumnPx }}>
        {/* The name and its line are one target, the row's height, that opens the person. */}
        {openSoldier === null ? (
          <span className="truncate text-body font-semibold">{name}</span>
        ) : (
          <AriaButton
            onPress={() => {
              openSoldier(item.soldier.id)
            }}
            className={`flex min-h-touch min-w-none cursor-pointer flex-col justify-center rounded-control text-start ${FOCUS}`}
          >
            <span className="truncate text-body font-semibold">{name}</span>
          </AriaButton>
        )}
        {detail === null ? null : <span className="-mt-sm truncate text-small text-text-muted">{detail}</span>}
        {offText === null ? null : <span className="sr-only">{offText}</span>}
      </div>
      <div className="flex flex-col" aria-label={name} role="group">
      <div className="relative flex h-touch items-stretch pe-lg">
        {runs.map((run) => {
          const width = run.length * dayPx
          if (run.state === 'off') return <span key={`${run.key}:${String(run.start)}`} aria-hidden className="shrink-0" style={{ width }} />
          if (run.leave === null) {
            // Days on base: picked one by one for a new leave, with the finger; the person card and the form are the other paths.
            return (
              <span key={`${run.key}:${String(run.start)}`} aria-hidden className={`${RUN} ${GAP}`} style={{ width }}>
                <span className={`flex h-badge w-full overflow-hidden rounded-small ${LOOKS.base}`}>
                {Array.from({ length: run.length }, (_, index) => {
                  const day = days[run.start + index]
                  if (day === undefined) return null
                  const chosen = selectionCovers(selection, day)
                  return (
                    <span
                      key={day}
                      onClick={
                        onPick === null
                          ? undefined
                          : () => {
                              if (!swiped()) onPick(day)
                            }
                      }
                      className={`h-full shrink-0 border-s border-canvas first:border-s-0 ${onPick === null ? '' : 'cursor-pointer'} ${chosen ? 'bg-action-soft ring-2 ring-action-solid ring-inset' : ''}`}
                      style={{ width: dayPx }}
                    />
                  )
                })}
                </span>
              </span>
            )
          }
          const { leave } = run
          const Icon = run.state === 'approved' ? iconOf(leave.type?.icon_key ?? null) : null
          return (
            <AriaButton
              key={`${run.key}:${String(run.start)}`}
              aria-label={leaveText(leave)}
              onPress={() => {
                if (!swiped()) frame.openLeave(leave.id)
              }}
              className={`${RUN} ${GAP} cursor-pointer rounded-small ${FOCUS}`}
              style={{ width }}
            >
              {/* The bar is drawn at its height; the press takes the row's, a 44 px target. */}
              <span aria-hidden className={`relative flex h-badge w-full items-center justify-center overflow-hidden rounded-small ${LOOKS[run.state]}`}>
                <span className="absolute inset-none flex">
                  <Cells length={run.length} dayPx={dayPx} />
                </span>
                {Icon === null ? null : <Icon aria-hidden size={ICON} className="relative" />}
              </span>
            </AriaButton>
          )
        })}
      </div>
      {/* What the bar cannot show, a leave over another or a marker on base, takes a lane of its own below it. */}
      {extra.lanes.map((lane, index) => (
        // A row's lanes never reorder, so their place is their key.
        // oxlint-disable-next-line react/no-array-index-key
        <div key={index} className="relative h-touch">
          {lane.map(({ leave, start, length }) => {
            const state: Exclude<DayState, 'off'> = leave.effect === 'available' ? 'approved' : stateOf(leave)
            const Icon = leave.effect === 'available' || state === 'approved' ? iconOf(leave.type?.icon_key ?? null) : null
            return (
              <AriaButton
                key={leave.id}
                aria-label={leaveText(leave)}
                onPress={() => {
                  if (!swiped()) frame.openLeave(leave.id)
                }}
                className={`absolute inset-y-none flex cursor-pointer items-center rounded-small ${FOCUS}`}
                style={{ insetInlineStart: start * dayPx, width: length * dayPx }}
              >
                <span aria-hidden className={`relative flex h-badge w-full items-center justify-center overflow-hidden rounded-small ${LOOKS[state === 'base' ? 'approved' : state]}`}>
                  <span className="absolute inset-none flex">
                    <Cells length={length} dayPx={dayPx} />
                  </span>
                  {Icon === null ? null : <Icon aria-hidden size={ICON} className="relative" />}
                </span>
              </AriaButton>
            )
          })}
        </div>
      ))}
      </div>
    </div>
  )
}

export function PhoneTimeline({ frame, onStep }: { readonly frame: BoardFrame; readonly onStep: (step: -1 | 1) => void }) {
  const { day: selected, select } = useBoardDay()
  const panel = usePanel()
  const chrome = useShellChrome()
  const unitName = useScopeName()
  const [scroller, setScroller] = useState<HTMLElement | null>(null)
  const [drawerDay, setDrawerDay] = useState<CalendarDate | null>(null)
  const [picking, setPicking] = useState<Picking | null>(null)
  const width = useWidth(scroller)
  // A week fits the width: a swipe sideways moves it (§1.4: "move in time"), as the arrows by the title do. A longer
  // range scrolls sideways instead.
  const fits = frame.model.days.length <= DATE_WINDOW.days
  const swipe = useSwipe((direction) => {
    if (!fits) return
    if (direction === 'right') onStep(1)
    if (direction === 'left') onStep(-1)
  })
  const { days, today, items } = frame.model
  const soldiers = useMemo(() => items.flatMap((item) => (item.kind === 'soldier' ? [item.soldier] : [])), [items])
  const creation = useLeaveCreation(soldiers)
  const creatable = useMemo(() => new Set(creation.soldiers.map((soldier) => soldier.id)), [creation.soldiers])
  // The name column, and the page's margin at the inline end.
  const room = Math.max(0, width - BOARD.timeline.nameColumnPx - BOARD.timeline.minDayPx)
  const dayPx = Math.max(BOARD.timeline.minDayPx, days.length === 0 ? 0 : Math.floor(room / days.length))
  const counted = useMemo(() => boardDays(frame.model), [frame.model])
  const dates = picking === null ? null : { start_date: picking.selection.start, end_date: picking.selection.end }
  const check = useAbsenceCheck(picking?.soldierId ?? null, dates)
  const impact = picking !== null && check.status === 'ready' ? impactOf(check.value, counted, frame.model.approved, picking.soldierId) : null
  const pickedSoldier = picking === null ? undefined : soldiers.find((soldier) => soldier.id === picking.soldierId)
  // While days are picked, the tray stands in the tab bar's place.
  const { cover } = chrome
  const covering = picking !== null
  useEffect(() => {
    cover(covering)
    return () => {
      cover(false)
    }
  }, [cover, covering])

  return (
    <>
      <div
        ref={setScroller}
        role="region"
        aria-label={t('timeline.label')}
        // A region that scrolls must be reachable by keyboard.
        tabIndex={0}
        onScroll={(event) => {
          chrome.onScroll(event.currentTarget.scrollTop)
        }}
        onPointerDownCapture={swipe.onPointerDown}
        onPointerUpCapture={swipe.onPointerUp}
        onPointerCancel={swipe.onPointerCancel}
        className="h-full overflow-auto overscroll-contain outline-focus -outline-offset-2 focus-visible:outline-2"
      >
        <div className="w-max min-w-full pb-page-end">
          <div role="group" aria-label={t('board.days')} className="sticky top-none z-3 flex bg-canvas pb-xs">
            <span aria-hidden className="sticky start-none z-4 shrink-0 bg-canvas" style={{ width: BOARD.timeline.nameColumnPx }} />
            <div className="flex pe-lg">
              {days.map((day) => {
                const isToday = day === today
                const chosen = day === selected
                const past = day < today
                return (
                  <AriaButton
                    key={day}
                    aria-pressed={chosen}
                    onPress={() => {
                      select(day)
                      setDrawerDay(day)
                    }}
                    className={`flex shrink-0 cursor-pointer flex-col items-center gap-2xs rounded-control py-xs ${chosen ? 'ring-2 ring-action-solid' : ''} ${FOCUS}`}
                    style={{ width: dayPx }}
                  >
                    <span className="sr-only">{[formatDate(day, 'full'), ...(isToday ? [t('board.todayTag')] : [])].join(SEPARATOR)}</span>
                    <span aria-hidden className="text-small font-semibold text-text-muted">
                      {formatDate(day, 'weekdayNarrow')}
                    </span>
                    <span
                      aria-hidden
                      className={`inline-flex size-control items-center justify-center rounded-full text-body tabular-nums ${
                        isToday ? 'bg-action-solid font-bold text-on-action' : past ? 'text-text-muted' : 'text-text'
                      }`}
                    >
                      {formatDate(day, 'day')}
                    </span>
                  </AriaButton>
                )
              })}
            </div>
          </div>
          <ul aria-label={t('timeline.names')}>
          {items.map((item) =>
            item.kind === 'group' ? (
              <li key={item.key}>
                <h2 className="sticky start-none flex w-fit items-baseline gap-sm px-lg pt-lg pb-xs text-small font-bold text-text-muted">
                  <span className="truncate">{headingLabel(item.label)}</span>
                  <span className="font-normal tabular-nums">
                    <span className="sr-only">{t('timeline.soldiersInGroup')} </span>
                    {item.size}
                  </span>
                </h2>
              </li>
            ) : (
              <li key={item.key}>
              <Row
                item={item}
                frame={frame}
                dayPx={dayPx}
                picking={picking}
                swiped={swipe.consumed}
                onPick={
                  creatable.has(item.soldier.id)
                    ? (day) => {
                        setPicking((current) => {
                          const next = selectDay(current?.soldierId === item.soldier.id ? current.selection : null, day)
                          return next === null ? null : { soldierId: item.soldier.id, selection: next }
                        })
                      }
                    : null
                }
              />
              </li>
            ),
          )}
          </ul>
        </div>
      </div>
      {picking === null || pickedSoldier === undefined ? null : (
        <div className="pointer-events-none absolute inset-x-lg bottom-lg z-5 flex justify-center">
          <Tray
            labelKey="today.selection"
            action={[t('board.leaveFor'), fullName(pickedSoldier), daysText({ start_date: picking.selection.start, end_date: picking.selection.end })].join(SEPARATOR)}
            note={impact === null ? null : `${t('board.impactDay')} ${formatDate(impact.day, 'day')} · ${String(impact.present)}/${String(impact.total)}`}
            onAction={() => {
              panel.open(PANEL_IDS.leaves, {
                entity: NEW_ENTITY,
                draft: { soldier_id: picking.soldierId, start_date: picking.selection.start, end_date: picking.selection.end },
              })
              setPicking(null)
            }}
            clearKey="board.clearSelection"
            onClear={() => {
              setPicking(null)
            }}
          />
        </div>
      )}
      {drawerDay === null ? null : (
        <UnitDrawer
          name={unitName}
          day={drawerDay}
          onClose={() => {
            setDrawerDay(null)
          }}
        />
      )}
    </>
  )
}
