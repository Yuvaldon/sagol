import { DASHBOARD, DAY_REPORT } from '@config'
import { t, type I18nKey } from '@i18n'
import { fullName, type Dashboard } from '@logic'
import { AlertTriangle, ArrowDown, ArrowUp } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { CopyActions } from '../CopyActions'
import { stepOf } from './chartData'
import { numberText } from './figures'
import {
  gapText,
  HEAT_DEFAULT_SORT,
  heatImageLines,
  heatText,
  sortRows,
  weekCellText,
  weekLabel,
  type HeatSort,
  type HeatSortKey,
} from './heatText'

// "מפת חום" (D-349, D-359): a soldier per row, a week per column, each cell shaded by the share of that week's
// served days spent at home. Shade, ink and dot density all step together, so the step is never color alone; the
// number sits in the cell for whoever reads it, and a screen reader hears the whole cell.

const CELL = 'border-b border-line px-xs py-2xs text-start align-middle'
const HEAD = `${CELL} sticky top-none bg-surface font-semibold whitespace-nowrap text-text-muted`
const SORTER =
  'inline-flex min-h-touch cursor-pointer items-center gap-2xs text-start outline-focus outline-offset-1 md:min-h-control data-focus-visible:outline-2 data-hovered:underline'
const NAME = 'sticky start-none w-heat-name max-w-heat-name truncate bg-surface'

const SHADES = [
  'bg-heat-0 text-heat-ink-0',
  'bg-heat-1 text-heat-ink-1 heat-pattern-1',
  'bg-heat-2 text-heat-ink-2 heat-pattern-2',
  'bg-heat-3 text-heat-ink-3 heat-pattern-3',
] as const

function SortHeader({
  sortKey,
  sort,
  onSort,
  sticky,
  children,
}: {
  readonly sortKey: HeatSortKey
  readonly sort: HeatSort
  readonly onSort: (sort: HeatSort) => void
  readonly sticky: boolean
  readonly children: ReactNode
}) {
  const active = sort.key === sortKey
  const ariaSort = !active ? 'none' : sort.ascending ? 'ascending' : 'descending'
  return (
    <th scope="col" aria-sort={ariaSort} className={sticky ? `${HEAD} ${NAME} z-3` : `${HEAD} z-2`}>
      <AriaButton className={SORTER} onPress={() => onSort({ key: sortKey, ascending: active ? !sort.ascending : true })}>
        {children}
        {active && sort.ascending ? <ArrowUp aria-hidden size={12} /> : null}
        {active && !sort.ascending ? <ArrowDown aria-hidden size={12} /> : null}
      </AriaButton>
    </th>
  )
}

const ROW_END: readonly { key: 'base' | 'home' | 'gap'; labelKey: I18nKey }[] = [
  { key: 'base', labelKey: 'dashboard.baseDays' },
  { key: 'home', labelKey: 'dashboard.homeDays' },
  { key: 'gap', labelKey: 'dashboard.gap' },
]

export function HeatMap({ dashboard, unitName }: { readonly dashboard: Dashboard; readonly unitName: string }) {
  const { rows, weeks, counted } = dashboard.tally
  const [sort, setSort] = useState<HeatSort>(HEAT_DEFAULT_SORT)
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort])
  const firstDay = counted[0]
  return (
    <div className="flex min-w-none flex-col gap-sm">
      <div className="max-h-sheet-height overflow-auto rounded-control border border-line">
        <table className="w-full border-collapse text-name">
          <caption className="sr-only">{t('dashboard.moduleHeatMap')}</caption>
          <thead>
            <tr>
              <SortHeader sortKey="name" sort={sort} onSort={setSort} sticky>
                {t('dashboard.soldier')}
              </SortHeader>
              {weeks.map((_, week) => (
                <SortHeader key={week} sortKey={week} sort={sort} onSort={setSort} sticky={false}>
                  {weekLabel(week)}
                </SortHeader>
              ))}
              {ROW_END.map((column) => (
                <SortHeader key={column.key} sortKey={column.key} sort={sort} onSort={setSort} sticky={false}>
                  {t(column.labelKey)}
                </SortHeader>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.soldier.id}>
                <th scope="row" className={`${CELL} ${NAME} z-1 font-normal`}>
                  {fullName(row.soldier)}
                </th>
                {weeks.map((_, week) => {
                  const tally = row.weeks[week]
                  if (tally === undefined || tally.served === 0)
                    return <td key={week} className={`${CELL} h-heat-cell w-heat-cell text-text-muted hatch-absence`} />
                  const shade = SHADES[stepOf(tally.home, tally.served, DASHBOARD.heatSteps)] ?? SHADES[0]
                  return (
                    <td key={week} className={`${CELL} h-heat-cell w-heat-cell text-center tabular-nums ${shade}`}>
                      <span aria-hidden>{numberText(tally.home)}</span>
                      <span className="sr-only">{weekCellText(row, week)}</span>
                    </td>
                  )
                })}
                <td className={`${CELL} tabular-nums`}>{numberText(row.tally.base)}</td>
                <td className={`${CELL} tabular-nums`}>{numberText(row.tally.home)}</td>
                <td className={`${CELL} tabular-nums`}>
                  <span className="inline-flex items-center gap-2xs">
                    <span dir="ltr">{gapText(row)}</span>
                    {row.beyond ? (
                      <>
                        <AlertTriangle aria-hidden size={12} className="text-status-pending-text" />
                        <span className="sr-only">{t('dashboard.beyondMark')}</span>
                      </>
                    ) : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {firstDay === undefined ? null : (
        <CopyActions
          text={() => heatText(sorted, unitName, counted)}
          lines={() => heatImageLines(sorted, unitName, counted)}
          firstDay={firstDay}
          fileStem={DAY_REPORT.image.heatFileStem}
          title={t('dashboard.moduleHeatMap')}
          copyKey="dashboard.copyText"
          imageKey="dashboard.copyImage"
        />
      )}
    </div>
  )
}
