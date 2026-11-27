import { FIRST_DAY_OF_WEEK } from '@config'
import type { CalendarDate, CommandRank, Soldier } from '@contracts'
import { compareDates, weekdayOf } from '@domain'
import type { BoardModel } from './hooks'
import type { BoardLeave } from './leaves'
import type { BoardGroupLabel } from './rows'

// What the list, the table and the calendar read of the one board model (D-174), so each engine draws the same soldiers
// and the same leaves as the timeline, cut its own way. Pure.

const DAYS_IN_WEEK = 7

/** A leave with its soldier and the soldier's unit on the reference day (D-105, D-452). */
export interface BoardEntry {
  readonly leave: BoardLeave
  readonly soldier: Soldier
  readonly rank: CommandRank | null
  readonly unit: BoardGroupLabel
}

/** Every leave of the soldiers in view, in the order of their rows, each soldier's by first day (the table). */
export function boardEntries(model: BoardModel): BoardEntry[] {
  return model.items.flatMap((item) =>
    item.kind === 'group'
      ? []
      : (model.leaves.get(item.soldier.id) ?? []).map((leave) => ({ leave, soldier: item.soldier, rank: item.rank, unit: item.unit })),
  )
}

/** One day of the calendar. */
export interface BoardDay {
  readonly day: CalendarDate
  /** The leaves on the day of soldiers in view that day, absences first, then in the order of the rows. */
  readonly entries: readonly BoardEntry[]
  /** How many of them are away: an approved absence, as the presence lists count it (D-134). */
  readonly away: number
  /** How many soldiers in view the day counts: who is on base is `total - away` (the fraction, D-454). */
  readonly total: number
}

