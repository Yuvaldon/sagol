import { TODAY } from '@config'
import type { CalendarDate } from '@contracts'
import { t } from '@i18n'
import type { LeaveType } from '@contracts'
import { myStanding, useLeaveTypes, useMyDays, useToday, type MyDay } from '@logic'
import type { StripDay } from '../../kit/dayState'
import { typeNameOf } from '../../modules/leaves/leaveText'
import { formatDate } from '../../patterns/dates'

// Where the soldier is today and what comes next (D-454), in the words of the open block and of "הסטטוס שלי".

const SEPARATOR = ' · '
const NO_TYPES: readonly LeaveType[] = []
const WORD = ' '

export function dayLine(day: CalendarDate): string {
  return [formatDate(day, 'weekdayLong'), formatDate(day, 'dayMonthDigits')].join(SEPARATOR)
}

export interface Standing {
  readonly today: CalendarDate
  /** The days as the strip draws them: a request that waits named by its type (OI-395). */
  readonly days: readonly (MyDay & StripDay)[]
  /** "בבסיס" or "בבית". */
  readonly place: string
  /** The next day that changes it, or that none of the coming days does. */
  readonly next: string
}

/** The days with the name a waiting request carries on the strip: its type's (OI-395). */
export function namedDays(days: readonly MyDay[], types: readonly LeaveType[]): (MyDay & StripDay)[] {
  return days.map((day) =>
    day.state === 'pending' ? { ...day, label: typeNameOf(types.find((type) => type.id === day.type_id) ?? null) } : day,
  )
}

/** Where a soldier is on the first of their days and what comes next, in words; NULL for no days. The person card says it too (D-482). */
export function standingOf(today: CalendarDate, days: readonly MyDay[], types: readonly LeaveType[] = NO_TYPES): Standing | null {
  const standing = myStanding(days)
  if (standing === null) return null
  const { away, changes } = standing
  const next =
    changes === null
      ? t(away ? 'today.noBack' : 'today.noOut')
      : [t(away ? 'today.nextBack' : 'today.nextOut'), dayLine(changes)].join(WORD)
  return { today, days: namedDays(days, types), place: t(away ? 'today.atHome' : 'today.onBase'), next }
}

/** NULL while it loads, and for an actor with no soldier record of their own. */
export function useStanding(): Standing | null {
  const today = useToday()
  const days = useMyDays(today, TODAY.stripDays)
  const types = useLeaveTypes()
  if (today === null || days === null || days.status !== 'ready') return null
  return standingOf(today, days.value, types.status === 'ready' ? types.value : NO_TYPES)
}
