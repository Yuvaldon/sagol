import { TIMELINE_LANES, TIMELINE_LAYOUT } from '@config'
import { t } from '@i18n'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useLayoutEffect, useRef, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { useIsDesktop } from '../../../patterns/media'
import { badgeStart, barSpan, laneTop, rowHeightFor } from '../core/lanes'
import { dayOffset, gridLayout, spansOf, type GridLayout } from '../core/layout'
import type {
  TimelineDayCell,
  TimelineGroupRow,
  TimelineHeatCell,
  TimelineMark,
  TimelineResourceRow,
  TimelineRowModel,
} from './model'

// The timeline grid of Stone 3 (D-077, D-108): a days header that floats under the bars, a name column
// that stays at the inline start, and rows that exist in the page only while in sight. Positions come from
// the core, as logical offsets, so the grid is right in RTL.

function useWidthOf(element: HTMLElement | null): number {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    if (element === null) return undefined
    // An observer reports the first size as soon as it starts.
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

const HEAT_TONES: Record<TimelineHeatCell['tone'], string> = {
  hard: 'bg-status-rejected text-on-action',
  soft: 'border-2 border-dashed border-status-pending bg-surface text-status-pending-text',
  none: '',
}

/**
 * The heat row under the days (D-141): a cell per day with the number of broken rules, solid when a hard rule breaks
 * and dashed when only soft ones do. A cell with something to show opens the rules of its day.
 */
function HeatRow({ cells, layout, heightPx }: { readonly cells: readonly TimelineHeatCell[]; readonly layout: GridLayout; readonly heightPx: number }) {
  return (
    <div role="group" aria-label={t('rules.heatRow')} className="relative" style={{ height: heightPx, width: layout.widthPx }}>
      <div
        className="sticky start-none z-4 flex h-full items-center bg-surface ps-md text-label font-semibold text-text-muted"
        style={{ width: layout.nameColumnPx }}
      >
        {t('rules.heatLabel')}
      </div>
      {cells.map((cell, index) => {
        const place = { insetInlineStart: dayOffset(layout, index) + TIMELINE_LANES.barInsetPx, width: layout.dayPx - 2 * TIMELINE_LANES.barInsetPx }
        if (cell.onOpen === null) return null
        return (
          <AriaButton
            key={cell.key}
            aria-label={cell.label}
            onPress={cell.onOpen}
            className={`absolute inset-y-2xs flex cursor-pointer items-center justify-center rounded-bar text-label font-bold tabular-nums outline-focus outline-offset-1 data-focus-visible:outline-2 ${HEAT_TONES[cell.tone]}`}
            style={place}
          >
            {cell.count}
          </AriaButton>
        )
      })}
    </div>
  )
}

function DaysHeader({
  days,
  layout,
  heat,
  heatPx,
}: {
  readonly days: readonly TimelineDayCell[]
  readonly layout: GridLayout
  readonly heat: readonly TimelineHeatCell[] | null
  readonly heatPx: number
}) {
  return (
    <div
      className="sticky top-under-bars z-3 bg-surface md:top-under-bars-md"
      style={{ height: TIMELINE_LAYOUT.headerPx + (heat === null ? 0 : heatPx), width: layout.widthPx }}
    >
      <div className="relative" style={{ height: TIMELINE_LAYOUT.headerPx, width: layout.widthPx }}>
      <div
        className="sticky start-none z-4 flex h-full items-center bg-surface ps-md text-label font-semibold text-text-muted"
        style={{ width: layout.nameColumnPx }}
      >
        {t('timeline.names')}
      </div>
      <div
        aria-hidden
        className="glass-card absolute inset-y-none end-none rounded-pill"
        style={{ insetInlineStart: layout.nameColumnPx }}
      >
        {days.map((day, index) => (
          <div
            key={day.key}
            className={`absolute inset-y-none flex items-center justify-center gap-xs text-label tabular-nums ${day.isToday ? 'font-bold text-text' : 'text-text-muted'}`}
            style={{ insetInlineStart: dayOffset(layout, index) - layout.nameColumnPx, width: layout.dayPx }}
          >
            <span>{day.weekday}</span>
            <span className={day.isToday ? 'inline-flex min-w-icon items-center justify-center rounded-pill bg-today px-xs text-on-action' : ''}>
              {day.dayNumber}
            </span>
          </div>
        ))}
      </div>
      </div>
      {heat === null ? null : <HeatRow cells={heat} layout={layout} heightPx={heatPx} />}
    </div>
  )
}

/** Column lines and today's band, behind every row. */
function Columns({ days, layout }: { readonly days: readonly TimelineDayCell[]; readonly layout: GridLayout }) {
  return (
    <div aria-hidden className="absolute inset-none">
      {days.map((day, index) => (
        <div
          key={day.key}
          className={`absolute inset-y-none border-s border-line ${day.isToday ? 'bg-today-band' : ''}`}
          style={{ insetInlineStart: dayOffset(layout, index), width: layout.dayPx }}
        />
      ))}
    </div>
  )
}

function GroupRow({ row, layout }: { readonly row: TimelineGroupRow; readonly layout: GridLayout }) {
  return (
    <div className="flex h-full items-end border-b border-line bg-canvas" style={{ width: layout.widthPx }}>
      <h2 className="sticky start-none flex items-baseline gap-sm px-md pb-xs text-label font-semibold text-text-muted">
        <span>{row.label}</span>
        <span className="tabular-nums">
          <span className="sr-only">{t('timeline.soldiersInGroup')} </span>
          {row.count}
        </span>
      </h2>
    </div>
  )
}

// A mark is a control that opens its leave (D-119). Its hit area fills the gap between lanes, so lanes never
// take each other's presses.
const MARK_BUTTON =
  'absolute z-1 cursor-pointer outline-focus outline-offset-1 before:absolute before:inset-x-none before:-inset-y-2xs data-focus-visible:outline-2'

/** A bar over its days: solid when approved, a dashed edge over a faint fill when pending (D-111). */
function Bar({ mark, layout, baseRowPx }: { readonly mark: TimelineMark; readonly layout: GridLayout; readonly baseRowPx: number }) {
  const { startPx, widthPx } = barSpan(layout, mark, mark.cut, TIMELINE_LANES)
  const form = mark.dashed ? `border-2 border-dashed ${mark.tone.edge} ${mark.tone.faint}` : mark.tone.fill
  const ends = `${mark.cut.start ? '' : 'rounded-s-bar'} ${mark.cut.end ? '' : 'rounded-e-bar'}`
  return (
    <AriaButton
      aria-label={mark.label}
      onPress={mark.onOpen}
      className={`${MARK_BUTTON} flex items-center gap-xs px-xs ${form} ${ends}`}
      style={{
        insetInlineStart: startPx,
        width: widthPx,
        top: laneTop(baseRowPx, mark.lane, TIMELINE_LANES),
        height: TIMELINE_LANES.barPx,
      }}
    >
      {mark.dot === null ? null : <span aria-hidden className={`size-dot shrink-0 rounded-pill ${mark.dot}`} />}
      {mark.caption === null ? null : (
        <span aria-hidden className="truncate text-micro font-medium text-text">
          {mark.caption}
        </span>
      )}
    </AriaButton>
  )
}

/**
 * A marker: a round badge with its icon on each of its days, over any bar (D-111). Every badge opens the leave by
 * pointer; the first one alone is in the tab order and read aloud, so a marker of five days is one control.
 */
function Badges({ mark, layout, baseRowPx }: { readonly mark: TimelineMark; readonly layout: GridLayout; readonly baseRowPx: number }) {
  const Icon = mark.Icon
  return Array.from({ length: mark.length }, (_, offset) => (
    <AriaButton
      key={offset}
      {...(offset === 0 ? { 'aria-label': mark.label } : { 'aria-hidden': true, excludeFromTabOrder: true })}
      onPress={mark.onOpen}
      className={`${MARK_BUTTON} flex items-center justify-center rounded-pill bg-surface shadow-rim ${mark.dashed ? 'border border-dashed' : 'border'} ${mark.tone.edge} ${mark.tone.ink}`}
      style={{
        insetInlineStart: badgeStart(layout, mark.start + offset, TIMELINE_LANES),
        top: laneTop(baseRowPx, mark.lane, TIMELINE_LANES),
        width: TIMELINE_LANES.barPx,
        height: TIMELINE_LANES.barPx,
      }}
    >
      {Icon === null ? null : <Icon aria-hidden size={12} strokeWidth={2.6} />}
    </AriaButton>
  ))
}

function ResourceRow({
  row,
  layout,
  baseRowPx,
}: {
  readonly row: TimelineResourceRow
  readonly layout: GridLayout
  readonly baseRowPx: number
}) {
  const name = (
    <span className="flex min-w-none items-baseline gap-xs">
      <span className="truncate text-name font-medium text-text">{row.name}</span>
      {row.detail === null ? null : <span className="shrink-0 text-micro text-text-muted">{row.detail}</span>}
    </span>
  )
  return (
    <div className="relative h-full" style={{ width: layout.widthPx }}>
      {spansOf(row.offDays, true).map((span) => (
        <div
          key={span.start}
          aria-hidden
          className="absolute inset-y-none bg-inner"
          style={{ insetInlineStart: dayOffset(layout, span.start), width: layout.dayPx * span.length }}
        />
      ))}
      <div className="sticky start-none z-2 flex h-full items-center bg-surface" style={{ width: layout.nameColumnPx }}>
        {row.onOpen === null ? (
          <span className="flex min-w-none px-md">{name}</span>
        ) : (
          <AriaButton
            onPress={row.onOpen}
            className="flex h-full min-w-none flex-1 cursor-pointer items-center px-md text-start outline-focus -outline-offset-2 data-focus-visible:outline-2 data-hovered:bg-inner"
          >
            {name}
          </AriaButton>
        )}
      </div>
      {row.marks.map((mark) =>
        mark.kind === 'bar' ? (
          <Bar key={mark.key} mark={mark} layout={layout} baseRowPx={baseRowPx} />
        ) : (
          <Badges key={mark.key} mark={mark} layout={layout} baseRowPx={baseRowPx} />
        ),
      )}
      {/* A hairline of its own, so the name keeps the whole height of the row as a touch target. */}
      <div aria-hidden className="absolute inset-x-none bottom-none z-3 h-hairline bg-line" />
      {row.offText === null ? null : <span className="sr-only">{row.offText}</span>}
    </div>
  )
}

export interface TimelineGridProps {
  readonly days: readonly TimelineDayCell[]
  readonly rows: readonly TimelineRowModel[]
  /** The heat row (D-141); NULL when the actor sees no rule. */
  readonly heat: readonly TimelineHeatCell[] | null
}

export function TimelineGrid({ days, rows, heat }: TimelineGridProps) {
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null)
  const list = useRef<HTMLUListElement>(null)
  const [listTop, setListTop] = useState(0)
  const layout = gridLayout(useWidthOf(scroller), days.length, TIMELINE_LAYOUT)
  // A name is a touch target on mobile, so the row grows there (OI-033).
  const rowPx = useIsDesktop() ? TIMELINE_LAYOUT.rowPx : TIMELINE_LAYOUT.rowTouchPx

  // Where the rows start inside what scrolls: under the bars and the days header, which grows with the heat row.
  const hasHeat = heat !== null
  useLayoutEffect(() => {
    if (list.current !== null) setListTop(list.current.offsetTop)
  }, [scroller, hasHeat, rowPx])

  // TanStack Virtual hands out new functions each render, and nothing here memoizes them.
  // oxlint-disable-next-line react/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller,
    estimateSize: (index) => {
      const row = rows[index]
      if (row === undefined || row.kind === 'group') return TIMELINE_LAYOUT.groupRowPx
      return rowHeightFor(rowPx, row.lanes, TIMELINE_LANES)
    },
    overscan: TIMELINE_LAYOUT.overscanRows,
    scrollMargin: listTop,
    getItemKey: (index) => rows[index]?.key ?? index,
  })

  // Sizes are cached by the virtualizer, so a screen that crosses the breakpoint lays the rows out again.
  useLayoutEffect(() => {
    virtualizer.measure()
  }, [virtualizer, rowPx, rows])

  return (
    <div
      ref={setScroller}
      role="region"
      aria-label={t('timeline.label')}
      // A region that scrolls must be reachable by keyboard.
      tabIndex={0}
      className="h-full overflow-auto overscroll-contain outline-focus -outline-offset-2 focus-visible:outline-2"
    >
      <div className="relative min-w-full" style={{ width: layout.widthPx }}>
        <div aria-hidden className="h-under-bars md:h-under-bars-md" />
        <DaysHeader days={days} layout={layout} heat={heat} heatPx={rowPx} />
        <ul ref={list} aria-label={t('timeline.names')} className="relative" style={{ height: virtualizer.getTotalSize() }}>
          <Columns days={days} layout={layout} />
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index]
            if (row === undefined) return null
            return (
              <li
                key={item.key}
                aria-setsize={rows.length}
                aria-posinset={item.index + 1}
                className="absolute inset-x-none top-none"
                style={{ height: item.size, transform: `translateY(${String(item.start - listTop)}px)` }}
              >
                {row.kind === 'group' ? (
                  <GroupRow row={row} layout={layout} />
                ) : (
                  <ResourceRow row={row} layout={layout} baseRowPx={rowPx} />
                )}
              </li>
            )
          })}
        </ul>
        {/* Room for the bottom bar on a phone, and for the floating "+" everywhere (D-115). */}
        <div aria-hidden className="h-above-bottom-bar" />
      </div>
    </div>
  )
}
