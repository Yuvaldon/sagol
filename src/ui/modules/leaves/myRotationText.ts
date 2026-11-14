import { DAY_REPORT } from '@config'
import type { CalendarDate } from '@contracts'
import type { MyRotation } from '@logic'
import { t } from '@i18n'
import { formatDate } from '../../patterns/dates'

// "הסבב שלי" as text (D-350): each card's secondary line. Composed here so the cards hold no literals.

type MyRotationFigures = MyRotation['figures']

const NUMBER = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 })
const SPACE = ' '
const { separator } = DAY_REPORT.text

export const numberText = (value: number): string => NUMBER.format(value)

/** "מתוך {b} מתוכננים · {t} ימי סבב", or nothing when the rotation has no end. */
export function baseSecondary(figures: MyRotationFigures): string | null {
  const { planned } = figures.base
  if (planned === null || figures.total === null) return null
  return [
    [t('myRotation.outOf'), numberText(planned), t('myRotation.plannedSuffix')].join(SPACE),
    [numberText(figures.total), t('myRotation.rotationDays')].join(SPACE),
  ].join(separator)
}

/** "מתוך {h} מתוכננים", or nothing when the rotation has no end. */
export function homeSecondary(figures: MyRotationFigures): string | null {
  const { planned } = figures.home
  return planned === null ? null : [t('myRotation.outOf'), numberText(planned), t('myRotation.plannedSuffix')].join(SPACE)
}

/** "{p}% מהבקשות אושרו", or "—" with no decided request. */
export function approvalText(rate: number | null): string {
  if (rate === null) return t('myRotation.noRate')
  return [`${numberText(Math.round(rate * 100))}${t('rules.percent')}`, t('myRotation.approvedShare')].join(SPACE)
}

/** "בעוד {n} ימים". */
export function inDaysText(days: number): string {
  return [t('myRotation.inDays'), days === 1 ? t('leaves.oneDay') : [numberText(days), t('leaves.days')].join(SPACE)].join(SPACE)
}

export const dayText = (date: CalendarDate): string => formatDate(date, 'dayMonth')

/** "עד {date}". */
export const untilText = (date: CalendarDate): string => [t('myRotation.until'), dayText(date)].join(SPACE)

/** "בבית עד {date}". */
export const homeUntilText = (date: CalendarDate): string => [t('myRotation.homeUntil'), dayText(date)].join(SPACE)

/** "יום אחרון: {date}". */
export const lastDayText = (date: CalendarDate): string => [t('myRotation.lastDay'), dayText(date)].join(SPACE)

/** "הסבב מתחיל ב-{date}". */
export const startsText = (date: CalendarDate): string => `${t('myRotation.startsOn')}${dayText(date)}`

/** Parts of a line: "a · b". */
export const joinedText = (parts: readonly string[]): string => parts.join(separator)
