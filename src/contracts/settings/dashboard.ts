import { z } from 'zod'

// The command dashboard's stored shape (D-349): which modules a board holds, never a figure. The catalogue, the
// metrics of the big-number module and the templates are vocabularies; a template's modules are config.

/** The module catalogue, in the spec's order. */
export const DASHBOARD_MODULE_IDS = [
  'stat',
  'heat_map',
  'presence_trend',
  'plan_vs_actual',
  'fairness_spread',
  'presence_by_unit',
  'home_distribution',
  'home_by_type',
  'upcoming',
  'outstanding',
  'report_status',
] as const
export const DashboardModuleId = z.enum(DASHBOARD_MODULE_IDS)
export type DashboardModuleId = z.infer<typeof DashboardModuleId>

/** What one big-number module counts. */
export const DASHBOARD_METRIC_IDS = [
  'present_today',
  'home_today',
  'serving',
  'avg_home_days',
  'fairness_gap',
  'below_minimum_days',
  'plan_drift',
  'awaiting_me',
  'unconfirmed_units',
] as const
export const DashboardMetricId = z.enum(DASHBOARD_METRIC_IDS)
export type DashboardMetricId = z.infer<typeof DashboardMetricId>

export const DASHBOARD_TEMPLATE_IDS = ['leaves', 'control', 'report'] as const
export const DashboardTemplateId = z.enum(DASHBOARD_TEMPLATE_IDS)
export type DashboardTemplateId = z.infer<typeof DashboardTemplateId>

/** The most modules one board holds. */
export const DASHBOARD_MAX_MODULES = 20

/** One module on a board: a big number names its metric; any other module is just its id. */
export const DashboardModule = z.discriminatedUnion('module', [
  z.strictObject({ module: z.literal('stat'), metric: DashboardMetricId }),
  z.strictObject({ module: DashboardModuleId.exclude(['stat']) }),
])
export type DashboardModule = z.infer<typeof DashboardModule>

/** What makes two modules the same on one board: the module, and a big number's metric. */
const sameModuleKey = (item: DashboardModule): string => (item.module === 'stat' ? `stat:${item.metric}` : item.module)

/** A board's modules as written: known ids only, no repeat, at most `DASHBOARD_MAX_MODULES` (D-349). */
export const StrictDashboardModules = z
  .array(DashboardModule)
  .max(DASHBOARD_MAX_MODULES)
  .refine((items) => new Set(items.map(sameModuleKey)).size === items.length, { message: 'repeated module' })

/**
 * A board's modules as read: an item no longer in the vocabulary is dropped and a repeat keeps the first, so a
 * stored row always parses when a module is removed from the catalogue (D-349).
 */
export const DashboardModules = z.preprocess((raw) => {
  if (!Array.isArray(raw)) return raw
  const seen = new Set<string>()
  const kept: DashboardModule[] = []
  for (const candidate of raw) {
    const parsed = DashboardModule.safeParse(candidate)
    if (!parsed.success) continue
    const key = sameModuleKey(parsed.data)
    if (seen.has(key)) continue
    seen.add(key)
    kept.push(parsed.data)
  }
  return kept.slice(0, DASHBOARD_MAX_MODULES)
}, StrictDashboardModules)

const templateLayout = z.strictObject({ kind: z.literal('template'), template: DashboardTemplateId })

/** A stored board as written: a template, or a custom list of modules. */
export const StrictDashboardLayout = z.discriminatedUnion('kind', [
  templateLayout,
  z.strictObject({ kind: z.literal('custom'), modules: StrictDashboardModules }),
])

/** A stored board as read; a layout that no longer parses (a removed template) reads as the default. */
export const DashboardLayout = z.discriminatedUnion('kind', [
  templateLayout,
  z.strictObject({ kind: z.literal('custom'), modules: DashboardModules }),
])
export type DashboardLayout = z.infer<typeof DashboardLayout>
