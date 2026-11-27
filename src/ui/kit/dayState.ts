import type { CalendarDate } from '@contracts'
import type { I18nKey } from '@i18n'

// What a day of the soldier's strip and month is (D-454), and the words read aloud for it. The leave round, the
// soldier's regular turn at home, is told apart from another absence (D-268).

export type DayState = 'base' | 'round' | 'away' | 'pending'

export interface StripDay {
  readonly date: CalendarDate
  readonly state: DayState
}

export const DAY_STATE_KEYS: Readonly<Record<DayState, I18nKey>> = {
  base: 'kit.dayBase',
  round: 'kit.dayRound',
  away: 'kit.dayAway',
  pending: 'kit.dayPending',
}

/** A day of a month: with what the soldier's day is, or with no state where the month only picks days. */
export interface MonthDay {
  readonly date: CalendarDate
  readonly state?: DayState
}
