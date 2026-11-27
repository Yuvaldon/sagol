import { BOARD, DATE_WINDOW } from '@config'
import type { CalendarDate } from '@contracts'
import { t } from '@i18n'
import {
  FIRST_MOVEMENTS,
  boardDays,
  boardMovements,
  movementRuns,
  useBoardDay,
  useBoardWindow,
  useDateWindow,
  type BoardDay,
  type MovementDay,
  type MovementSide,
} from '@logic'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { BoardEngine, type BoardFrame } from '../../../board/BoardEngine'
import { BoardScreen, type BoardHeadProps } from '../../../board/BoardScreen'
import { RequestRow, RoundRow } from '../../../board/LeaveRows'
import { useScopeName } from '../../../board/scopeName'
import { formatDate, formatDateRange } from '../../../patterns/dates'
import { useIsDesktop } from '../../../patterns/media'
import { useShellChrome } from '../../../shell/chrome'
import { RequestsScope } from '../../../shell/today/RequestsScope'
import { UnitDrawer } from '../../../shell/today/UnitDrawer'

// The movements (the handoff's board spec, §3 "Movements — what's changing"; D-480; `view=list`): the days in one
// scroll both ways, each a header on the canvas ("ה׳ 26.11", today tagged) that opens the unit's drawer, and a card of
// who leaves and who returns, a name and its type, no dates. The leave round of a day and a direction is one row; a
// leave of it that moved shows on its new day alone. A run of days with no movement is one dashed line; today always
// shows. It opens on the selected day, today unless another was chosen, and reads more days as the scroll nears
// either end. The title follows the month at the top.

const DAY_ATTRIBUTE = 'data-day'
const FOCUS = 'outline-focus outline-offset-2 data-focus-visible:outline-2'
const WORD = ' '
/** How near an end, in pixels, the scroll asks for more days. */
const NEAR_PX = 480

function Side({
  titleKey,
  side,
  frame,
  counted,
  divided,
}: {
  readonly titleKey: 'board.out' | 'board.back'
  readonly side: MovementSide
  readonly frame: BoardFrame
  readonly counted: readonly BoardDay[]
  /** A hairline above: the second part of a card that has both. */
  readonly divided: boolean
}) {
  if (side.round.length === 0 && side.requests.length === 0) return null
  return (
    <section className={`flex flex-col pt-sm ${divided ? 'border-t border-divider-strong' : ''}`}>
      <h4 className="text-small font-semibold text-text-muted">{t(titleKey)}</h4>
      <ul className="flex flex-col">
        <RoundRow entries={side.round} tag={null} groupTag={null} frame={frame} counted={counted} />
        {side.requests.map((entry) => (
          <RequestRow key={entry.leave.id} entry={entry} tag={null} frame={frame} counted={counted} />
        ))}
      </ul>
    </section>
  )
}

function DayHeader({ day, today, onOpen }: { readonly day: CalendarDate; readonly today: CalendarDate; readonly onOpen: () => void }) {
  return (
    <h3 {...{ [DAY_ATTRIBUTE]: day }} className="flex scroll-mt-sm items-center gap-sm px-lg pt-lg pb-sm">
      <AriaButton
        onPress={onOpen}
        className={`flex min-h-touch cursor-pointer items-center gap-sm rounded-control text-heading font-bold tabular-nums ${FOCUS}`}
      >
        <span className="sr-only">{formatDate(day, 'full')}</span>
        {day === today ? (
          <span className="inline-flex min-h-badge items-center rounded-chip bg-action-solid px-sm text-small font-bold text-on-action">{t('board.todayTag')}</span>
        ) : null}
        <span aria-hidden>{[formatDate(day, 'weekdayNarrow'), formatDate(day, 'dayMonthDigits')].join(WORD)}</span>
      </AriaButton>
    </h3>
  )
}

