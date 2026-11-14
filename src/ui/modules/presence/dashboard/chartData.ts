import type { CalendarDate, LeaveType } from '@contracts'
import type { DashboardRules, HomeByType, TrendDay } from '@logic'

// What the dashboard's charts draw, worked out before the JSX (D-349, D-359).

/** A day of the trend: its bar, the minimum the rules ask, and the mark of a broken rule. */
export interface TrendColumn {
  readonly day: TrendDay
  readonly minimum: number | null
  readonly worst: 'hard' | 'soft' | null
}

/** The trend's columns and the top of its scale: the most serving, or a higher minimum. */
export function trendColumns(trend: readonly TrendDay[], rules: DashboardRules | null): { columns: TrendColumn[]; top: number } {
  let top = 0
  const columns = trend.map((day): TrendColumn => {
    const rule = rules?.days.get(day.date) ?? null
    const minimum = rule?.lowestMin ?? null
    top = Math.max(top, day.serving, minimum ?? 0)
    return { day, minimum, worst: rule !== null && rule.broken > 0 ? rule.worst : null }
  })
  return { columns, top }
}

/** The marked days of the trend, in order. */
export function markedDays(columns: readonly TrendColumn[]): { date: CalendarDate; worst: 'hard' | 'soft' }[] {
  return columns.flatMap((column) => (column.worst === null ? [] : [{ date: column.day.date, worst: column.worst }]))
}

/** A bar of "ימי בית לפי סוג": its name, its colour key, its days. */
export interface TypeBar {
  readonly key: string
  readonly name: string
  readonly colorKey: string | null
  readonly days: number
}

/** The bars, largest first; the built-in group takes its first type's colour, since a group has none. */
export function typeBars(items: readonly HomeByType[]): TypeBar[] {
  return items
    .map((item): TypeBar => {
      if (item.kind === 'type') return { key: item.type.id, name: item.type.name, colorKey: item.type.color_key, days: item.days }
      const first: LeaveType | undefined = item.types[0]
      return { key: item.group.id, name: item.group.name, colorKey: first?.color_key ?? null, days: item.days }
    })
    .sort((a, b) => b.days - a.days)
}

/** The step of a share in `steps` steps, 0 … steps − 1. */
export function stepOf(value: number, max: number, steps: number): number {
  if (max <= 0) return 0
  return Math.max(0, Math.min(steps - 1, Math.floor((value / max) * steps)))
}
