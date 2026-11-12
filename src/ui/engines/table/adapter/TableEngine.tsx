import { t, type I18nKey } from '@i18n'
import { boardEntries, fullName, type BoardEntry } from '@logic'
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
// opens the soldier and the type opens the leave, as on every engine (D-119).

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
  const table = useTable({ features, columns: COLUMNS, data, getRowId: (entry) => entry.leave.id })
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
          <thead className="sticky top-under-bars z-10 bg-canvas md:top-under-bars-md">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const id = columnOf(header.column.id)
                  const sorted = header.column.getIsSorted()
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
                          header.column.toggleSorting()
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