/** The window's days, each with what falls on it. A muted day of a row (out of the unit, D-105) adds nothing to it. */
export function boardDays(model: BoardModel): BoardDay[] {
  const rows = model.items.flatMap((item) => (item.kind === 'soldier' ? [item] : []))
  const all = boardEntries(model)
  return model.days.map((day, index) => {
    const inView = new Set(rows.filter((row) => row.inScope[index] === true).map((row) => row.soldier.id))
    const onDay = all.filter((entry) => inView.has(entry.soldier.id) && entry.leave.start_date <= day && entry.leave.end_date >= day)
    const absences = onDay.filter((entry) => entry.leave.effect === 'unavailable')
    // Counted from every approved absence, whatever the leave conditions draw (D-133, D-134).
    const away = [...inView].filter((soldierId) =>
      (model.approved.get(soldierId) ?? []).some(
        (leave) => leave.effect === 'unavailable' && leave.start_date <= day && leave.end_date >= day,
      ),
    )
    return {
      day,
      entries: [...absences, ...onDay.filter((entry) => entry.leave.effect !== 'unavailable')],
      away: away.length,
      total: inView.size,
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

/** Whether a leave is on a day: its days are whole and both ends count (D-012). */
function covers(entry: BoardEntry, day: CalendarDate): boolean {
  return compareDates(entry.leave.start_date, day) <= 0 && compareDates(day, entry.leave.end_date) <= 0
}

/** An absence: a leave that takes its soldier off base, not a marker (D-032). */
function away(entry: BoardEntry): boolean {
  return entry.leave.effect === 'unavailable'
}

/**
 * A request on a day, and whether the day starts or ends it (D-193: `end_date` is the day of the return). A leave of one
 * day leaves on it and is listed once, as leaving, in the day's drawer and in the movements alike (D-480).
 */
export interface DayRequest {
  readonly entry: BoardEntry
  readonly leaving: boolean
  readonly returning: boolean
}

/**
 * Every leave on the selected day (the handoff's board spec, §3 and §1.15): the leave round's, cut by day into who leaves
 * today, who is home and who returns today, never by its batch; and each request, with whether it starts or ends today.
 */
export interface DayLeaves {
  readonly roundLeaving: readonly BoardEntry[]
  readonly roundHome: readonly BoardEntry[]
  readonly roundReturning: readonly BoardEntry[]
  readonly requests: readonly DayRequest[]
}

export function dayLeaves(days: readonly BoardDay[], day: CalendarDate): DayLeaves {
  const entries = days.find((candidate) => candidate.day === day)?.entries ?? []
  const round = entries.filter((entry) => entry.leave.layer === 'round' && away(entry))
  const leaving = round.filter((entry) => entry.leave.start_date === day)
  const returning = round.filter((entry) => entry.leave.end_date === day && entry.leave.start_date !== day)
  return {
    roundLeaving: leaving,
    roundHome: round.filter((entry) => !leaving.includes(entry) && !returning.includes(entry)),
    roundReturning: returning,
    requests: entries
      .filter((entry) => entry.leave.layer === 'request')
      .map((entry) => ({
        entry,
        leaving: away(entry) && entry.leave.start_date === day,
        returning: away(entry) && entry.leave.end_date === day && entry.leave.start_date !== day,
      })),
  }
}

/**
 * The requests a month cell names (§1.10): the leave round is the regular state and is not drawn, unless a leave of it
 * waits for approval, as a move does (D-481): that one asks its approver to look.
 */
export function cellRequests(day: BoardDay): readonly BoardEntry[] {
  return day.entries.filter((entry) => (entry.leave.layer === 'request' || entry.leave.status === 'pending') && covers(entry, day.day))
}

/** One direction of a day's movements: the leave round's leaves of the day, and each request alone (§1.15). */
export interface MovementSide {
  readonly round: readonly BoardEntry[]
  readonly requests: readonly BoardEntry[]
}

/**
 * Who leaves and who returns on a day (§3, "Movements"): an absence leaves on its first day and returns on its last; a
 * one-day absence is listed once, as leaving, as the day's drawer lists it.
 */
export interface MovementDay {
  readonly day: CalendarDate
  readonly leaving: MovementSide
  readonly returning: MovementSide
}

function sideOf(entries: readonly BoardEntry[]): MovementSide {
  return {
    round: entries.filter((entry) => entry.leave.layer === 'round'),
    requests: entries.filter((entry) => entry.leave.layer === 'request'),
  }
}

function movedOn(side: MovementSide): boolean {
  return side.round.length > 0 || side.requests.length > 0
}

/** The window's days, each with who leaves and who returns on it. A leave round's leave moved alone shows on its own day. */
export function boardMovements(days: readonly BoardDay[]): MovementDay[] {
  return days.map((day) => {
    const absences = day.entries.filter(away)
    return {
      day: day.day,
      leaving: sideOf(absences.filter((entry) => entry.leave.start_date === day.day)),
      returning: sideOf(absences.filter((entry) => entry.leave.end_date === day.day && entry.leave.start_date !== day.day)),
    }
  })
}

/** A day with movement, or a run of days without (§3: one dashed line for the run). Today always stands alone. */
export type MovementRun =
  | { readonly kind: 'day'; readonly day: MovementDay }
  | { readonly kind: 'empty'; readonly from: CalendarDate; readonly to: CalendarDate }

export function movementRuns(days: readonly MovementDay[], today: CalendarDate): MovementRun[] {
  const runs: MovementRun[] = []
  for (const day of days) {
    const moves = movedOn(day.leaving) || movedOn(day.returning)
    if (moves || day.day === today) {
      runs.push({ kind: 'day', day })
      continue
    }
    const last = runs.at(-1)
    if (last?.kind === 'empty') runs[runs.length - 1] = { ...last, to: day.day }
    else runs.push({ kind: 'empty', from: day.day, to: day.day })
  }
  return runs
}

/** Whether a day of the movements moves anyone. */
export function hasMovement(day: MovementDay): boolean {
  return movedOn(day.leaving) || movedOn(day.returning)
}
