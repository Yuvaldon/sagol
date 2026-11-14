import type { UnitId } from '@contracts'
import { t } from '@i18n'
import { fullName, usePresenceDay, useRulesDay, type Dashboard, type DashboardPlan, type DashboardRules } from '@logic'
import { Button as AriaButton } from 'react-aria-components'
import { formatDate } from '../../../patterns/dates'
import { percentOf } from '../../../primitives/chartMath'
import { Segment, SrTable, Tick, Track } from '../../../primitives/charts'
import { leaveTypeToneOf } from '../../../theme/palette'
import { markedDays, trendColumns, typeBars, type TrendColumn } from './chartData'
import { numberText, percentText, rangeText, ratioText, signedText, unitNameOf } from './figures'

// The dashboard's charts (D-349, D-359): CSS bars on theme tokens, each with its figures as a hidden table. Time runs
// from the start edge, so in Hebrew the first day is on the right; bars grow from the start edge.

const STRIP =
  'flex w-full min-w-none cursor-pointer flex-col gap-2xs rounded-control px-xs py-xs text-start outline-focus -outline-offset-2 data-focus-visible:outline-2 data-hovered:bg-inner'
const MARK = { hard: 'bg-status-rejected text-on-action', soft: 'border border-dashed border-status-pending text-status-pending-text' } as const
const TREND_BAR =
  'relative h-full min-w-none flex-1 cursor-pointer outline-focus -outline-offset-1 data-focus-visible:outline-2 data-hovered:bg-inner'
const LEGEND_SWATCH = 'inline-block size-dot shrink-0 rounded-bar'

function Legend({ items }: { readonly items: readonly { readonly key: string; readonly label: string; readonly swatch: string }[] }) {
  return (
    <ul aria-hidden className="flex flex-wrap gap-x-md gap-y-2xs text-micro text-text-muted">
      {items.map((item) => {
        const className = `${LEGEND_SWATCH} ${item.swatch}`
        return (
          <li key={item.key} className="flex items-center gap-2xs">
            <span className={className} />
            {item.label}
          </li>
        )
      })}
    </ul>
  )
}

/** A trend bar as a screen reader hears it: "12.3: 40 נוכחים מתוך 52". */
const trendDayText = (column: TrendColumn) =>
  `${formatDate(column.day.date, 'dayMonth')}: ${numberText(column.day.present)} ${t('dashboard.present')} ${t('dashboard.outOf')} ${numberText(column.day.serving)}`

/** "נוכחות מול הנדרש": a column per counted day, the minimum as a step, the marked days below. */
export function PresenceTrend({ dashboard, rules }: { readonly dashboard: Dashboard; readonly rules: DashboardRules | null }) {
  const { openOn } = useRulesDay()
  const { reportable, openOn: openReport } = usePresenceDay()
  const { columns, top } = trendColumns(dashboard.tally.trend, rules)
  const marked = markedDays(columns)
  const first = columns.at(0)
  const last = columns.at(-1)
  const hasFuture = columns.some((column) => column.day.future)
  const hasMinimum = columns.some((column) => column.minimum !== null)
  const legend = [
    { key: 'present', label: t('dashboard.present'), swatch: 'bg-action-solid' },
    ...(hasFuture ? [{ key: 'planned', label: t('dashboard.plannedDays'), swatch: 'bg-plan' }] : []),
    ...(hasMinimum ? [{ key: 'minimum', label: t('dashboard.minimum'), swatch: 'bg-status-rejected' }] : []),
  ]
  return (
    <div className="flex flex-col gap-sm">
      {legend.length > 1 ? <Legend items={legend} /> : null}
      <div className="flex h-trend items-end gap-hairline border-b border-line">
        {columns.map((column) => {
          const tone = column.day.future ? 'bg-plan' : 'bg-action-solid'
          const bar = `absolute inset-x-none bottom-none rounded-t-bar ${tone}`
          const marks = (
            <>
              <span aria-hidden className={bar} style={{ blockSize: `${String(percentOf(column.day.present, top))}%` }} />
              {column.minimum === null ? null : (
                <span
                  aria-hidden
                  className="absolute inset-x-none h-hairline bg-status-rejected"
                  style={{ insetBlockEnd: `${String(percentOf(column.minimum, top))}%` }}
                />
              )}
            </>
          )
          return reportable(column.day.date) ? (
            <AriaButton
              key={column.day.date}
              aria-label={trendDayText(column)}
              className={TREND_BAR}
              onPress={() => openReport(column.day.date)}
            >
              {marks}
            </AriaButton>
          ) : (
            <div key={column.day.date} aria-hidden className="relative h-full min-w-none flex-1">
              {marks}
            </div>
          )
        })}
      </div>
      {first === undefined || last === undefined ? null : (
        <div aria-hidden className="flex justify-between text-micro text-text-muted tabular-nums">
          <span>{formatDate(first.day.date, 'dayMonth')}</span>
          <span>{formatDate(last.day.date, 'dayMonth')}</span>
        </div>
      )}
      {marked.length === 0 ? null : (
        <ul className="flex flex-wrap gap-xs" aria-label={t('dashboard.ruleBreak')}>
          {marked.map((day) => {
            const chip = `cursor-pointer rounded-pill px-sm py-2xs text-micro font-semibold outline-focus outline-offset-2 data-focus-visible:outline-2 ${MARK[day.worst]}`
            return (
              <li key={day.date}>
                <AriaButton className={chip} onPress={() => openOn(day.date)}>
                  {formatDate(day.date, 'dayMonth')}
                </AriaButton>
              </li>
            )
          })}
        </ul>
      )}
      <SrTable
        caption={t('dashboard.modulePresenceTrend')}
        head={[t('dashboard.day'), t('dashboard.present'), t('dashboard.serving'), t('dashboard.minimum')]}
        rows={columns.map((column) => ({
          key: column.day.date,
          cells: [
            formatDate(column.day.date, 'dayMonth'),
            numberText(column.day.present),
            numberText(column.day.serving),
            column.minimum === null ? '' : numberText(column.minimum),
          ],
        }))}
      />
    </div>
  )
}

