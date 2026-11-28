import { PANEL_IDS, VIRTUAL_LIST } from '@config'
import type { SoldierId } from '@contracts'
import { t } from '@i18n'
import { fullName, usePanel, type MyDay, type PeopleItem, type PeopleRow } from '@logic'
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual'
import { Check } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState, type FocusEvent, type ReactNode } from 'react'
import { Button as AriaButton, Checkbox } from 'react-aria-components'
import { groupLabel, headingLabel } from '../../board/labels'
import { useLongPress } from '../../board/gestures'
import { usePageScroll } from '../pageScroll'

// The rows of "חיילים" (D-482, D-491): on a phone, thin person rows on a white card per group; on a wide screen, a table
// whose columns are the name, the command rank, the unit, the tags and the next seven days. Either way only the rows in
// sight exist in the page (OI-403): a unit's list is hundreds of rows, a whole organization's thousands. The groups'
// headers scroll with the rows, as the handoff draws them (not sticky).

const SEPARATOR = ' · '

const DOT: Readonly<Record<MyDay['state'], string>> = {
  base: 'bg-text',
  round: 'border border-text-muted',
  away: 'border border-text-muted',
  pending: 'border border-dashed border-status-pending-line',
}

const TODAY_KEYS = {
  base: 'manage.people.todayBase',
  round: 'manage.people.todayAway',
  away: 'manage.people.todayAway',
  pending: 'manage.people.todayPending',
} as const

/** The next seven days as dots, today first and larger: filled on base, hollow at home (the handoff's person row). */
function Dots({ days }: { readonly days: readonly MyDay[] }) {
  const [first] = days
  return (
    <span className="flex shrink-0 items-center gap-2xs">
      {days.map((day, index) => (
        <span key={day.date} aria-hidden className={`shrink-0 rounded-full ${index === 0 ? 'size-sm' : 'size-dot'} ${DOT[day.state]}`} />
      ))}
      {first === undefined ? null : <span className="sr-only">{t(TODAY_KEYS[first.state])}</span>}
    </span>
  )
}

function detailOf(row: PeopleRow): string {
  return [
    ...(row.rank === null ? [] : [row.rank.title]),
    ...row.tags,
    ...(row.soldier.status === 'inactive' ? [t('manage.people.inactiveMark')] : []),
  ].join(SEPARATOR)
}

const ROW = 'flex min-h-touch w-full min-w-none items-center gap-sm px-lg py-xs text-start outline-focus -outline-offset-2 data-focus-visible:outline-2'

function RowText({ row }: { readonly row: PeopleRow }) {
  const detail = detailOf(row)
  return (
    <span className="flex min-w-none flex-1 items-baseline gap-sm">
      <span className="shrink-0 truncate text-body font-semibold">{fullName(row.soldier)}</span>
      {detail === '' ? null : <span className="min-w-none truncate text-small text-text-muted">{detail}</span>}
    </span>
  )
}

