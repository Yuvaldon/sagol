import type { CalendarDate } from '@contracts'
import type { I18nKey } from '@i18n'

// What a day of the soldier's strip and month is (D-454), and the words read aloud for it.

export type DayState = 'base' | 'away' | 'pending'

export interface StripDay {
  readonly date: CalendarDate
  readonly state: DayState
}

export const DAY_STATE_KEYS: Readonly<Record<DayState, I18nKey>> = {
  base: 'kit.dayBase',
  away: 'kit.dayAway',
  pending: 'kit.dayPending',
}
