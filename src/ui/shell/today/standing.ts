import { TODAY } from '@config'
import type { CalendarDate } from '@contracts'
import { t } from '@i18n'
import { myStanding, useMyDays, useToday, type MyDay } from '@logic'
import { formatDate } from '../../patterns/dates'

// Where the soldier is today and what comes next (D-454), in the words of the open block and of "הסטטוס שלי".

const SEPARATOR = ' · '
const WORD = ' '

export function dayLine(day: CalendarDate): string {
  return [formatDate(day, 'weekdayLong'), formatDate(day, 'dayMonthDigits')].join(SEPARATOR)
}

export interface Standing {
  readonly today: CalendarDate
  readonly days: readonly MyDay[]
  /** "בבסיס" or "בבית". */
  readonly place: string
  /** The next day that changes it, or that none of the coming days does. */
  readonly next: string
}

/** NULL while it loads, and for an actor with no soldier record of their own. */
export function useStanding(): Standing | null {
  const today = useToday()
  const days = useMyDays(today, TODAY.stripDays)
  if (today === null || days === null || days.status !== 'ready') return null
  const standing = myStanding(days.value)
  if (standing === null) return null
  const { away, changes } = standing
  const next =
    changes === null
      ? t(away ? 'today.noBack' : 'today.noOut')
      : [t(away ? 'today.nextBack' : 'today.nextOut'), dayLine(changes)].join(WORD)
  return { today, days: days.value, place: t(away ? 'today.atHome' : 'today.onBase'), next }
}
