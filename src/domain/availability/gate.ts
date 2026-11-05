import {
  RuleBound,
  RuleEnforcement,
  RuleGroupBy,
  type AvailabilityRuleId,
  type CalendarDate,
  type Result,
  type RuleViolation,
  type SoldierId,
} from '@contracts'
import { compareCodeUnits } from '../json'
import { compareDates, eachDay } from '../time'
import type { AvailabilityLeave } from './days'
import { evaluateBeforeAfter, type RuleData, type RuleShape, type RuleTargetResult } from './rules'

// What commands do with rule evaluation (D-047, D-073): a leave change is checked against
// the effective rules on the days and targets it touches, and only what the change makes
// worse counts. Hard violations reject the change; soft ones need an acknowledgment.

function violationKey(target: RuleTargetResult, bound: RuleBound): string {
  const group =
    target.group === null
      ? null
      : target.group.group_by === RuleGroupBy.enum.tag
        ? target.group.tag_id
        : target.group.command_rank_id
  return JSON.stringify([target.rule_id, target.scope_unit_id, group, bound])
}

/** Broken bounds of effective targets, one violation per rule × unit × group × bound. */
function collectViolations(broken: Iterable<{ target: RuleTargetResult; bound: RuleBound }>): RuleViolation[] {
  const byKey = new Map<string, RuleViolation>()
  for (const { target, bound } of broken) {
    const key = violationKey(target, bound)
    const required = bound === RuleBound.enum.min ? target.required_min : target.allowed_max
    if (required === null) continue
    const day = { date: target.date, required, actual: target.available }
    const existing = byKey.get(key)
    if (existing !== undefined) {
      existing.days.push(day)
      continue
    }
    byKey.set(key, {
      rule_id: target.rule_id,
      enforcement: target.enforcement,
      scope_unit_id: target.scope_unit_id,
      group: target.group,
      bound,
      days: [day],
    })
  }
  const violations = [...byKey.values()]
  for (const violation of violations) violation.days.sort((a, b) => compareDates(a.date, b.date))
  return violations
}

/** Every broken bound of an effective rule; overridden targets never violate (D-031). */
export function ruleViolations(targets: Iterable<RuleTargetResult>): RuleViolation[] {
  const broken: { target: RuleTargetResult; bound: RuleBound }[] = []
  for (const target of targets) {
    if (target.overridden_by.length > 0) continue
    for (const bound of target.broken) broken.push({ target, bound })
  }
  return collectViolations(broken)
}

/**
 * Violations a leave change causes (D-073). `data.leaves` is the stored state; `changed` are
 * the leaves after the change (same id replaces, a new id is added; a cancelled or rejected
 * leave stops counting). Only days covered by a changed leave before or after, only targets
 * that count its soldier, and only bounds the change moves further from: fewer available
 * below a minimum, more available above a maximum.
 */
export function leaveChangeViolations(
  data: RuleData,
  rules: Iterable<RuleShape>,
  changed: readonly AvailabilityLeave[],
): RuleViolation[] {
  const stored = [...data.leaves]
  const changedIds = new Set(changed.map((leave) => leave.id))
  const storedById = new Map(stored.map((leave) => [leave.id, leave]))
  const dates = new Set<CalendarDate>()
  const soldiers = new Set<SoldierId>()
  for (const leave of changed) {
    for (const version of [storedById.get(leave.id), leave]) {
      if (version === undefined) continue
      soldiers.add(version.soldier_id)
      for (const date of eachDay(version)) dates.add(date)
    }
  }
  if (dates.size === 0) return []
  const after = [...stored.filter((leave) => !changedIds.has(leave.id)), ...changed]
  const result = evaluateBeforeAfter({ ...data, leaves: stored }, after, rules, { dates, soldier_ids: soldiers })
  const worsened: { target: RuleTargetResult; bound: RuleBound }[] = []
  result.after.forEach((target, index) => {
    const before = result.before[index]
    if (target.overridden_by.length > 0) return
    for (const bound of target.broken) {
      const worse =
        before === undefined ||
        (bound === RuleBound.enum.min ? target.available < before.available : target.available > before.available)
      if (worse) worsened.push({ target, bound })
    }
  })
  return collectViolations(worsened)
}

/**
 * The command's answer to the violations (D-047): any hard violation → `rule_violation`
 * with the hard ones; a soft violation whose rule is not acknowledged →
 * `rule_acknowledgment_required` with every soft violation; otherwise the ids to store in
 * `leave_events.acknowledged_rule_ids` (the acknowledged rules that were broken, sorted).
 */
export function ruleGate(
  violations: readonly RuleViolation[],
  acknowledgedRuleIds: Iterable<AvailabilityRuleId>,
): Result<AvailabilityRuleId[]> {
  const hard = violations.filter((violation) => violation.enforcement === RuleEnforcement.enum.hard)
  if (hard.length > 0) return { ok: false, error: { code: 'rule_violation', violations: hard } }
  const soft = violations.filter((violation) => violation.enforcement === RuleEnforcement.enum.soft)
  const acknowledged = new Set(acknowledgedRuleIds)
  if (soft.some((violation) => !acknowledged.has(violation.rule_id))) {
    return { ok: false, error: { code: 'rule_acknowledgment_required', violations: soft } }
  }
  return { ok: true, value: [...new Set(soft.map((violation) => violation.rule_id))].sort(compareCodeUnits) }
}
