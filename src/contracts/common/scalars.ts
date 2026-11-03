import { z } from 'zod'

// Column value types shared by every entity (D-042).

/** SQL `DATE`: an ISO calendar date, `YYYY-MM-DD`. Lexical order equals date order. */
export const CalendarDate = z.iso.date()
export type CalendarDate = z.infer<typeof CalendarDate>

/** SQL `TIMESTAMPTZ`: an ISO 8601 date-time with `Z` or an offset. */
export const Timestamp = z.iso.datetime({ offset: true })
export type Timestamp = z.infer<typeof Timestamp>

/** SQL `INTEGER`. */
export const Integer = z.int()

/** Optimistic-concurrency counter (D-012), starts at 1. */
export const Version = z.int().min(1)

/** SQL `VARCHAR(n)` holding free text (codes, reasons). */
export function varchar(max: number) {
  return z.string().max(max)
}

/** SQL `VARCHAR(n)` holding a user-entered name: trimmed, never empty. */
export function label(max: number) {
  return z.string().trim().min(1).max(max)
}

/** SQL `TEXT`. */
export const Text = z.string()

/** Verified or invite email address (`VARCHAR(255)`). */
export const Email = z.email().max(255)

/**
 * Semantic palette key (`color_key`, `VARCHAR(30)`). The closed list of keys lives in
 * `config` and is checked by the data layer. The theme maps each key to tokens.
 */
export const ColorKey = z.string().min(1).max(30)
export type ColorKey = z.infer<typeof ColorKey>

/** Semantic icon key (`icon_key`, `VARCHAR(40)`), mapped to an icon by the theme (D-034). */
export const IconKey = z.string().min(1).max(40)
export type IconKey = z.infer<typeof IconKey>

/** Any JSON value. Typed further where the column has a contract (D-016). */
export const JsonValue = z.json()
export type JsonValue = z.infer<typeof JsonValue>
