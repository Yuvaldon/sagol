import { DAY_REPORT } from '@config'
import type { CalendarDate } from '@contracts'
import { t } from '@i18n'
import { fullName, type DashboardRow } from '@logic'
import { formatDateRange } from '../../../patterns/dates'
import type { ImageLine } from '../reportImage'
import { numberText, signedText } from './figures'

// The heat map's order and its copies (D-349, D-359): the rows as the table shows them, as text for a messaging app
// and as the lines of an image, after the day report's (D-195, D-196). The copy holds what the actor sees, nothing more.

/** What the table sorts by: the name, a week (its index), or a row-end column. */
export type HeatSortKey = 'name' | 'base' | 'home' | 'gap' | number

export interface HeatSort {
  readonly key: HeatSortKey
  readonly ascending: boolean
}

/** Mostly on base first (D-349). */
export const HEAT_DEFAULT_SORT: HeatSort = { key: 'home', ascending: true }

const COLLATOR = new Intl.Collator('he')

/** The share of a week a soldier spent at home; NULL for a week with no served day, sorted last. */
const weekShare = (row: DashboardRow, week: number): number | null => {
  const tally = row.weeks[week]
  return tally === undefined || tally.served === 0 ? null : tally.home / tally.served
}

function valueOf(row: DashboardRow, key: HeatSortKey): number | null {
  if (typeof key === 'number') return weekShare(row, key)
  if (key === 'base') return row.tally.base
  if (key === 'home') return row.tally.home
  if (key === 'gap') return row.gap
  return null
}

/** The rows in the table's order; ties and blanks fall back to the name, and a blank sorts last either way. */
export function sortRows(rows: readonly DashboardRow[], sort: HeatSort): DashboardRow[] {
  const byName = (a: DashboardRow, b: DashboardRow) => COLLATOR.compare(fullName(a.soldier), fullName(b.soldier))
  const sign = sort.ascending ? 1 : -1
  return [...rows].sort((a, b) => {
    if (sort.key === 'name') return sign * byName(a, b)
    const left = valueOf(a, sort.key)
    const right = valueOf(b, sort.key)
    if (left === null || right === null) return left === right ? byName(a, b) : left === null ? 1 : -1
    return left === right ? byName(a, b) : sign * (left - right)
  })
}

/** A gap as text: signed, or nothing for a soldier out of the median. */
export function gapText(row: DashboardRow): string {
  return row.gap === null ? '' : signedText(row.gap)
}

const { lineStart, bold, separator, bullet } = DAY_REPORT.text

function titleOf(unitName: string, counted: readonly CalendarDate[]): string {
  const first = counted[0]
  const last = counted.at(-1)
  const range = first === undefined || last === undefined ? null : formatDateRange(first, last)
  return [t('dashboard.moduleHeatMap'), unitName, ...(range === null ? [] : [range])].join(separator)
}

function rowLine(row: DashboardRow): string {
  const parts = [
    `${t('dashboard.baseDays')} ${numberText(row.tally.base)}`,
    `${t('dashboard.homeDays')} ${numberText(row.tally.home)}`,
    ...(row.gap === null ? [] : [`${t('dashboard.gap')} ${signedText(row.gap)}`]),
  ]
  return `${fullName(row.soldier)}: ${parts.join(separator)}`
}

/** The table as text: a bold title, then one line per soldier in the table's order. */
export function heatText(rows: readonly DashboardRow[], unitName: string, counted: readonly CalendarDate[]): string {
  return [`${bold}${titleOf(unitName, counted)}${bold}`, ...rows.map((row) => `${bullet}${rowLine(row)}`)]
    .map((line) => `${lineStart}${line}`)
    .join('\n')
}

/** The table as the lines of an image, in the text's order. */
export function heatImageLines(rows: readonly DashboardRow[], unitName: string, counted: readonly CalendarDate[]): ImageLine[] {
  return [
    { text: titleOf(unitName, counted), style: 'title', gap: 'none' },
    ...rows.map((row, index): ImageLine => ({ text: rowLine(row), style: 'body', gap: index === 0 ? 'section' : 'none' })),
  ]
}

/** A week column's header: "שבוע 3". */
export function weekLabel(week: number): string {
  return `${t('dashboard.week')} ${numberText(week + 1)}`
}

/** What a week's cell says to a screen reader: "{name}, שבוע 3: 2 ימים בבית מתוך 7". */
export function weekCellText(row: DashboardRow, week: number): string {
  const tally = row.weeks[week]
  const days = tally === undefined ? '' : `${numberText(tally.home)} ${t('dashboard.homeOutOf')} ${numberText(tally.served)}`
  return `${fullName(row.soldier)}${separator}${weekLabel(week)}: ${days}`
}
