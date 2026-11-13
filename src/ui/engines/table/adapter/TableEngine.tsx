import type { BoardSortKey, SortOrder, TableSortKey } from '@config'
import { t, type I18nKey } from '@i18n'
import { boardEntries, defaultOrderOf, fullName, useSortRules, useTableSort, type BoardEntry } from '@logic'
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useMemo } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { formatDate } from '../../../patterns/dates'
import { EmptyNotice } from '../../../patterns/Notices'
import { BoardEngine, Centered, type BoardFrame } from '../../../board/BoardEngine'
import { EngineScroller } from '../../../board/EngineScroller'
import { groupLabel, leaveDays, leaveTone, statusText, typeName } from '../../../board/labels'

// The table view (D-174): one line per leave in the window, of the soldiers in view, sorted by any column. The soldier
// opens the soldier and the type opens the leave, as on every engine (D-119). The order is in the URL (D-214, D-313):
// the soldier and unit columns write the board's own sort rules, by name or by unit, and the leave columns their own
// key. Without a leave column's key, the lines keep the board's order.

const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns })
const column = createColumnHelper<typeof features, BoardEntry>()

const COLUMNS = column.columns([
  column.accessor((entry) => fullName(entry.soldier), { id: 'soldier', sortFn: 'text' }),
  column.accessor((entry) => (entry.group === null ? '' : groupLabel(entry.group)), { id: 'unit', sortFn: 'text' }),
  column.accessor((entry) => typeName(entry.leave), { id: 'type', sortFn: 'text' }),
  column.accessor((entry) => entry.leave.start_date, { id: 'from', sortFn: 'text' }),
  column.accessor((entry) => entry.leave.end_date, { id: 'to', sortFn: 'text' }),
  column.accessor((entry) => leaveDays(entry.leave), { id: 'days', sortFn: 'basic' }),
  column.accessor((entry) => statusText(entry.leave), { id: 'status', sortFn: 'text' }),
])

type ColumnId = 'soldier' | 'unit' | 'type' | 'from' | 'to' | 'days' | 'status'

const HEADER_KEYS: Record<ColumnId, I18nKey> = {
  soldier: 'engines.columns.soldier',
  unit: 'engines.columns.unit',
  type: 'engines.columns.type',
  from: 'engines.columns.from',
  to: 'engines.columns.to',
  days: 'engines.columns.days',
  status: 'engines.columns.status',
}

const COLUMN_IDS: readonly ColumnId[] = ['soldier', 'unit', 'type', 'from', 'to', 'days', 'status']

/** The column the table names, read back from its id. */
function columnOf(id: string): ColumnId {
  return COLUMN_IDS.find((known) => known === id) ?? 'soldier'
}

/** What a column sorts by: one of the board's keys for the soldier columns, a leave column's own key for the rest. */
const KEY_OF: Record<ColumnId, { readonly board: BoardSortKey } | { readonly table: TableSortKey }> = {
  soldier: { board: 'name' },
  unit: { board: 'unit' },
  type: { table: 'type' },
  from: { table: 'from' },
  to: { table: 'to' },
  days: { table: 'days' },
  status: { table: 'status' },
}

/** The column the lines are sorted by, and its direction; NULL when no column shows the order. */
function activeColumn(
  table: ReturnType<typeof useTableSort>,
  rules: ReturnType<typeof useSortRules>['rules'],
): { readonly id: ColumnId; readonly order: SortOrder } | null {
  if (table.key !== null) {
    const id = COLUMN_IDS.find((column) => { const key = KEY_OF[column]; return 'table' in key && key.table === table.key })
    return id === undefined ? null : { id, order: table.order }
  }
  const [first] = rules
  if (first === undefined || !('key' in first)) return null
  const id = COLUMN_IDS.find((column) => { const key = KEY_OF[column]; return 'board' in key && key.board === first.key })
  return id === undefined ? null : { id, order: first.order }
}

const CELL = 'border-b border-line px-md py-xs text-start align-middle'
const LINK =
  'min-h-touch cursor-pointer text-start outline-focus outline-offset-1 md:min-h-control data-focus-visible:outline-2 data-hovered:underline'

