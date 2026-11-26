import { FIRST_DAY_OF_WEEK } from '@config'
import type { CalendarDate } from '@contracts'
import { addDays, addMonths, compareDates, daysBetween, endOfMonth, startOfMonth, weekdayOf } from '@domain'

// The day math of the Today screen (D-454, D-459): the days ahead, the month the strip opens into and the days a
// soldier marks in it. Pure, so the screen holds no arithmetic of its own.

const DAYS_IN_WEEK = 7

/** The days from a day on, that day first. */
export function daysFrom(from: CalendarDate, count: number): readonly CalendarDate[] {
  return Array.from({ length: count }, (_, index) => addDays(from, index))
}

/** A whole month: its first day and how many days it has. */
export interface MonthSpan {
  readonly first: CalendarDate
  readonly days: number
}

/** The month a number of months away from the month of a day. */
export function monthSpan(day: CalendarDate, offset: number): MonthSpan {
  const first = startOfMonth(addMonths(startOfMonth(day), offset))
  return { first, days: daysBetween(first, endOfMonth(first)) + 1 }
}

/** Days in a row cut into weeks that start on the first day of the week; NULL pads the first and last week. */
export function weeksOf<T extends { readonly date: CalendarDate }>(days: readonly T[]): readonly (readonly (T | null)[])[] {
  const [first] = days
  if (first === undefined) return []
  const lead = (weekdayOf(first.date) - FIRST_DAY_OF_WEEK + DAYS_IN_WEEK) % DAYS_IN_WEEK
  const cells: (T | null)[] = [...Array.from({ length: lead }, () => null), ...days]
  while (cells.length % DAYS_IN_WEEK !== 0) cells.push(null)
  return Array.from({ length: cells.length / DAYS_IN_WEEK }, (_, week) => cells.slice(week * DAYS_IN_WEEK, (week + 1) * DAYS_IN_WEEK))
}

/** The days marked in the month: both ends included. */
export interface DaySelection {
  readonly start: CalendarDate
  readonly end: CalendarDate
}

/**
 * The selection after a day is tapped: the first tap starts it, a tap on another day while it holds one day stretches
 * it to that day, and a tap after a range, or on its only day, starts over (the only day: clears).
 */
export function selectDay(selection: DaySelection | null, day: CalendarDate): DaySelection | null {
  if (selection === null || selection.start !== selection.end) return { start: day, end: day }
  if (selection.start === day) return null
  return compareDates(day, selection.start) < 0 ? { start: day, end: selection.start } : { start: selection.start, end: day }
}

export function selectionCovers(selection: DaySelection | null, day: CalendarDate): boolean {
  return selection !== null && compareDates(selection.start, day) <= 0 && compareDates(day, selection.end) <= 0
}

/** How many days are marked. */
export function selectionDays(selection: DaySelection): number {
  return daysBetween(selection.start, selection.end) + 1
}

/** Whether a day is before another: a day that has passed takes no new request. */
export function isBeforeDay(day: CalendarDate, other: CalendarDate): boolean {
  return compareDates(day, other) < 0
}
