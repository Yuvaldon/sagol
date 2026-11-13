import { RuleEnforcement, type CalendarDate } from '@contracts'
import { t } from '@i18n'
import { filterUnitOf, useHeatRow, useRulesDay, type HeatDay } from '@logic'
import { useMemo } from 'react'
import { formatDate } from '../patterns/dates'
import type { BoardFrame } from './BoardEngine'
import { TEXT_SEPARATOR } from './labels'

// A rule's breach in every view (D-290, OI-221), from the same evaluation as the timeline's heat row (D-141): the days
// of the window that break a rule for the board's unit, each opening the rules of its day.

/** The heat row's tones, by the worst rule a day breaks. */
export const BREACH_TONES = {
  hard: 'bg-status-rejected text-on-action',
  soft: 'border-2 border-dashed border-status-pending bg-surface text-status-pending-text',
} as const satisfies Record<RuleEnforcement, string>

/** A day's breach read aloud: the day, how many rules break, and whether a hard one is among them. */
export function breachLabel(day: HeatDay): string {
  const worstKey = day.worst === RuleEnforcement.enum.hard ? 'rules.heatHard' : 'rules.heatSoft'
  return [formatDate(day.date, 'dayMonth'), `${String(day.broken)} ${t('rules.heatBroken')}`, t(worstKey)].join(TEXT_SEPARATOR)
}

export interface Breaches {
  /** The window's days that break a rule, in order. Empty while the evaluation loads or the actor reads no rules. */
  readonly days: readonly HeatDay[]
  readonly byDay: ReadonlyMap<CalendarDate, HeatDay>
  readonly open: (day: CalendarDate) => void
}

export function useBreaches(frame: BoardFrame): Breaches {
  const unit = filterUnitOf(frame.filter)
  const heat = useHeatRow(frame.window, unit.kind === 'unit' ? unit.unitId : null)
  const { openOn } = useRulesDay()
  return useMemo(() => {
    const days = heat.status === 'ready' && heat.value !== null ? heat.value.filter((day) => day.broken > 0) : []
    return { days, byDay: new Map(days.map((day) => [day.date, day])), open: openOn }
  }, [heat, openOn])
}

