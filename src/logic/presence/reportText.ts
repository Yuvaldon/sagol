import { DAY_REPORT, DAY_REPORT_CATEGORIES, type DayReportCategory } from '@config'
import type { CalendarDate, Deployment } from '@contracts'
import type { BoardGroupLabel } from '../board/rows'
import type { DayReport, ReportCounts, ReportDay, ReportEntry, ReportLists } from './report'

// The day report as text for a messaging app (D-195): per day a bold header, the counts, then per unit its absent,
// leaving and returning names. The order lives in config and the words come from the caller's i18n. Pure.

/** The words of the text, in the viewer's language. */
export interface ReportWords {
  /** The header of a day: its date and the scope. */
  readonly heading: (date: CalendarDate) => string
  /** The rotations running on the day, or NULL for none. */
  readonly rotations: (rotations: readonly Deployment[]) => string | null
  /** One count: a category's name and its number, or the total's. */
  readonly count: (category: DayReportCategory | 'total', value: number) => string
  /** A list's title above its names. */
  readonly list: (category: DayReportCategory, size: number) => string
  readonly unit: (label: BoardGroupLabel) => string
  /** One soldier's line: the name, the rank and, while reasons show, why they are absent. */
  readonly entry: (entry: ReportEntry, withReasons: boolean) => string
  /** Joins the counts on one line. */
  readonly separator: string
}

type ListedCategory = (typeof DAY_REPORT.text.listed)[number]

const { lineStart, bold } = DAY_REPORT.text

const boldOf = (text: string) => `${bold}${text}${bold}`

function countsLine(counts: ReportCounts, words: ReportWords): string {
  return [words.count('total', counts.total), ...DAY_REPORT_CATEGORIES.map((category) => words.count(category, counts[category]))].join(
    words.separator,
  )
}

function listLines(lists: ReportLists, category: ListedCategory, words: ReportWords, withReasons: boolean): string[] {
  const entries = lists[category]
  if (entries.length === 0) return []
  return [words.list(category, entries.length), ...entries.map((entry) => words.entry(entry, withReasons))]
}

function dayLines(day: ReportDay, words: ReportWords, withReasons: boolean): string[] {
  return DAY_REPORT.text.sections.flatMap((section): string[] => {
    switch (section) {
      case 'header': {
        const rotations = words.rotations(day.rotations)
        return [boldOf(words.heading(day.date)), ...(rotations === null ? [] : [rotations])]
      }
      case 'counts':
        return [countsLine(day.counts, words)]
      case 'units':
        return day.units.flatMap((unit) => {
          const names = DAY_REPORT.text.listed.flatMap((category) => listLines(unit, category, words, withReasons))
          // A unit with nobody out says only its counts.
          return ['', boldOf(words.unit(unit.label)), countsLine(unit.counts, words), ...names]
        })
    }
  })
}

/** The text of the report: one block per day, every line marked right to left. */
export function reportText(report: DayReport, words: ReportWords, withReasons: boolean): string {
  const shows = withReasons && report.hasReasons
  return report.days
    .map((day) => dayLines(day, words, shows).map((line) => `${lineStart}${line}`).join('\n'))
    .join(`\n${lineStart}\n`)
}
