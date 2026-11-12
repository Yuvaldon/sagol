import { DAY_REPORT, type DayReportCategory } from '@config'
import type { CalendarDate, LeaveType } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { fullName, type ReportEntry, type ReportWords } from '@logic'
import { groupLabel, TEXT_SEPARATOR } from '../../board/labels'
import { formatDate } from '../../patterns/dates'

// The words of the day report (D-195, D-196), shared by the dialog, the text copy and the image. Pure.

export const CATEGORY_KEYS: Record<DayReportCategory | 'total', I18nKey> = {
  total: 'presence.total',
  present: 'presence.present',
  absent: 'presence.absent',
  leaving: 'presence.leaving',
  returning: 'presence.returning',
}

const { separator: SEPARATOR, bullet: BULLET, details: DETAILS } = DAY_REPORT.text

const typeName = (type: LeaveType | null) => type?.name ?? t('leaves.unknownType')

/** The soldier's name and rank. */
export function entryName(entry: ReportEntry): string {
  const rank = entry.rank === null ? null : (entry.rank.short_title ?? entry.rank.title)
  return rank === null ? fullName(entry.soldier) : `${fullName(entry.soldier)} ${rank}`
}

/** Why the soldier is absent: the leaves' types and reasons (D-194). Empty for a present soldier. */
export function entryDetails(entry: ReportEntry): string {
  return [...entry.absences.map(typeName), ...entry.reasons].join(TEXT_SEPARATOR)
}

/** The header of a day: the report, its scope and the date. */
export function dayHeading(scope: string, date: CalendarDate): string {
  return [t('presence.title'), scope, formatDate(date, 'full')].join(SEPARATOR)
}

export function reportWords(scope: string): ReportWords {
  return {
    heading: (date) => dayHeading(scope, date),
    rotations: (rows) => (rows.length === 0 ? null : `${t('presence.rotations')} ${rows.map((row) => row.name).join(TEXT_SEPARATOR)}`),
    count: (category, value) => `${t(CATEGORY_KEYS[category])}: ${String(value)}`,
    list: (category, size) => `${t(CATEGORY_KEYS[category])} (${String(size)}):`,
    unit: groupLabel,
    entry: (entry, withReasons) => {
      const details = withReasons ? entryDetails(entry) : ''
      return `${BULLET}${entryName(entry)}${details === '' ? '' : `${DETAILS}${details}`}`
    },
    separator: SEPARATOR,
  }
}
