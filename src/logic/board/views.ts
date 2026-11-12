import { FIRST_DAY_OF_WEEK } from '@config'
import type { CalendarDate, CommandRank, Soldier } from '@contracts'
import { weekdayOf } from '@domain'
import type { BoardModel } from './hooks'
import type { BoardLeave } from './leaves'
import type { BoardGroupLabel } from './rows'

// What the list, the table and the calendar read of the one board model (D-174), so each engine draws the same soldiers
// and the same leaves as the timeline, cut its own way. Pure.

const DAYS_IN_WEEK = 7

/** A leave with its soldier and the group the soldier's row sits in. */
export interface BoardEntry {
  readonly leave: BoardLeave
  readonly soldier: Soldier
  readonly rank: CommandRank | null
  readonly group: BoardGroupLabel | null
}

/** Every leave of the soldiers in view, in the order of their rows, each soldier's by first day (the table). */
export function boardEntries(model: BoardModel): BoardEntry[] {
  let group: BoardGroupLabel | null = null
  const entries: BoardEntry[] = []
  for (const item of model.items) {
    if (item.kind === 'group') {
      group = item.label
      continue
    }
    for (const leave of model.leaves.get(item.soldier.id) ?? []) {
      entries.push({ leave, soldier: item.soldier, rank: item.rank, group })
    }
  }
  return entries
}

/** One day of the calendar. */
export interface BoardDay {
  readonly day: CalendarDate
  /** The leaves on the day of soldiers in view that day, absences first, then in the order of the rows. */
  readonly entries: readonly BoardEntry[]
  /** How many of them are away: an approved absence, as the presence lists count it (D-134). */
  readonly away: number
}

/** The window's days, each with what falls on it. A muted day of a row (out of the unit, D-105) adds nothing to it. */
export function boardDays(model: BoardModel): BoardDay[] {
  const rows = model.items.flatMap((item) => (item.kind === 'soldier' ? [item] : []))
  const all = boardEntries(model)
  return model.days.map((day, index) => {
    const inView = new Set(rows.filter((row) => row.inScope[index] === true).map((row) => row.soldier.id))
    const onDay = all.filter((entry) => inView.has(entry.soldier.id) && entry.leave.start_date <= day && entry.leave.end_date >= day)
    const absences = onDay.filter((entry) => entry.leave.effect === 'unavailable')
    const away = new Set(absences.filter((entry) => entry.leave.status === 'approved').map((entry) => entry.soldier.id))
    return {
      day,
      entries: [...absences, ...onDay.filter((entry) => entry.leave.effect !== 'unavailable')],
      away: away.size,
    }
  })
}

/**
 * The days in whole weeks from the first day of the week (D-074), for a grid of seven columns. NULL holds a place before
 * the window's first day and after its last: the board reads no day outside the window (D-103).
 */
export function calendarWeeks<T extends { readonly day: CalendarDate }>(days: readonly T[]): (T | null)[][] {
  const [first] = days
  if (first === undefined) return []
  const lead = (weekdayOf(first.day) - FIRST_DAY_OF_WEEK + DAYS_IN_WEEK) % DAYS_IN_WEEK
  const cells: (T | null)[] = [...Array.from({ length: lead }, () => null), ...days]
  while (cells.length % DAYS_IN_WEEK !== 0) cells.push(null)
  return Array.from({ length: cells.length / DAYS_IN_WEEK }, (_, week) => cells.slice(week * DAYS_IN_WEEK, (week + 1) * DAYS_IN_WEEK))
}
