import { TIMELINE_LAYOUT } from '@config'
import { t } from '@i18n'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useLayoutEffect, useRef, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { useIsDesktop } from '../../../patterns/media'
import { dayOffset, gridLayout, spansOf, type GridLayout } from '../core/layout'
import type { TimelineDayCell, TimelineGroupRow, TimelineResourceRow, TimelineRowModel } from './model'

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

function DaysHeader({ days, layout }: { readonly days: readonly TimelineDayCell[]; readonly layout: GridLayout }) {
  return (
    <div
      className="sticky top-under-bars z-3 md:top-under-bars-md"
      style={{ height: TIMELINE_LAYOUT.headerPx, width: layout.widthPx }}
    >
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

function ResourceRow({ row, layout }: { readonly row: TimelineResourceRow; readonly layout: GridLayout }) {
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
      {/* A hairline of its own, so the name keeps the whole height of the row as a touch target. */}
      <div aria-hidden className="absolute inset-x-none bottom-none z-3 h-hairline bg-line" />
      {row.offText === null ? null : <span className="sr-only">{row.offText}</span>}
    </div>
  )
}

export interface TimelineGridProps {
  readonly days: readonly TimelineDayCell[]
  readonly rows: readonly TimelineRowModel[]
}

export function TimelineGrid({ days, rows }: TimelineGridProps) {
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null)
  const list = useRef<HTMLUListElement>(null)
  const [listTop, setListTop] = useState(0)
  const layout = gridLayout(useWidthOf(scroller), days.length, TIMELINE_LAYOUT)
  // A name is a touch target on mobile, so the row grows there (OI-033).
  const rowPx = useIsDesktop() ? TIMELINE_LAYOUT.rowPx : TIMELINE_LAYOUT.rowTouchPx

  // Where the rows start inside what scrolls: under the bars and the days header.
  useLayoutEffect(() => {
    if (list.current !== null) setListTop(list.current.offsetTop)
  }, [scroller])

  // TanStack Virtual hands out new functions each render, and nothing here memoizes them.
  // oxlint-disable-next-line react/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller,
    estimateSize: (index) => (rows[index]?.kind === 'group' ? TIMELINE_LAYOUT.groupRowPx : rowPx),
    overscan: TIMELINE_LAYOUT.overscanRows,
    scrollMargin: listTop,
    getItemKey: (index) => rows[index]?.key ?? index,
  })

  // Sizes are cached by the virtualizer, so a screen that crosses the breakpoint lays the rows out again.
  useLayoutEffect(() => {
    virtualizer.measure()
  }, [virtualizer, rowPx])

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
        <DaysHeader days={days} layout={layout} />
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
                {row.kind === 'group' ? <GroupRow row={row} layout={layout} /> : <ResourceRow row={row} layout={layout} />}
              </li>
            )
          })}
        </ul>
        <div aria-hidden className="h-above-bottom-bar md:h-lg" />
      </div>
    </div>
  )
}