function Cell({ id, entry, frame }: { readonly id: ColumnId; readonly entry: BoardEntry; readonly frame: BoardFrame }) {
  const { leave, soldier } = entry
  switch (id) {
    case 'soldier': {
      const { openSoldier } = frame
      if (openSoldier === null) return <span className="font-medium">{fullName(soldier)}</span>
      return (
        <AriaButton
          className={`${LINK} font-medium`}
          onPress={() => {
            openSoldier(soldier.id)
          }}
        >
          {fullName(soldier)}
        </AriaButton>
      )
    }
    case 'unit':
      return <span className="text-text-muted">{entry.group === null ? '' : groupLabel(entry.group)}</span>
    case 'type':
      return (
        <AriaButton
          className={`${LINK} inline-flex items-center gap-xs`}
          onPress={() => {
            frame.openLeave(leave.id)
          }}
        >
          <span aria-hidden className={`size-dot shrink-0 rounded-pill ${leaveTone(leave, frame.colors).fill}`} />
          {typeName(leave)}
          {leave.effect === 'available' ? <span className="text-text-muted">{t('leaves.marker')}</span> : null}
        </AriaButton>
      )
    case 'from':
      return <span className="tabular-nums">{formatDate(leave.start_date)}</span>
    case 'to':
      return <span className="tabular-nums">{formatDate(leave.end_date)}</span>
    case 'days':
      return <span className="tabular-nums">{leaveDays(leave)}</span>
    case 'status':
      return (
        <span className={leave.status === 'pending' ? 'text-status-pending-text' : 'text-text-muted'}>{statusText(leave)}</span>
      )
  }
}

function LeavesTable({ frame }: { readonly frame: BoardFrame }) {
  const data = useMemo(() => boardEntries(frame.model), [frame.model])
  const tableSort = useTableSort()
  const { rules } = useSortRules()
  const active = activeColumn(tableSort, rules)
  // The soldier and unit columns keep the board's own order (D-214, D-313): its rows already come sorted by its rules,
  // so a link shows the same order in either engine.
  const sorting = useMemo(
    () => (active === null || tableSort.key === null ? [] : [{ id: active.id, desc: active.order === 'desc' }]),
    [active, tableSort.key],
  )
  const table = useTable({ features, columns: COLUMNS, data, getRowId: (entry) => entry.leave.id, state: { sorting } })
  if (data.length === 0) {
    return (
      <Centered>
        <EmptyNotice titleKey="engines.emptyLeavesTitle" bodyKey="engines.emptyLeavesBody" headingLevel={2} />
      </Centered>
    )
  }
  return (
    <EngineScroller labelKey="engines.tableLabel">
      {() => (
        <table className="w-full border-collapse text-name">
          {/* What a row is, in words: one leave, not one soldier as in the list (D-339). */}
          <caption className="px-lg py-sm text-start text-label text-text-muted">{t('engines.tableCaption')}</caption>
          <thead className="sticky top-under-bars z-10 bg-canvas md:top-under-bars-md">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const id = columnOf(header.column.id)
                  const sorted: SortOrder | null = id === active?.id ? active.order : null
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}
                      className={`${CELL} font-semibold whitespace-nowrap text-text-muted`}
                    >
                      <AriaButton
                        className={`${LINK} inline-flex items-center gap-xs`}
                        onPress={() => {
                          const key = KEY_OF[id]
                          const order: SortOrder | undefined = sorted === null ? undefined : sorted === 'asc' ? 'desc' : 'asc'
                          if ('table' in key) tableSort.sortBy(key.table, order)
                          else tableSort.sortRows({ key: key.board, order: order ?? defaultOrderOf({ key: key.board }) })
                        }}
                      >
                        {t(HEADER_KEYS[id])}
                        {sorted === 'asc' ? <ArrowUp aria-hidden size={12} /> : null}
                        {sorted === 'desc' ? <ArrowDown aria-hidden size={12} /> : null}
                      </AriaButton>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="bg-surface">
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className={CELL}>
                    <Cell id={columnOf(cell.column.id)} entry={row.original} frame={frame} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </EngineScroller>
  )
}

/** The table engine. */
export function TableEngine() {
  return <BoardEngine>{(frame) => <LeavesTable frame={frame} />}</BoardEngine>
}
