import { DAY_REPORT } from '@config'
import type { CalendarDate, LeaveType } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { fullName, type ReportSectionStatus, type UpcomingLeave } from '@logic'
import { formatDate } from '../../../patterns/dates'
import { typeNameOf } from '../../leaves/leaveText'
import { numberText } from './figures'

// The words of the board's lists (D-349): who leaves or returns, what waits, and how far today's report got.

const { separator } = DAY_REPORT.text

/** "דנה לוי · חופשה", and "ממתין לאישור" for a pending leave. */
export function upcomingText(item: UpcomingLeave, types: readonly LeaveType[]): string {
  return [fullName(item.soldier), typeNameOf(types.find((type) => type.id === item.leave.leave_type_id) ?? null), ...(item.pending ? [t('leaves.statusPending')] : [])].join(separator)
}

export const REPORT_STATUS_KEYS = {
  confirmed: 'dashboard.reportConfirmed',
  not_yet: 'dashboard.reportNotYet',
  changed_since: 'dashboard.reportChanged',
} as const satisfies Record<ReportSectionStatus['status'], I18nKey>

/** "נוכחים 40 · חסרים 12": the report's totals. */
export function reportTotals(present: number, absent: number): string {
  return [`${t('presence.present')} ${numberText(present)}`, `${t('presence.absent')} ${numberText(absent)}`].join(separator)
}

/** "עוד 4". */
export function moreText(count: number): string {
  return `${t('dashboard.more')} ${numberText(count)}`
}

/** "בקשה מדנה לוי". */
export function requestText(name: string): string {
  return `${t('dashboard.requestFrom')}${name}`
}

/** "יום ג׳ 12.3": a day of the week ahead. */
export function dayHeading(date: CalendarDate): string {
  return `${formatDate(date, 'weekdayShort')} ${formatDate(date, 'dayMonth')}`
}

/** "דוח 1 של 12.3". */
export function reportHeading(date: CalendarDate): string {
  return `${t('presence.openDay')} ${formatDate(date, 'dayMonth')}`
}
