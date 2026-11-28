import { BOARD, DATE_WINDOW, NEW_ENTITY, PANEL_IDS } from '@config'
import type { CalendarDate, LeaveId, SoldierId } from '@contracts'
import { t } from '@i18n'
import {
  boardDays,
  dayRangeOf,
  fullName,
  impactOf,
  selectDay,
  selectionCovers,
  useAbsenceCheck,
  useBoardDay,
  useLeaveCreation,
  usePanel,
  useRoundMoves,
  type BoardItem,
  type BoardLeave,
  type DaySelection,
  type RoundMove,
} from '@logic'
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import type { BoardFrame } from '../../../board/BoardEngine'
import { daysText, headingLabel, leaveText } from '../../../board/labels'
import { usePinch, useSwipe, type PinchDirection } from '../../../board/gestures'
import { useScopeName } from '../../../board/scopeName'
import { Tray } from '../../../kit/Tray'
import { formatDate, formatDateRange } from '../../../patterns/dates'
import { useShellChrome } from '../../../shell/chrome'
import { UnitDrawer } from '../../../shell/today/UnitDrawer'
import { iconOf } from '../../../theme/icons'
import { rangeInWindow, type DragRow, type TimelineDrag } from '../core/drag'
import type { BoardDrag } from './boardDrag'
import { barLeaves, extraLanes, originalPlaces, runsOf, stateOf, type DayState } from './bars'
import { rowOffText } from './model'
import { useDrag, type DragGesture } from './useDrag'

// The timeline (the handoff's board spec, §3 "Timeline — who won't be here"; D-480, D-491): a row per person, the day
// strip fixed above the rows. Each row is one person bar (§1.10): on base dark, the leave round a quiet gray, an
// approved request lighter with its type's icon, a pending one amber. The leave round is part of the row, so a moved
// leave shows where it went, and while its move waits, where it was, as a dashed gap (OI-398). A day's header selects it
// and opens the unit's drawer on it; a name opens the person; a bar opens its leave card. Days on base in a row are
// picked for a new leave, and the tray then offers it, with the impact line when it would break a rule. No summary row
// and no threshold marking (§3).
// On a phone a week fits the screen, a swipe moves it and a pinch changes the range (OI-399); a bar is not dragged
// (D-458). On a wide screen the same bars are dragged by the mouse (D-143): a bar moves, its ends move its days, and a
// drag on days on base marks a new leave; the card of the drag says what the drop would do.

const FOCUS = 'outline-focus -outline-offset-2 data-focus-visible:outline-2'
const SEPARATOR = ' · '
const WORD = ' '
/** A run of days: the row's height, a canvas hairline before it to part it from the run before. */
const RUN = 'flex shrink-0 items-center'
const GAP = 'border-s-2 border-canvas first:border-s-0'
const ICON = 16

const LOOKS: Readonly<Record<Exclude<DayState, 'off'>, string>> = {
  base: 'bg-time-base',
  round: 'bg-time-round',
  approved: 'bg-time-approved text-time-label',
  pending: 'bg-time-pending text-time-label ring-1 ring-status-pending-line ring-inset',
}

/** The edge of a drag's ghost: what the drop would break (D-143). */
const GHOST_TONES = {
  ok: 'border-action-solid',
  soft: 'border-status-pending-line',
  hard: 'border-status-error',
  unknown: 'border-line',
} as const

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

/** What a leave's bar says aloud: its words, and where a moved leave of the round came from (OI-398). */
function barLabel(leave: BoardLeave, move: RoundMove | undefined): string {
  const text = leaveText(leave)
  if (move === undefined) return text
  return [text, `${t('leaves.movedFrom')}${formatDateRange(move.from.start_date, move.from.end_date)}`].join(SEPARATOR)
}

interface Picking {
  readonly soldierId: SoldierId
  readonly selection: DaySelection
}

/** What a drag on the row shows: the ghost of the days it covers, the mark it dims, and the edge of what it breaks. */
interface RowDrag {
  readonly drag: TimelineDrag
  readonly tone: keyof typeof GHOST_TONES
}