/** The check circle of a row while choosing. */
function CheckCircle({ chosen }: { readonly chosen: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex size-badge shrink-0 items-center justify-center rounded-full border ${chosen ? 'border-action-solid bg-action-solid text-on-action' : 'border-text-muted'}`}
    >
      {chosen ? <Check size={14} /> : null}
    </span>
  )
}

export interface Choosing {
  /** Whether the rows are checkboxes. */
  readonly on: boolean
  readonly chosen: ReadonlySet<SoldierId>
  readonly choose: (soldierId: SoldierId, chosen: boolean) => void
  /** A row held: choosing starts with it chosen. */
  readonly startWith: (soldierId: SoldierId) => void
}

/** A soldier's row on a phone: it opens the card; held, it starts choosing with this soldier chosen. */
function PersonButton({ row, onHold }: { readonly row: PeopleRow; readonly onHold: () => void }) {
  const panel = usePanel()
  const hold = useLongPress(onHold)
  return (
    <AriaButton
      onPointerDownCapture={hold.onPointerDown}
      onPointerMove={hold.onPointerMove}
      onPointerUpCapture={hold.onPointerUp}
      onPointerCancel={hold.onPointerCancel}
      onPress={() => {
        if (hold.consumed()) return
        panel.open(PANEL_IDS.soldiers, { entity: row.soldier.id })
      }}
      className={`${ROW} cursor-pointer data-hovered:bg-inner`}
    >
      <RowText row={row} />
      {row.days === null ? null : <Dots days={row.days} />}
    </AriaButton>
  )
}

/** The same row while choosing: a check circle at its start, and the row itself is the checkbox. */
function ChoiceRow({ row, chosen, onChange }: { readonly row: PeopleRow; readonly chosen: boolean; readonly onChange: (chosen: boolean) => void }) {
  return (
    <Checkbox isSelected={chosen} onChange={onChange} aria-label={fullName(row.soldier)} className={`${ROW} cursor-pointer data-selected:bg-action-soft`}>
      <CheckCircle chosen={chosen} />
      <RowText row={row} />
      {row.days === null ? null : <Dots days={row.days} />}
    </Checkbox>
  )
}

type Entry =
  | { readonly kind: 'heading'; readonly key: string; readonly label: string; readonly size: number }
  | { readonly kind: 'row'; readonly key: string; readonly row: PeopleRow; readonly first: boolean; readonly last: boolean }

/** The list as one run of entries: each group's header, then its rows, the first and the last of a card marked. */
function entriesOf(items: readonly PeopleItem[]): readonly Entry[] {
  return items.map((item, index): Entry => {
    if (item.kind === 'group') return { kind: 'heading', key: item.key, label: headingLabel(item.label), size: item.size }
    const before = items[index - 1]
    const after = items[index + 1]
    return { kind: 'row', key: item.key, row: item, first: before === undefined || before.kind === 'group', last: after === undefined || after.kind === 'group' }
  })
}

/**
 * The window of entries in sight, over the page's scroll: where the list starts inside what scrolls (under the head and
 * the search) is measured on every render, since what stands above it can change.
 */
function useWindowed(entries: readonly Entry[], estimate: (entry: Entry) => number) {
  const scroller = usePageScroll()
  const list = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)
  const [focused, setFocused] = useState<number | null>(null)
  /** Notes which row holds the keyboard, from the entry index its element carries. */
  const keepFocus = {
    onFocus: (event: FocusEvent) => {
      let element = event.target instanceof HTMLElement ? event.target : null
      while (element !== null && element.dataset.index === undefined) element = element.parentElement
      setFocused(element?.dataset.index === undefined ? null : Number(element.dataset.index))
    },
    onBlur: (event: FocusEvent) => {
      if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setFocused(null)
    },
  }
  useLayoutEffect(() => {
    const element = list.current
    const content = scroller?.firstElementChild ?? null
    if (scroller === null || element === null || content === null) return undefined
    const measure = () => {
      setOffset(element.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop)
    }
    measure()
    // What stands above the list (the search field) grows the page's content.
    const observer = new ResizeObserver(measure)
    observer.observe(content)
    return () => {
      observer.disconnect()
    }
  }, [scroller])
  // TanStack Virtual hands out new functions each render, and nothing here memoizes them.
  // oxlint-disable-next-line react/incompatible-library
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scroller,
    estimateSize: (index) => {
      const entry = entries[index]
      return entry === undefined ? VIRTUAL_LIST.estimatedRowPx : estimate(entry)
    },
    overscan: VIRTUAL_LIST.overscanRows,
    scrollMargin: offset,
    getItemKey: (index) => entries[index]?.key ?? index,
    // The row that holds the keyboard stays in the page while it scrolls out of sight, so the keyboard is never lost.
    rangeExtractor: (range) => {
      const indexes = defaultRangeExtractor(range)
      return focused === null || indexes.includes(focused) ? indexes : [...indexes, focused].toSorted((a, b) => a - b)
    },
  })
  return { list, virtualizer, offset, keepFocus }
}

/** Where a row of a card sits on the card: its corners, and the line under every row but the last. */
function cardEdges(entry: Extract<Entry, { kind: 'row' }>): string {
  return `bg-surface ${entry.first ? 'rounded-t-card' : ''} ${entry.last ? 'rounded-b-card' : 'border-b border-divider-strong'}`
}

/** A phone's list: thin rows on a white card per group. */
function PhoneRows({ entries, choosing }: { readonly entries: readonly Entry[]; readonly choosing: Choosing }) {
  const { list, virtualizer, offset, keepFocus } = useWindowed(entries, (entry) => (entry.kind === 'heading' ? VIRTUAL_LIST.headingPx : VIRTUAL_LIST.personRowPx))
  return (
    <div ref={list} {...keepFocus}>
      <ul className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const entry = entries[item.index]
          if (entry === undefined) return null
          return (
            <li
              key={item.key}
              ref={virtualizer.measureElement}
              data-index={item.index}
              aria-setsize={entries.length}
              aria-posinset={item.index + 1}
              className={`absolute inset-x-none top-none overflow-hidden ${entry.kind === 'row' ? cardEdges(entry) : ''}`}
              style={{ transform: `translateY(${String(item.start - offset)}px)` }}
            >
              {entry.kind === 'heading' ? (
                <h2 className="flex items-center justify-between gap-sm px-xs pt-lg pb-xs text-body font-bold">
                  <span className="min-w-none truncate">{entry.label}</span>
                  <span className="shrink-0 text-small font-normal text-text-muted tabular-nums">{entry.size}</span>
                </h2>
              ) : choosing.on ? (
                <ChoiceRow
                  row={entry.row}
                  chosen={choosing.chosen.has(entry.row.soldier.id)}
                  onChange={(on) => {
                    choosing.choose(entry.row.soldier.id, on)
                  }}
                />
              ) : (
                <PersonButton
                  row={entry.row}
                  onHold={() => {
                    choosing.startWith(entry.row.soldier.id)
                  }}
                />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const CELL = 'flex min-w-none items-center'
/** The name keeps a column's width and takes what is left; the others give way before it does, beside a side panel. */
const NAME = 'flex w-column shrink-0 grow items-center'
const COLUMN = `${CELL} w-column shrink`
const DAYS = 'flex shrink-0 items-center'

/** The table's header: the columns' names. */
function ColumnNames({ days }: { readonly days: boolean }) {
  const name = (key: Parameters<typeof t>[0], className: string) => (
    <span role="columnheader" className={`${className} text-small font-semibold text-text-muted`}>
      {t(key)}
    </span>
  )
  return (
    <div role="rowgroup">
      <div role="row" aria-rowindex={1} className="flex min-h-touch items-center gap-md px-lg">
        {name('manage.people.columns.name', NAME)}
        {name('manage.people.columns.rank', COLUMN)}
        {name('manage.people.columns.unit', COLUMN)}
        {name('manage.people.columns.tags', `${CELL} flex-1`)}
        {days ? name('manage.people.columns.days', DAYS) : null}
      </div>
    </div>
  )
}

/**
 * A row of the table (D-491). Its name is the control, so the keyboard and a reader reach the card or the choice there;
 * a press anywhere on the row does the same, and holding it starts choosing.
 */
function TableRow({ row, index, days, choosing }: { readonly row: PeopleRow; readonly index: number; readonly days: boolean; readonly choosing: Choosing }) {
  const panel = usePanel()
  const startWith = () => {
    choosing.startWith(row.soldier.id)
  }
  const hold = useLongPress(choosing.on ? null : startWith)
  const chosen = choosing.chosen.has(row.soldier.id)
  const open = () => {
    if (hold.consumed()) return
    if (choosing.on) choosing.choose(row.soldier.id, !chosen)
    else panel.open(PANEL_IDS.soldiers, { entity: row.soldier.id })
  }
  const name = fullName(row.soldier)
  const nameCell: ReactNode = choosing.on ? (
    <Checkbox isSelected={chosen} onChange={(on) => { choosing.choose(row.soldier.id, on) }} aria-label={name} className={`flex min-h-touch min-w-none cursor-pointer items-center gap-sm rounded-control ${FOCUS}`}>
      <CheckCircle chosen={chosen} />
      <span className="truncate text-body font-semibold">{name}</span>
    </Checkbox>
  ) : (
    <AriaButton
      onPress={() => {
        panel.open(PANEL_IDS.soldiers, { entity: row.soldier.id })
      }}
      className={`flex min-h-touch min-w-none cursor-pointer items-center rounded-control text-start ${FOCUS}`}
    >
      <span className="truncate text-body font-semibold">{name}</span>
    </AriaButton>
  )
  return (
    <div
      role="row"
      aria-rowindex={index}
      onPointerDown={hold.onPointerDown}
      onPointerMove={hold.onPointerMove}
      onPointerUp={hold.onPointerUp}
      onPointerCancel={hold.onPointerCancel}
      onClick={(event) => {
        // The name's own control answers its press; the rest of the row is the mouse's larger target.
        if (event.target instanceof Element && event.target.closest('button,label') !== null) return
        open()
      }}
      className={`flex min-h-touch cursor-pointer items-center gap-md px-lg hover:bg-inner ${chosen ? 'bg-action-soft' : ''}`}
    >
      <span role="cell" className={NAME}>
        {nameCell}
      </span>
      <span role="cell" className={`${COLUMN} text-body text-text-muted`}>
        <span className="truncate">{row.rank?.title ?? ''}</span>
      </span>
      <span role="cell" className={`${COLUMN} text-body text-text-muted`}>
        <span className="truncate">{groupLabel(row.unit)}</span>
      </span>
      <span role="cell" className={`${CELL} flex-1 text-small text-text-muted`}>
        <span className="truncate">{[...row.tags, ...(row.soldier.status === 'inactive' ? [t('manage.people.inactiveMark')] : [])].join(SEPARATOR)}</span>
      </span>
      {days ? (
        <span role="cell" className={DAYS}>
          {row.days === null ? null : <Dots days={row.days} />}
        </span>
      ) : null}
    </div>
  )
}

const FOCUS = 'outline-focus outline-offset-2 data-focus-visible:outline-2'

/** A wide screen's table: a header of columns, and each group's name as a row of its own across them. */
function TableRows({ entries, choosing, days }: { readonly entries: readonly Entry[]; readonly choosing: Choosing; readonly days: boolean }) {
  const { list, virtualizer, offset, keepFocus } = useWindowed(entries, (entry) => (entry.kind === 'heading' ? VIRTUAL_LIST.headingPx : VIRTUAL_LIST.tableRowPx))
  return (
    <div role="table" aria-label={t('manage.people.tableLabel')} aria-rowcount={entries.length + 1}>
      <ColumnNames days={days} />
      <div ref={list} role="rowgroup" className="relative" style={{ height: virtualizer.getTotalSize() }} {...keepFocus}>
        {virtualizer.getVirtualItems().map((item) => {
          const entry = entries[item.index]
          if (entry === undefined) return null
          return (
            <div
              key={item.key}
              ref={virtualizer.measureElement}
              data-index={item.index}
              className={`absolute inset-x-none top-none overflow-hidden ${entry.kind === 'row' ? cardEdges(entry) : ''}`}
              style={{ transform: `translateY(${String(item.start - offset)}px)` }}
            >
              {entry.kind === 'heading' ? (
                <div role="row" aria-rowindex={item.index + 2}>
                  <div role="cell">
                    <h2 className="flex items-center gap-sm px-xs pt-lg pb-xs text-body font-bold">
                      <span className="min-w-none truncate">{entry.label}</span>
                      <span className="shrink-0 text-small font-normal text-text-muted tabular-nums">{entry.size}</span>
                    </h2>
                  </div>
                </div>
              ) : (
                <TableRow row={entry.row} index={item.index + 2} days={days} choosing={choosing} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export interface PeopleRowsProps {
  readonly items: readonly PeopleItem[]
  readonly choosing: Choosing
  /** Whether the seven days show (the list's option). */
  readonly days: boolean
  /** A wide screen: the table (D-460). */
  readonly wide: boolean
}

export function PeopleRows({ items, choosing, days, wide }: PeopleRowsProps) {
  const entries = useMemo(() => entriesOf(items), [items])
  return (
    <div aria-label={t('manage.people.listLabel')} role="region">
      {wide ? <TableRows entries={entries} choosing={choosing} days={days} /> : <PhoneRows entries={entries} choosing={choosing} />}
    </div>
  )
}