/** "תכנון מול ביצוע": per group two bars and the difference, then what changed since the plan. */
export function PlanVsActual({
  dashboard,
  plan,
  onUnit,
}: {
  readonly dashboard: Dashboard
  readonly plan: DashboardPlan
  readonly onUnit: (unitId: UnitId) => void
}) {
  const top = Math.max(0, ...plan.groups.flatMap((group) => [group.planned, group.actual]))
  const groups = plan.groups.map((group) => {
    const name =
      group.soldier !== null
        ? fullName(group.soldier)
        : group.unitId === null
          ? t('dashboard.ownMembers')
          : unitNameOf(dashboard.scope.units, group.unitId)
    return { group, name, key: group.soldier?.id ?? group.unitId ?? 'own' }
  })
  const changes = `${t('dashboard.added')} ${numberText(plan.added)} · ${t('dashboard.cancelled')} ${numberText(plan.cancelled)} · ${t('dashboard.moved')} ${numberText(plan.moved)}`
  return (
    <div className="flex flex-col gap-sm">
      <Legend
        items={[
          { key: 'planned', label: t('dashboard.plannedDays'), swatch: 'bg-plan' },
          { key: 'actual', label: t('dashboard.actualDays'), swatch: 'bg-action-solid' },
        ]}
      />
      <ul className="flex flex-col">
        {groups.map(({ group, name, key }) => {
          const body = (
            <>
              <span className="flex w-full items-baseline gap-sm text-name">
                <span className="min-w-none flex-1 truncate">{name}</span>
                <span dir="ltr" className="text-micro text-text-muted tabular-nums">
                  {signedText(group.actual - group.planned)}
                </span>
              </span>
              <Track>
                <Segment to={percentOf(group.planned, top)} tone="bg-plan" />
              </Track>
              <Track>
                <Segment to={percentOf(group.actual, top)} tone="bg-action-solid" />
              </Track>
            </>
          )
          const { unitId } = group
          return (
            <li key={key}>
              {unitId === null ? (
                <div className="flex flex-col gap-2xs px-xs py-xs">{body}</div>
              ) : (
                <AriaButton className={STRIP} onPress={() => onUnit(unitId)}>
                  {body}
                </AriaButton>
              )}
            </li>
          )
        })}
      </ul>
      <p className="text-micro text-text-muted">{changes}</p>
      <SrTable
        caption={t('dashboard.modulePlanVsActual')}
        head={[t('dashboard.subUnit'), t('dashboard.plannedDays'), t('dashboard.actualDays')]}
        rows={groups.map(({ group, name, key }) => ({
          key,
          cells: [name, numberText(group.planned), numberText(group.actual)],
        }))}
      />
    </div>
  )
}

