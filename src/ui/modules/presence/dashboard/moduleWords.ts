import type { DashboardMetricId, DashboardModule, DashboardModuleId, DashboardTemplateId } from '@contracts'
import type { I18nKey } from '@i18n'

// The dashboard's names for its modules, metrics and templates (D-349).

export const MODULE_KEYS = {
  stat: 'dashboard.addMetric',
  heat_map: 'dashboard.moduleHeatMap',
  presence_trend: 'dashboard.modulePresenceTrend',
  plan_vs_actual: 'dashboard.modulePlanVsActual',
  fairness_spread: 'dashboard.moduleFairnessSpread',
  presence_by_unit: 'dashboard.modulePresenceByUnit',
  home_distribution: 'dashboard.moduleHomeDistribution',
  home_by_type: 'dashboard.moduleHomeByType',
  upcoming: 'dashboard.moduleUpcoming',
  outstanding: 'dashboard.moduleOutstanding',
  report_status: 'dashboard.moduleReportStatus',
} as const satisfies Record<DashboardModuleId, I18nKey>

export const METRIC_KEYS = {
  present_today: 'dashboard.metricPresentToday',
  home_today: 'dashboard.metricHomeToday',
  serving: 'dashboard.metricServing',
  avg_home_days: 'dashboard.metricAvgHomeDays',
  fairness_gap: 'dashboard.metricFairnessGap',
  below_minimum_days: 'dashboard.metricBelowMinimumDays',
  plan_drift: 'dashboard.metricPlanDrift',
  awaiting_me: 'dashboard.metricAwaitingMe',
  unconfirmed_units: 'dashboard.metricUnconfirmedUnits',
} as const satisfies Record<DashboardMetricId, I18nKey>

export const TEMPLATE_KEYS = {
  leaves: 'dashboard.templateLeaves',
  control: 'dashboard.templateControl',
  report: 'dashboard.templateReport',
} as const satisfies Record<DashboardTemplateId, I18nKey>

/** A module's title: a big number is named by its metric. */
export function moduleTitleKey(module: DashboardModule): I18nKey {
  return module.module === 'stat' ? METRIC_KEYS[module.metric] : MODULE_KEYS[module.module]
}
