import type { Leave, LeaveType, Soldier, SoldierId } from '@contracts'
import { t } from '@i18n'
import { fullName, leaveDayCount } from '@logic'
import { formatDate, formatDateRange } from '../../patterns/dates'

// How a leave is written wherever it is listed: its days, its type and the people around it (D-119, D-120). The
// details drawer and the inbox say the same thing.

const DAYS_SEPARATOR = ' '

export function leaveDatesText(leave: Pick<Leave, 'start_date' | 'end_date'>): string {
  return leave.start_date === leave.end_date ? formatDate(leave.start_date, 'dayMonth') : formatDateRange(leave.start_date, leave.end_date)
}

export function leaveDaysText(leave: Pick<Leave, 'start_date' | 'end_date'>): string {
  const count = leaveDayCount(leave)
  return count === 1 ? t('leaves.oneDay') : [String(count), t('leaves.days')].join(DAYS_SEPARATOR)
}

/** Names by id. Whoever the actor cannot read has a neutral name (D-119). */
export function personNames(soldiers: readonly Soldier[]): (id: SoldierId | null) => string {
  const byId = new Map(soldiers.map((soldier) => [soldier.id, fullName(soldier)]))
  return (id) => (id === null ? t('leaves.unknownPerson') : (byId.get(id) ?? t('leaves.unknownPerson')))
}

export function typeNameOf(type: LeaveType | null): string {
  return type?.name ?? t('leaves.unknownType')
}