/** "הוגנות בין תת-יחידות": per sub-unit the range of home days, its median, and the unit's median across. */
export function FairnessSpread({ dashboard, onUnit }: { readonly dashboard: Dashboard; readonly onUnit: (unitId: UnitId) => void }) {
  const { subUnits, spread } = dashboard.tally
  const top = Math.max(0, ...subUnits.map((unit) => unit.spread?.max ?? 0))
  const strips = subUnits.map((unit) => ({ unit, name: unitNameOf(dashboard.scope.units, unit.unitId) }))
  return (
    <div className="flex flex-col gap-sm">
      <Legend
        items={[
          { key: 'range', label: t('dashboard.range'), swatch: 'bg-plan' },
          { key: 'median', label: t('dashboard.median'), swatch: 'bg-action-solid' },
          ...(spread === null ? [] : [{ key: 'unit', label: `${t('dashboard.median')} ${t('dashboard.unit')}`, swatch: 'bg-status-pending' }]),
        ]}
      />
      <ul className="flex flex-col">
        {strips.map(({ unit, name }) => (
          <li key={unit.unitId}>
            <AriaButton className={STRIP} onPress={() => onUnit(unit.unitId)}>
              <span className="flex w-full items-baseline gap-sm text-name">
                <span className="min-w-none flex-1 truncate">{name}</span>
                {unit.spread === null ? null : (
                  <span className="text-micro text-text-muted tabular-nums">
                    {rangeText(unit.spread.min, unit.spread.max)}
                  </span>
                )}
              </span>
              <Track>
                {unit.spread === null ? null : (
                  <>
                    <Segment from={percentOf(unit.spread.min, top)} to={percentOf(unit.spread.max, top)} tone="bg-plan" />
                    <Tick at={percentOf(unit.spread.median, top)} tone="bg-action-solid" />
                  </>
                )}
                {spread === null ? null : <Tick at={percentOf(spread.median, top)} tone="bg-status-pending" />}
              </Track>
            </AriaButton>
          </li>
        ))}
      </ul>
      <SrTable
        caption={t('dashboard.moduleFairnessSpread')}
        head={[t('dashboard.subUnit'), t('dashboard.fewest'), t('dashboard.median'), t('dashboard.most')]}
        rows={strips.map(({ unit, name }) => ({
          key: unit.unitId,
          cells: [
            name,
            unit.spread === null ? '' : numberText(unit.spread.min),
            unit.spread === null ? '' : numberText(unit.spread.median),
            unit.spread === null ? '' : numberText(unit.spread.max),
          ],
        }))}
      />
    </div>
  )
}

/** "נוכחות לפי תת-יחידה": present ÷ serving today per sub-unit, the strictest minimum as a tick. */
export function PresenceByUnit({
  dashboard,
  rules,
  onUnit,
}: {
  readonly dashboard: Dashboard
  readonly rules: DashboardRules | null
  readonly onUnit: (unitId: UnitId) => void
}) {
  const bars = dashboard.tally.subUnits.map((unit) => {
    const rule = rules?.today.get(unit.unitId) ?? null
    const minimum = rule?.highestMin ?? null
    const below = minimum !== null && unit.presentToday < minimum
    return { unit, name: unitNameOf(dashboard.scope.units, unit.unitId), minimum, below, worst: rule?.worst ?? null }
  })
  const hasMinimum = bars.some((bar) => bar.minimum !== null)
  return (
    <div className="flex flex-col gap-sm">
      {hasMinimum ? (
        <Legend
          items={[
            { key: 'present', label: t('dashboard.present'), swatch: 'bg-action-solid' },
            { key: 'minimum', label: t('dashboard.minimum'), swatch: 'bg-status-rejected' },
          ]}
        />
      ) : null}
      <ul className="flex flex-col">
        {bars.map(({ unit, name, minimum, below, worst }) => {
          const share = unit.servingToday > 0 ? percentText(unit.presentToday, unit.servingToday) : ''
          const mark = `rounded-pill px-xs text-micro font-semibold ${MARK[worst ?? 'hard']}`
          return (
            <li key={unit.unitId}>
              <AriaButton className={STRIP} onPress={() => onUnit(unit.unitId)}>
                <span className="flex w-full items-baseline gap-sm text-name">
                  <span className="min-w-none flex-1 truncate">{name}</span>
                  {below ? <span className={mark}>{t('dashboard.ruleBreak')}</span> : null}
                  <span className="text-micro text-text-muted tabular-nums">
                    {ratioText(unit.presentToday, unit.servingToday)} {share}
                  </span>
                </span>
                <Track>
                  <Segment to={percentOf(unit.presentToday, unit.servingToday)} tone="bg-action-solid" />
                  {minimum === null ? null : <Tick at={percentOf(minimum, unit.servingToday)} tone="bg-status-rejected" />}
                </Track>
              </AriaButton>
            </li>
          )
        })}
      </ul>
      <SrTable
        caption={t('dashboard.modulePresenceByUnit')}
        head={[t('dashboard.subUnit'), t('dashboard.present'), t('dashboard.serving'), t('dashboard.minimum')]}
        rows={bars.map(({ unit, name, minimum }) => ({
          key: unit.unitId,
          cells: [name, numberText(unit.presentToday), numberText(unit.servingToday), minimum === null ? '' : numberText(minimum)],
        }))}
      />
    </div>
  )
}

