import {
  RuleEnforcement,
  type AvailabilityRule,
  type AvailabilityRuleId,
  type CalendarDate,
  type Leave,
  type LeaveType,
  type RuleGroupValue,
  type RuleViolation,
  type SoldierId,
  type Tag,
  type Unit,
  type UnitId,
} from '@contracts'
import {
  buildUnitTree,
  compareDates,
  createRuleContext,
  descendantsOf,
  leaveChangeViolations,
  primaryUnitOn,
  ruleViolations,
  type AvailabilityLeave,
  type MembershipSpan,
  type RuleData,
  type RuleTargetResult,
} from '@domain'
import type { FilterSource } from '../filters/source'

// Rule evaluation for a window (D-014, D-071 … D-073, OI-091): the heat row, the broken rules of a day, the
// configuration conflicts and the live warnings of a form. Pure, over what the actor reads, with the domain functions
// the commands use, so a warning says what the command would (D-142).

export interface RuleInputs {
  readonly source: FilterSource
  /** Archived ones too: an archived child keeps its soldiers in its parent's tree, as the command counts them. */
  readonly units: readonly Unit[]
  /** Archived ones too: they form no group, which domain decides (D-072). */
  readonly tags: readonly Tag[]
  /** The pending and approved leaves the actor sees on the days evaluated. */
  readonly leaves: readonly Leave[]
  readonly types: readonly LeaveType[]
}

/**
 * The rows rule evaluation reads. Deployments and seniority overrides arrive in V15 (OI-081, OI-096); before it none
 * can exist.
 */
export function ruleDataOf({ source, units, tags, leaves, types }: RuleInputs): RuleData {
  return {
    units,
    soldiers: source.soldiers,
    command_ranks: source.ranks,
    tags,
    soldier_tags: source.soldierTags,
    seniority_overrides: [],
    unit_memberships: source.memberships,
    property_definitions: source.propertyDefinitions,
    deployments: [],
    deployment_members: [],
    leaves,
    leave_types: types,
  }
}

/** Which targets concern the board's unit (D-141): every target without a unit. */
function concernsUnit(data: RuleData, unitId: UnitId | null): (target: RuleTargetResult) => boolean {
  if (unitId === null) return () => true
  const tree = new Set<UnitId>([unitId, ...descendantsOf(buildUnitTree(data.units), unitId)])
  const spans = new Map<SoldierId, MembershipSpan[]>()
  for (const span of data.unit_memberships) spans.set(span.soldier_id, [...(spans.get(span.soldier_id) ?? []), span])
  const placedInTree = (soldierId: SoldierId, date: CalendarDate) => {
    const placed = primaryUnitOn(spans.get(soldierId) ?? [], soldierId, date)
    return placed !== null && tree.has(placed)
  }
  // A target evaluated inside the unit counts even with nobody in it ("at least 2 drivers" in a platoon without
  // drivers, D-072); one above it counts when it counts a soldier placed in the unit that day.
  return (target) =>
    (target.scope_unit_id !== null && tree.has(target.scope_unit_id)) ||
    target.members.some((soldierId) => placedInTree(soldierId, target.date))
}

const isBroken = (target: RuleTargetResult) => target.overridden_by.length === 0 && target.broken.length > 0

/** A day of the heat row (D-141): how many effective targets are broken, and the worst enforcement among them. */
export interface HeatDay {
  readonly date: CalendarDate
  readonly broken: number
  /** NULL when nothing is broken. */
  readonly worst: RuleEnforcement | null
}

export interface RuleWindowInput {
  readonly data: RuleData
  readonly rules: readonly AvailabilityRule[]
  readonly days: readonly CalendarDate[]
  /** The board's unit; NULL = the whole organization. */
  readonly unitId: UnitId | null
}

function brokenTargets({ data, rules, days, unitId }: RuleWindowInput): RuleTargetResult[] {
  return concerningTargets({ data, rules, days, unitId }).filter(isBroken)
}

function concerningTargets({ data, rules, days, unitId }: RuleWindowInput): RuleTargetResult[] {
  const { targets } = createRuleContext(data).evaluate(rules, { dates: days })
  return targets.filter(concernsUnit(data, unitId))
}

/** The heat row of the window, or NULL when no rule concerns the unit on any of its days: the row then has no place (D-173). */
export function heatRow(input: RuleWindowInput): HeatDay[] | null {
  const concerning = concerningTargets(input)
  if (concerning.length === 0) return null
  const broken = concerning.filter(isBroken)
  return input.days.map((date) => {
    const ofDay = broken.filter((target) => target.date === date)
    const hard = ofDay.some((target) => target.enforcement === RuleEnforcement.enum.hard)
    const worst = ofDay.length === 0 ? null : hard ? RuleEnforcement.enum.hard : RuleEnforcement.enum.soft
    return { date, broken: ofDay.length, worst }
  })
}

/** The broken rules of one day, each with who is unavailable (D-138, D-141). */
export function dayViolations(input: Omit<RuleWindowInput, 'days'> & { readonly day: CalendarDate }): RuleViolation[] {
  const broken = brokenTargets({ ...input, days: [input.day] })
  return ruleViolations(broken, input.data.soldiers)
}

/** A configuration conflict (D-072) on one or more days of the window. */
export interface WindowConflict {
  readonly scope_unit_id: UnitId | null
  readonly group: RuleGroupValue | null
  readonly rule_ids: readonly AvailabilityRuleId[]
  readonly required_min: number
  readonly allowed_max: number
  readonly days: readonly CalendarDate[]
}

/** The conflicts of the window, the same conflict on several days once (D-140). */
export function windowConflicts({ data, rules, days }: Omit<RuleWindowInput, 'unitId'>): WindowConflict[] {
  const { conflicts } = createRuleContext(data).evaluate(rules, { dates: days })
  const byKey = new Map<string, WindowConflict>()
  for (const conflict of conflicts) {
    const key = JSON.stringify([conflict.scope_unit_id, conflict.population_key, conflict.group, conflict.rule_ids, conflict.required_min, conflict.allowed_max])
    const known = byKey.get(key)
    byKey.set(key, {
      scope_unit_id: conflict.scope_unit_id,
      group: conflict.group,
      rule_ids: conflict.rule_ids,
      required_min: conflict.required_min,
      allowed_max: conflict.allowed_max,
      days: [...(known?.days ?? []), conflict.date].sort(compareDates),
    })
  }
  return [...byKey.values()]
}

/** What a leave as the command would leave it breaks (D-073, D-142): the command's own evaluation. */
export function leaveViolations(data: RuleData, rules: readonly AvailabilityRule[], changed: AvailabilityLeave): RuleViolation[] {
  return leaveChangeViolations(data, rules, [changed])
}

/** The rule ids to send again after the actor acknowledged the soft violations (D-047). */
export function acknowledgedRuleIds(violations: readonly RuleViolation[]): AvailabilityRuleId[] {
  return [
    ...new Set(
      violations.filter((violation) => violation.enforcement === RuleEnforcement.enum.soft).map((violation) => violation.rule_id),
    ),
  ]
}