function Row({
  item,
  frame,
  dayPx,
  picking,
  onPick,
  consumed,
  moves,
  gesture,
  dragRow,
  dragged,
  nameColumnPx,
}: {
  readonly item: Extract<BoardItem, { kind: 'soldier' }>
  readonly frame: BoardFrame
  readonly dayPx: number
  readonly picking: Picking | null
  /** NULL where no leave can be asked for the person. */
  readonly onPick: ((day: CalendarDate) => void) | null
  /** Whether the press that just ended was a swipe, a pinch or a drag, and so no tap. */
  readonly consumed: () => boolean
  readonly moves: ReadonlyMap<LeaveId, RoundMove>
  /** A wide screen's drag: the gesture and what the row offers it; NULL on a phone. */
  readonly gesture: DragGesture | null
  readonly dragRow: DragRow | null
  readonly dragged: RowDrag | null
  readonly nameColumnPx: number
}) {
  const { days } = frame.model
  const leaves = frame.model.leaves.get(item.soldier.id)
  const runs = useMemo(() => runsOf(days, item.inScope, barLeaves(leaves ?? [], days), moves), [days, item, leaves, moves])
  const extra = useMemo(() => extraLanes(days, runs, leaves ?? []), [days, runs, leaves])
  const left = useMemo(() => originalPlaces(leaves ?? [], days, moves), [leaves, days, moves])
  const name = fullName(item.soldier)
  const offText = rowOffText(item, days)
  const detail = item.rank?.short_title ?? item.rank?.title ?? null
  const { openSoldier } = frame
  const selection = picking?.soldierId === item.soldier.id ? picking.selection : null
  const dimmed = dragged?.drag.markKey ?? null
  const ghost = dragged === null ? null : rangeInWindow(dragged.drag.range, days.length)
  return (
    <div
      className="flex min-h-touch items-center border-b border-divider-strong"
      // In the capture phase: a bar's button keeps its own press from reaching the row.
      onPointerDownCapture={
        gesture === null || dragRow === null
          ? undefined
          : (event) => {
              gesture.start(event, dragRow)
            }
      }
      onContextMenu={(event) => {
        // A held press picks up what it is on; the browser's menu would take it instead.
        if (gesture?.isHolding() === true) event.preventDefault()
      }}
    >
      <div
        className="sticky start-none z-2 flex shrink-0 flex-col justify-center self-stretch bg-canvas pe-sm ps-lg"
        style={{ width: nameColumnPx }}
      >
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
              // Days on base: picked one by one for a new leave; the person card and the form are the other paths.
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
                                  if (!consumed()) onPick(day)
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
                aria-label={barLabel(leave, moves.get(leave.id))}
                data-mark={leave.id}
                onPress={() => {
                  if (!consumed()) frame.openLeave(leave.id)
                }}
                className={`${RUN} ${GAP} cursor-pointer rounded-small ${FOCUS} ${dimmed === leave.id ? 'opacity-50' : ''}`}
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
          {/* Where a moved leave of the round was, while its move waits: a gap with a dashed edge (OI-398). */}
          {left.map((place) => (
            <span
              key={place.key}
              aria-hidden
              className="pointer-events-none absolute inset-y-none flex items-center"
              style={{ insetInlineStart: place.start * dayPx, width: place.length * dayPx }}
            >
              <span className="h-badge w-full rounded-small border-2 border-dashed border-status-pending-line bg-canvas" />
            </span>
          ))}
          {ghost === null || dragged === null ? null : (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-none flex items-center"
              style={{ insetInlineStart: ghost.start * dayPx, width: ghost.length * dayPx }}
            >
              <span className={`h-badge w-full rounded-small border-2 border-dashed bg-action-soft ${GHOST_TONES[dragged.tone]}`} />
            </span>
          )}
        </div>
        {/* What the bar cannot show, a leave over another or a marker on base, takes a lane of its own below it. */}
        {extra.map((lane, index) => (
          // A row's lanes never reorder, so their place is their key.
          // oxlint-disable-next-line react/no-array-index-key
          <div key={index} className="relative h-touch">
            {lane.map(({ leave, start, length }) => {
              const state: Exclude<DayState, 'off'> = leave.effect === 'available' ? 'approved' : stateOf(leave, moves)
              const Icon = leave.effect === 'available' || state === 'approved' ? iconOf(leave.type?.icon_key ?? null) : null
              return (
                <AriaButton
                  key={leave.id}
                  aria-label={barLabel(leave, moves.get(leave.id))}
                  data-mark={leave.id}
                  onPress={() => {
                    if (!consumed()) frame.openLeave(leave.id)
                  }}
                  className={`absolute inset-y-none flex cursor-pointer items-center rounded-small ${FOCUS} ${dimmed === leave.id ? 'opacity-50' : ''}`}
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

/** What a drag on a wide screen may do on a row: move its leaves the actor may edit, mark days for a new one (D-143). */
function dragRowOf(item: Extract<BoardItem, { kind: 'soldier' }>, frame: BoardFrame, drag: BoardDrag): DragRow {
  const { days } = frame.model
  const [first] = days
  const marks =
    first === undefined
      ? []
      : (frame.model.leaves.get(item.soldier.id) ?? []).flatMap((leave) => {
          const range = dayRangeOf(first, leave)
          const shown = rangeInWindow(range, days.length)
          if (shown === null) return []
          return [{ key: leave.id, range, cut: shown.cut, drag: drag.movable(leave.id) ? { resize: leave.effect !== 'available' } : null }]
        })
  return { key: item.soldier.id, creatable: drag.creatable(item.soldier.id), marks }
}

export interface PersonTimelineProps {
  readonly frame: BoardFrame
  /** Moves the week, from a swipe on a phone. */
  readonly onStep: (step: -1 | 1) => void
  /** Changes the range, from a pinch on a phone (OI-399); NULL where a pinch changes nothing. */
  readonly onPinch: ((direction: PinchDirection) => void) | null
  /** A wide screen's drag (D-143); NULL on a phone, where a bar is not dragged (D-458). */
  readonly drag: BoardDrag | null
  /** The name column: wider on a wide screen, for a name and its rank. */
  readonly nameColumnPx: number
}

export function PersonTimeline({ frame, onStep, onPinch, drag, nameColumnPx }: PersonTimelineProps) {
  const { day: selected, select } = useBoardDay()
  const panel = usePanel()
  const chrome = useShellChrome()
  const unitName = useScopeName()
  const [scroller, setScroller] = useState<HTMLElement | null>(null)
  const [content, setContent] = useState<HTMLElement | null>(null)
  const [drawerDay, setDrawerDay] = useState<CalendarDate | null>(null)
  const [picking, setPicking] = useState<Picking | null>(null)
  const width = useWidth(scroller)
  // The shell knows what scrolls, so the title's capsule and the tab in sight return it to its top.
  const { bindScroller: bindToShell } = chrome
  const bindScroller = useCallback(
    (element: HTMLElement | null) => {
      setScroller(element)
      bindToShell(element)
    },
    [bindToShell],
  )
  const wide = drag !== null
  // On a phone a week fits the width: a swipe sideways moves it (§1.4: "move in time"), as the arrows by the title do. A
  // longer range scrolls sideways instead. A wide screen's pointer drags bars, so it never swipes.
  const fits = frame.model.days.length <= DATE_WINDOW.days
  const swipe = useSwipe((direction) => {
    if (!fits || wide) return
    if (direction === 'right') onStep(1)
    if (direction === 'left') onStep(-1)
  })
  const pinch = usePinch(wide ? null : onPinch)
  const { days, today, items } = frame.model
  const stored = useMemo(() => [...frame.stored.values()], [frame.stored])
  const moves = useRoundMoves(stored)
  const soldiers = useMemo(() => items.flatMap((item) => (item.kind === 'soldier' ? [item.soldier] : [])), [items])
  const creation = useLeaveCreation(soldiers)
  const creatable = useMemo(() => new Set(creation.soldiers.map((soldier) => soldier.id)), [creation.soldiers])
  // The name column, and the page's margin at the inline end.
  const room = Math.max(0, width - nameColumnPx - BOARD.timeline.minDayPx)
  const dayPx = Math.max(BOARD.timeline.minDayPx, days.length === 0 ? 0 : Math.floor(room / days.length))
  const grid = useMemo(() => ({ nameColumnPx: nameColumnPx, dayPx, dayCount: days.length }), [nameColumnPx, dayPx, days.length])
  const gesture = useDrag(grid, { scroller, content }, drag?.props ?? null)
  const shown = gesture.active ?? drag?.props.held ?? null
  const consumed = () => {
    const swiped = swipe.consumed()
    const pinched = pinch.consumed()
    return swiped || pinched || gesture.pressIsDrag()
  }
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
        ref={bindScroller}
        role="region"
        aria-label={t('timeline.label')}
        // A region that scrolls must be reachable by keyboard.
        tabIndex={0}
        onScroll={(event) => {
          chrome.onScroll(event.currentTarget.scrollTop)
        }}
        onPointerDownCapture={(event) => {
          if (!wide) swipe.onPointerDown(event)
          pinch.onPointerDown(event)
        }}
        onPointerMoveCapture={pinch.onPointerMove}
        onPointerUpCapture={(event) => {
          if (!wide) swipe.onPointerUp(event)
          pinch.onPointerUp(event)
        }}
        onPointerCancel={(event) => {
          swipe.onPointerCancel()
          pinch.onPointerUp(event)
        }}
        // Two fingers change the range here, so the browser does not zoom the page under them (OI-399).
        className="h-full touch-pan-x touch-pan-y overflow-auto overscroll-contain outline-focus -outline-offset-2 focus-visible:outline-2"
      >
        <div ref={setContent} className={`w-max min-w-full pb-page-end ${gesture.active === null ? '' : 'select-none'}`}>
          <div role="group" aria-label={t('board.days')} className="sticky top-none z-3 flex bg-canvas pb-xs">
            <span aria-hidden className="sticky start-none z-4 shrink-0 bg-canvas" style={{ width: nameColumnPx }} />
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
                    nameColumnPx={nameColumnPx}
                    picking={picking}
                    consumed={consumed}
                    moves={moves}
                    gesture={drag === null ? null : gesture}
                    dragRow={drag === null ? null : dragRowOf(item, frame, drag)}
                    dragged={shown !== null && shown.rowKey === item.soldier.id ? { drag: shown, tone: drag?.props.tone ?? 'ok' } : null}
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
            note={impact === null ? null : `${t('board.impactDay')}${WORD}${formatDate(impact.day, 'day')} · ${String(impact.present)}/${String(impact.total)}`}
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