/** "התפלגות ימי בית": soldiers per range of home days, the median's range marked. */
export function HomeDistribution({ dashboard }: { readonly dashboard: Dashboard }) {
  const { distribution, spread } = dashboard.tally
  const top = Math.max(0, ...distribution.map((bin) => bin.soldiers))
  const bins = distribution.map((bin) => ({
    bin,
    label: rangeText(bin.from, bin.to),
    median: spread !== null && spread.median >= bin.from && spread.median <= bin.to,
  }))
  return (
    <div className="flex flex-col gap-sm">
      <Legend
        items={[
          { key: 'soldiers', label: t('dashboard.soldiers'), swatch: 'bg-action-solid' },
          { key: 'median', label: t('dashboard.median'), swatch: 'bg-status-pending' },
        ]}
      />
      <div aria-hidden className="flex h-trend items-end gap-xs border-b border-line">
        {bins.map(({ bin, median }) => {
          const tone = median ? 'bg-status-pending' : 'bg-action-solid'
          const bar = `w-full rounded-t-bar ${tone}`
          return (
            <div key={bin.from} className="flex h-full min-w-none flex-1 flex-col items-center justify-end gap-2xs">
              <span className="text-micro text-text-muted tabular-nums">{numberText(bin.soldiers)}</span>
              <div className={bar} style={{ blockSize: `${String(percentOf(bin.soldiers, top))}%` }} />
            </div>
          )
        })}
      </div>
      <div aria-hidden className="flex gap-xs text-micro text-text-muted tabular-nums">
        {bins.map(({ bin, label }) => (
          <span key={bin.from} className="min-w-none flex-1 truncate text-center">
            {label}
          </span>
        ))}
      </div>
      <SrTable
        caption={t('dashboard.moduleHomeDistribution')}
        head={[t('dashboard.range'), t('dashboard.soldiers')]}
        rows={bins.map(({ bin, label, median }) => ({
          key: String(bin.from),
          cells: [median ? `${label} (${t('dashboard.median')})` : label, numberText(bin.soldiers)],
        }))}
      />
    </div>
  )
}

/** "ימי בית לפי סוג": home days per type in the type's colour, largest first. */
export function HomeByTypeChart({ dashboard }: { readonly dashboard: Dashboard }) {
  const bars = typeBars(dashboard.tally.homeByType)
  const top = Math.max(0, ...bars.map((bar) => bar.days))
  return (
    <div className="flex flex-col gap-sm">
      <ul className="flex flex-col gap-xs">
        {bars.map((bar) => (
          <li key={bar.key} className="flex flex-col gap-2xs">
            <span className="flex items-baseline gap-sm text-name">
              <span className="min-w-none flex-1 truncate">{bar.name}</span>
              <span className="text-micro text-text-muted tabular-nums">{numberText(bar.days)}</span>
            </span>
            <Track>
              <Segment to={percentOf(bar.days, top)} tone={leaveTypeToneOf(bar.colorKey).fill} />
            </Track>
          </li>
        ))}
      </ul>
      <SrTable
        caption={t('dashboard.moduleHomeByType')}
        head={[t('dashboard.type'), t('dashboard.homeDays')]}
        rows={bars.map((bar) => ({ key: bar.key, cells: [bar.name, numberText(bar.days)] }))}
      />
    </div>
  )
}
