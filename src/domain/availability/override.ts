import type { AvailabilityRuleId, CalendarDate } from '@contracts'
import { filterKey } from '../filters'
import { compareDates } from '../time'
import type { RuleShape } from './rules'

// "לא חל" (D-482): a rule another one replaces on every day it would apply. Two rules land on the same targets when they
// count the same people of the same units, grouped the same way (D-031, D-067); on a shared target the higher priority
// wins and the lower is overridden. Read from the rules alone, so the list says it before any day is evaluated.

export type OverrideShape = Pick<
  RuleShape,
  | 'id'
  | 'is_enabled'
  | 'archived_at'
  | 'priority'
  | 'scope_unit_id'
  | 'scope_mode'
  | 'scope_level_id'
  | 'population_filter'
  | 'group_by'
  | 'group_tag_category_id'
  | 'effective_from'
  | 'effective_to'
  | 'deployment_id'
>

/** Whether a rule takes part in evaluation at all: enabled and not archived. */
function isActive(rule: OverrideShape): boolean {
  return rule.is_enabled && rule.archived_at === null
}

/** Whether both rules make the same targets on a day both apply: the same units, people and groups. */
function sameTargets(a: OverrideShape, b: OverrideShape): boolean {
  return (
    a.scope_unit_id === b.scope_unit_id &&
    a.scope_mode === b.scope_mode &&
    a.scope_level_id === b.scope_level_id &&
    a.group_by === b.group_by &&
    a.group_tag_category_id === b.group_tag_category_id &&
    filterKey(a.population_filter) === filterKey(b.population_filter)
  )
}

/** Whether `wide` starts no later than `narrow`: an open start covers every start. */
function startsBy(wide: CalendarDate | null, narrow: CalendarDate | null): boolean {
  return wide === null || (narrow !== null && compareDates(wide, narrow) <= 0)
}

/** Whether `wide` ends no earlier than `narrow`: an open end covers every end. */
function endsAfter(wide: CalendarDate | null, narrow: CalendarDate | null): boolean {
  return wide === null || (narrow !== null && compareDates(wide, narrow) >= 0)
}

/** Whether `wide` applies on every day `narrow` does: its dates hold the other's, and its rotation is the other's or none. */
function covers(wide: OverrideShape, narrow: OverrideShape): boolean {
  if (wide.deployment_id !== null && wide.deployment_id !== narrow.deployment_id) return false
  return startsBy(wide.effective_from, narrow.effective_from) && endsAfter(wide.effective_to, narrow.effective_to)
}

/**
 * The rule that overrides `rule` on every day it applies, the highest first; NULL when none does, and for a rule that is
 * off or archived, which applies on no day. An archived or switched-off rule overrides nothing, so archiving the higher
 * rule takes the mark off the lower one at once. Equal priorities are both effective (D-031).
 */
export function overridingRule(rule: OverrideShape, rules: readonly OverrideShape[]): AvailabilityRuleId | null {
  if (!isActive(rule)) return null
  const winners = rules
    .filter((other) => other.id !== rule.id && isActive(other) && other.priority > rule.priority && sameTargets(other, rule) && covers(other, rule))
    .toSorted((a, b) => b.priority - a.priority)
  return winners[0]?.id ?? null
}
