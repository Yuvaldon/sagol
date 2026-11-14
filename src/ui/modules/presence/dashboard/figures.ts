import type { AppError, DashboardMetricId, DashboardModule, Unit, UnitId } from '@contracts'
import { t } from '@i18n'
import { outstandingOf, type Dashboard, type Loaded } from '@logic'
import { DAY_REPORT } from '@config'
import { formatDate, formatDateRange } from '../../../patterns/dates'

// The dashboard's figures as text (D-349): the big numbers with their secondary lines, and the words the charts share.

const NUMBER = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 1 })
const MINUS = '−'
const PLUS = '+'

/** A count or a mean, one decimal at most. */
export function numberText(value: number): string {
  return NUMBER.format(value)
}

/** A signed difference: "+3", "−3", "0". Shown inside a `dir="ltr"` span, so the sign stays before the number. */
export function signedText(value: number): string {
  if (value > 0) return `${PLUS}${numberText(value)}`
  if (value < 0) return `${MINUS}${numberText(-value)}`
  return numberText(0)
}

const DASH = '–'
const SLASH = '/'

/** "3–7", or "3" when both ends meet. */
export function rangeText(from: number, to: number): string {
  return from === to ? numberText(from) : `${numberText(from)}${DASH}${numberText(to)}`
}

/** "12/40": a part of a whole. */
export function ratioText(part: number, whole: number): string {
  return `${numberText(part)}${SLASH}${numberText(whole)}`
}

/** "{n}%", rounded. */
export function percentText(value: number, max: number): string {
  return `${String(Math.round((value / max) * 100))}${t('rules.percent')}`
}

/** A big number: the figure, whether it is a signed difference, and its secondary line. */
export interface StatFigure {
  readonly value: string
  readonly signed: boolean
  readonly secondary: string | null
}

const shareOfServing = (value: number, serving: number) =>
  serving > 0 ? `${percentText(value, serving)} ${t('dashboard.ofServing')}` : null

const ready = <T>(value: Loaded<T> | null): T | null => (value !== null && value.status === 'ready' ? value.value : null)

/** A metric's figure; NULL while what it reads is not ready (the card shows that instead). */
export function statFigure(metric: DashboardMetricId, dashboard: Dashboard): StatFigure | null {
  const { figures, spread } = dashboard.tally
  const plain = (value: number, secondary: string | null): StatFigure => ({ value: numberText(value), signed: false, secondary })
  switch (metric) {
    case 'present_today':
      return plain(figures.presentToday, shareOfServing(figures.presentToday, figures.servingToday))
    case 'home_today':
      return plain(figures.homeToday, shareOfServing(figures.homeToday, figures.servingToday))
    case 'serving':
      return plain(figures.rows, figures.holdsToday ? `${numberText(figures.servingToday)} ${t('dashboard.servingToday')}` : null)
    case 'avg_home_days':
      if (figures.meanHome === null) return null
      return plain(figures.meanHome, spread === null ? null : `${t('dashboard.median')} ${numberText(spread.median)}`)
    case 'fairness_gap':
      if (spread === null) return null
      return plain(spread.max - spread.min, `${numberText(figures.beyond)} ${t('dashboard.beyond')}`)
    case 'below_minimum_days': {
      const rules = ready(dashboard.rules)
      if (rules === null) return null
      return plain(rules.belowDays, rules.nextBelow === null ? null : `${t('dashboard.next')} ${formatDate(rules.nextBelow, 'dayMonth')}`)
    }
    case 'plan_drift': {
      const plan = ready(dashboard.plan)
      if (plan === null) return null
      return {
        value: signedText(plan.actual - plan.planned),
        signed: true,
        secondary: `${numberText(plan.added + plan.cancelled + plan.moved)} ${t('dashboard.changes')}`,
      }
    }
    case 'awaiting_me': {
      const requests = ready(dashboard.requests)
      return requests === null ? null : plain(requests.length, null)
    }
    case 'unconfirmed_units': {
      const report = ready(dashboard.report)
      if (report === null) return null
      return plain(report.unconfirmed, `${t('dashboard.outOf')} ${numberText(report.sections.length)}`)
    }
  }
}

const failed = <T>(value: Loaded<T> | null): AppError | null => (value !== null && value.status === 'failed' ? value.error : null)

/** Why a module could not be drawn: the read it needs failed. */
export function moduleError(module: DashboardModule, dashboard: Dashboard): AppError | null {
  if (module.module === 'stat') {
    switch (module.metric) {
      case 'below_minimum_days':
        return failed(dashboard.rules)
      case 'plan_drift':
        return failed(dashboard.plan)
      case 'awaiting_me':
        return failed(dashboard.requests)
      case 'unconfirmed_units':
        return failed(dashboard.report)
      default:
        return null
    }
  }
  switch (module.module) {
    case 'plan_vs_actual':
      return failed(dashboard.plan)
    case 'outstanding':
      return failed(outstandingOf(dashboard))
    case 'report_status':
      return failed(dashboard.report)
    default:
      return null
  }
}

/** A sub-unit's name, from the units the board may pick. */
export function unitNameOf(units: readonly Unit[], unitId: UnitId): string {
  return units.find((unit) => unit.id === unitId)?.name ?? t('workspace.unitUnavailable')
}

/** "לפי {n} ימים": what a card counts. */
export function countedNote(days: number): string {
  return `${t('dashboard.countedBy')} ${numberText(days)} ${t('leaves.days')}`
}

/** What the board counts: the rotation's name and its dates, or the routine range. */
export function spanText(dashboard: Dashboard): string {
  const { rotation, window } = dashboard.scope
  const range = formatDateRange(window.from, window.to)
  return rotation === null ? range : [rotation.name, range].join(DAY_REPORT.text.separator)
}