function Quiet({ from, to }: { readonly from: CalendarDate; readonly to: CalendarDate }) {
  return (
    <p className="mx-lg my-sm flex min-h-touch items-center justify-center rounded-card border border-dashed border-line-dashed text-small text-text-muted tabular-nums">
      {[t('board.noMovement'), from === to ? formatDate(from, 'dayMonthDigits') : formatDateRange(from, to, 'dayMonthDigits')].join(' · ')}
    </p>
  )
}

function Day({ movement, frame, counted, onOpen }: { readonly movement: MovementDay; readonly frame: BoardFrame; readonly counted: readonly BoardDay[]; readonly onOpen: (day: CalendarDate) => void }) {
  const moves = movement.leaving.round.length + movement.leaving.requests.length + movement.returning.round.length + movement.returning.requests.length > 0
  return (
    <li>
      <DayHeader
        day={movement.day}
        today={frame.model.today}
        onOpen={() => {
          onOpen(movement.day)
        }}
      />
      {moves ? (
        <div className="mx-lg flex flex-col rounded-card bg-surface px-lg pb-xs">
          <Side titleKey="board.out" side={movement.leaving} frame={frame} counted={counted} divided={false} />
          <Side titleKey="board.back" side={movement.returning} frame={frame} counted={counted} divided={movement.leaving.round.length + movement.leaving.requests.length > 0} />
        </div>
      ) : (
        <Quiet from={movement.day} to={movement.day} />
      )}
    </li>
  )
}

interface Edges {
  /** The first month in sight, for the title. */
  readonly month: CalendarDate | null
  /** Whether today is out of sight. */
  readonly todayAway: boolean
}

