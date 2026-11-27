import { RuleEnforcement } from '@contracts'
import { t } from '@i18n'
import type { HeatDay } from '@logic'
import { formatDate } from '../patterns/dates'
import { TEXT_SEPARATOR } from './labels'

// A rule's breach read aloud (D-290, OI-221), from the same evaluation as the timeline's heat row (D-141).

/** A day's breach read aloud: the day, how many rules break, and whether a hard one is among them. */
export function breachLabel(day: HeatDay): string {
  const worstKey = day.worst === RuleEnforcement.enum.hard ? 'rules.heatHard' : 'rules.heatSoft'
  return [formatDate(day.date, 'dayMonth'), `${String(day.broken)} ${t('rules.heatBroken')}`, t(worstKey)].join(TEXT_SEPARATOR)
}
