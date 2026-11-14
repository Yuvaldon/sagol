import type { DashboardModule, DashboardTemplateId } from '@contracts'

// The command dashboard's templates and thresholds (D-349). A template is code, not data: an ordered list of modules,
// and a module the actor may not see is skipped when drawn, never removed from the template.

const stat = (metric: Extract<DashboardModule, { module: 'stat' }>['metric']): DashboardModule => ({ module: 'stat', metric })

export const DASHBOARD_TEMPLATES = {
  /** "ניהול יציאות": the platoon commanders who run the leaves. */
  leaves: [
    stat('present_today'),
    stat('home_today'),
    stat('awaiting_me'),
    stat('fairness_gap'),
    { module: 'heat_map' },
    { module: 'outstanding' },
    { module: 'upcoming' },
    { module: 'presence_trend' },
  ],
  /** "תכנון ובקרה": the company commander. */
  control: [
    stat('present_today'),
    stat('below_minimum_days'),
    stat('plan_drift'),
    stat('fairness_gap'),
    { module: 'plan_vs_actual' },
    { module: 'fairness_spread' },
    { module: 'presence_by_unit' },
    { module: 'presence_trend' },
    { module: 'home_distribution' },
    { module: 'heat_map' },
  ],
  /** "דוח יומי": the report owner. */
  report: [stat('present_today'), stat('home_today'), stat('unconfirmed_units'), { module: 'report_status' }, { module: 'upcoming' }, { module: 'presence_trend' }],
} as const satisfies Readonly<Record<DashboardTemplateId, readonly DashboardModule[]>>

export const DASHBOARD = {
  /** A soldier's home days beyond the median by more than this are marked. */
  fairGapDays: 2,
  /** The heat map's shades, by the share of a week's served days at home. */
  heatSteps: 4,
  /** How many days ahead "יוצאים וחוזרים" looks. */
  upcomingDays: 7,
  /** How many days ahead "ממתין לטיפול" looks for days that break a rule. */
  outstandingDays: 14,
  /** The bins of the home-days distribution. */
  distributionBins: 6,
  /** How many items "ממתין לטיפול" lists before "עוד {n}". */
  outstandingLimit: 10,
  /** How many direct sub-units with rows make the planning template the default. */
  controlMinUnits: 2,
} as const
