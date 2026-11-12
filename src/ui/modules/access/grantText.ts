import type { AccessGrant } from '@contracts'
import { t } from '@i18n'
import { grantDaysOf } from '@logic'
import { formatDate } from '../../patterns/dates'

// A grant's days in words, for a list row (D-028): from its first day, to its last or until revoked.

export function grantDaysText(grant: AccessGrant, timezone: string): string {
  const days = grantDaysOf(grant, timezone)
  const to = days.to === null ? t('grants.untilRevoked') : `${t('grants.to')} ${formatDate(days.to)}`
  return `${t('grants.from')}${formatDate(days.from)} ${to}`
}
