import type { DashboardMetricId, DashboardModule, LeaveType, UnitId } from '@contracts'
import { moduleState, outstandingOf, type Dashboard, type Loaded } from '@logic'
import { Card, type CardEdit } from './Card'
import { FairnessSpread, HomeByTypeChart, HomeDistribution, PlanVsActual, PresenceByUnit, PresenceTrend } from './Charts'
import { countedNote, moduleError, statFigure, unitNameOf } from './figures'
import { HeatMap } from './HeatMap'
import { OutstandingList, ReportStatusList, UpcomingList } from './Lists'
import { moduleKeyOf, moduleTitleKey } from './moduleWords'

// The board's cards in order (D-349): each module's width on the grid and its body.

const WIDE = new Set<DashboardModule['module']>(['heat_map', 'presence_trend', 'plan_vs_actual'])

/** A module's width: big numbers four to a row on desktop and two on a phone, the wide charts full width. */
function spanOf(module: DashboardModule): string {
  if (module.module === 'stat') return 'col-span-6 lg:col-span-3'
  return WIDE.has(module.module) ? 'col-span-12' : 'col-span-12 lg:col-span-6'
}

const ready = <T,>(value: Loaded<T> | null): T | null => (value !== null && value.status === 'ready' ? value.value : null)

function Stat({ metric, dashboard }: { readonly metric: DashboardMetricId; readonly dashboard: Dashboard }) {
  const figure = statFigure(metric, dashboard)
  if (figure === null) return null
  return (
    <div className="flex flex-col gap-2xs">
      <p className="text-title font-bold tabular-nums">{figure.signed ? <span dir="ltr">{figure.value}</span> : figure.value}</p>
      {figure.secondary === null ? null : <p className="text-name text-text-muted">{figure.secondary}</p>}
    </div>
  )
}

interface BodyProps {
  readonly module: DashboardModule
  readonly dashboard: Dashboard
  readonly types: readonly LeaveType[]
  readonly onUnit: (unitId: UnitId) => void
}

function Body({ module, dashboard, types, onUnit }: BodyProps) {
  const rules = ready(dashboard.rules)
  switch (module.module) {
    case 'stat':
      return <Stat metric={module.metric} dashboard={dashboard} />
    case 'heat_map':
      return <HeatMap dashboard={dashboard} unitName={unitNameOf(dashboard.scope.units, dashboard.scope.unitId)} />
    case 'presence_trend':
      return <PresenceTrend dashboard={dashboard} rules={rules} />
    case 'plan_vs_actual': {
      const plan = ready(dashboard.plan)
      return plan === null ? null : <PlanVsActual dashboard={dashboard} plan={plan} onUnit={onUnit} />
    }
    case 'fairness_spread':
      return <FairnessSpread dashboard={dashboard} onUnit={onUnit} />
    case 'presence_by_unit':
      return <PresenceByUnit dashboard={dashboard} rules={rules} onUnit={onUnit} />
    case 'home_distribution':
      return <HomeDistribution dashboard={dashboard} />
    case 'home_by_type':
      return <HomeByTypeChart dashboard={dashboard} />
    case 'upcoming':
      return <UpcomingList dashboard={dashboard} types={types} />
    case 'outstanding': {
      const outstanding = ready(outstandingOf(dashboard))
      return outstanding === null ? null : <OutstandingList dashboard={dashboard} outstanding={outstanding} />
    }
    case 'report_status': {
      const report = ready(dashboard.report)
      return report === null ? null : <ReportStatusList report={report} />
    }
  }
}

/** Whether a module counts the span's days, so its card says how many. */
const COUNTS = new Set<DashboardModule['module']>(['heat_map', 'plan_vs_actual', 'fairness_spread', 'home_distribution', 'home_by_type'])

const COUNTED_METRICS = new Set<DashboardMetricId>(['avg_home_days', 'fairness_gap', 'below_minimum_days', 'plan_drift'])

function noteOf(module: DashboardModule, dashboard: Dashboard): string | null {
  const counts = module.module === 'stat' ? COUNTED_METRICS.has(module.metric) : COUNTS.has(module.module)
  return counts ? countedNote(dashboard.tally.counted.length) : null
}

export interface BoardCardsProps {
  readonly modules: readonly DashboardModule[]
  readonly dashboard: Dashboard
  readonly types: readonly LeaveType[]
  readonly onUnit: (unitId: UnitId) => void
  /** In edit mode, every module of the list, the hidden ones too, so they can be moved or removed. */
  readonly editing: boolean
  readonly onMove: (index: number, offset: -1 | 1) => void
  readonly onRemove: (index: number) => void
}

export function BoardCards({ modules, dashboard, types, onUnit, editing, onMove, onRemove }: BoardCardsProps) {
  const last = modules.length - 1
  return (
    <div className="grid grid-cols-12 gap-sm">
      {modules.map((module, index) => {
        const state = moduleState(module, dashboard)
        if (state === 'hidden' && !editing) return null
        const edit: CardEdit | null = editing
          ? {
              onUp: index === 0 ? null : () => onMove(index, -1),
              onDown: index === last ? null : () => onMove(index, 1),
              onRemove: () => onRemove(index),
            }
          : null
        return (
          <Card
            key={moduleKeyOf(module)}
            titleKey={moduleTitleKey(module)}
            note={state === 'ready' ? noteOf(module, dashboard) : null}
            state={state}
            error={moduleError(module, dashboard)}
            edit={edit}
            span={spanOf(module)}
          >
            <Body module={module} dashboard={dashboard} types={types} onUnit={onUnit} />
          </Card>
        )
      })}
    </div>
  )
}