function Movements({
  frame,
  onEdges,
  onNear,
  jump,
}: {
  readonly frame: BoardFrame
  readonly onEdges: (edges: Edges) => void
  readonly onNear: (end: 'before' | 'after') => void
  /** Asks the list to bring a day to its top: a counter, so the same day can be asked again. */
  readonly jump: { readonly day: CalendarDate; readonly count: number }
}) {
  const chrome = useShellChrome()
  const placed = useRef(false)
  const { settle } = chrome
  const unitName = useScopeName()
  const { select } = useBoardDay()
  const [drawerDay, setDrawerDay] = useState<CalendarDate | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const counted = useMemo(() => boardDays(frame.model), [frame.model])
  const runs = useMemo(() => movementRuns(boardMovements(counted), frame.model.today), [counted, frame.model.today])
  const first = frame.model.days[0]
  // Days read before the ones in sight push them down: the scroll keeps what was in sight where it was.
  const before = useRef<{ readonly first: CalendarDate | undefined; readonly height: number } | null>(null)
  useLayoutEffect(() => {
    const element = scroller.current
    const held = before.current
    if (element !== null && held !== null && held.first !== undefined && first !== undefined && first < held.first) {
      placed.current = true
      element.scrollTop += element.scrollHeight - held.height
      settle(element.scrollTop)
    }
    before.current = { first, height: element?.scrollHeight ?? 0 }
  }, [first, runs, settle])
  // A move the screen makes is not the reader's scroll: the tab bar stays.
  const scrollTo = useCallback((day: CalendarDate) => {
    const element = scroller.current
    const target = element?.querySelector(`[${DAY_ATTRIBUTE}="${day}"]`)
    if (element === null || element === undefined || target === null || target === undefined) return
    placed.current = true
    target.scrollIntoView({ block: 'start' })
    settle(element.scrollTop)
  }, [settle])
  // The day asked for comes to the top once it is drawn: on opening, and on "היום".
  const jumped = useRef(-1)
  useLayoutEffect(() => {
    if (jumped.current === jump.count) return
    jumped.current = jump.count
    scrollTo(jump.day)
  }, [jump, scrollTo])
  const read = useCallback(() => {
    const element = scroller.current
    if (element === null) return
    const top = element.getBoundingClientRect().top
    const headers = [...element.querySelectorAll<HTMLElement>(`[${DAY_ATTRIBUTE}]`)]
    const inSight = headers.find((header) => header.getBoundingClientRect().bottom > top)
    const today = headers.find((header) => header.getAttribute(DAY_ATTRIBUTE) === frame.model.today)
    const todayBox = today?.getBoundingClientRect()
    onEdges({
      month: inSight?.getAttribute(DAY_ATTRIBUTE) ?? null,
      todayAway: todayBox === undefined || todayBox.bottom < top || todayBox.top > element.getBoundingClientRect().bottom,
    })
    if (element.scrollTop < NEAR_PX) onNear('before')
    if (element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_PX) onNear('after')
  }, [frame.model.today, onEdges, onNear])
  useEffect(() => {
    read()
  }, [read, runs])
  return (
    <>
      <div
        ref={scroller}
        role="region"
        aria-label={t('board.movements')}
        // A region that scrolls must be reachable by keyboard.
        tabIndex={0}
        onScroll={(event) => {
          if (placed.current) placed.current = false
          else chrome.onScroll(event.currentTarget.scrollTop)
          read()
        }}
        className="h-full snap-y overflow-y-auto overscroll-contain outline-focus -outline-offset-2 focus-visible:outline-2"
      >
        <ol className="flex flex-col pb-page-end">
          {runs.map((run) =>
            run.kind === 'day' ? (
              <Day
                key={run.day.day}
                movement={run.day}
                frame={frame}
                counted={counted}
                onOpen={(day) => {
                  select(day)
                  setDrawerDay(day)
                }}
              />
            ) : (
              <li key={run.from}>
                <Quiet from={run.from} to={run.to} />
              </li>
            ),
          )}
        </ol>
      </div>
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

/** The movements engine. */
export function ListEngine() {
  const desktop = useIsDesktop()
  const [reach, setReach] = useState<{ readonly before: number; readonly after: number }>(FIRST_MOVEMENTS)
  const board = useBoardWindow('list', !desktop, reach)
  const { day, today } = useBoardDay()
  const { goToToday } = useDateWindow()
  const anchor = day ?? today
  const [edges, setEdges] = useState<Edges>({ month: null, todayAway: false })
  const [jump, setJump] = useState<{ readonly day: CalendarDate; readonly count: number } | null>(null)
  const shownJump = jump ?? (anchor === null ? null : { day: anchor, count: 0 })
  const onNear = useCallback((end: 'before' | 'after') => {
    setReach((current) => {
      const total = current.before + current.after + 1
      if (total >= DATE_WINDOW.maxDays) return current
      return end === 'before'
        ? { ...current, before: current.before + BOARD.movements.step }
        : { ...current, after: current.after + BOARD.movements.step }
    })
  }, [])
  const head: BoardHeadProps = {
    month: edges.month ?? anchor,
    steps: null,
    away: edges.todayAway,
    onToday: () => {
      goToToday()
      if (today === null) return
      setReach(FIRST_MOVEMENTS)
      setJump((current) => ({ day: today, count: (current?.count ?? 0) + 1 }))
    },
  }
  // The anchor moved by a choice elsewhere: read the first days around it again, and bring it to the top.
  const [held, setHeld] = useState(anchor)
  if (held !== anchor) {
    setHeld(anchor)
    setReach(FIRST_MOVEMENTS)
    if (anchor !== null) setJump((current) => ({ day: anchor, count: (current?.count ?? 0) + 1 }))
  }
  return (
    <BoardScreen head={head}>
      <RequestsScope>
        <BoardEngine window={board.window} today={today} keepLast>
          {(frame) =>
            anchor === null || shownJump === null ? null : (
              <Movements frame={frame} onEdges={setEdges} onNear={onNear} jump={shownJump} />
            )
          }
        </BoardEngine>
      </RequestsScope>
    </BoardScreen>
  )
}
