import {
  RuleBound,
  RuleGroupBy,
  RuleMetric,
  RuleScopeMode,
  SoldierStatus,
  type AvailabilityRule,
  type AvailabilityRuleId,
  type CalendarDate,
  type CommandRank,
  type CommandRankId,
  type Deployment,
  type DeploymentId,
  type DeploymentMember,
  type RuleEnforcement,
  type RuleGroupValue,
  type Soldier,
  type SoldierId,
  type Tag,
  type TagId,
  type Unit,
  type UnitId,
} from '@contracts'
import { createFilterContext, filterKey, positiveSelections, type FilterData } from '../filters'
import { buildUnitTree, descendantsOf, primaryUnitOn, type MembershipSpan } from '../hierarchy'
import { compareCodeUnits } from '../json'
import { compareDates } from '../time'
import { createAvailabilityContext, type AvailabilityContext, type AvailabilityData } from './days'
import { createRotationMembership } from './deployments'

// Availability-rule evaluation (D-014, D-031, D-071, D-072). A rule is evaluated per
// target: scope unit × canonical population × group value × day. Everything except the
// available count is fixed by the structure (units, memberships, filters), so a leave change
// only re-counts availability on the same targets.

export type RuleUnit = Pick<
  Unit,
  'id' | 'parent_id' | 'unit_level_id' | 'archived_at' | 'valid_from' | 'valid_to' | 'properties'
>
export type RuleSoldier = Pick<
  Soldier,
  'id' | 'first_name' | 'last_name' | 'command_rank_id' | 'status' | 'properties' | 'archived_at'
>
export type RuleCommandRank = Pick<CommandRank, 'id' | 'seniority' | 'archived_at'>
export type RuleTag = Pick<Tag, 'id' | 'category_id' | 'archived_at'>
export type RuleDeployment = Pick<Deployment, 'id' | 'unit_id' | 'start_date' | 'end_date' | 'archived_at'>
export type RuleDeploymentMember = Pick<DeploymentMember, 'deployment_id' | 'soldier_id' | 'start_date' | 'end_date'>

/** What rule evaluation reads. Full contract rows fit every field. */
export interface RuleData extends FilterData, AvailabilityData {
  readonly units: Iterable<RuleUnit>
  readonly soldiers: Iterable<RuleSoldier>
  readonly command_ranks: Iterable<RuleCommandRank>
  readonly tags: Iterable<RuleTag>
  readonly deployments: Iterable<RuleDeployment>
  readonly deployment_members: Iterable<RuleDeploymentMember>
}

/** The columns rule evaluation reads. Full `AvailabilityRule` rows fit. */
export type RuleShape = Pick<
  AvailabilityRule,
  | 'id'
  | 'is_enabled'
  | 'archived_at'
  | 'priority'
  | 'enforcement'
  | 'scope_unit_id'
  | 'scope_mode'
  | 'scope_level_id'
  | 'population_filter'
  | 'group_by'
  | 'group_tag_category_id'
  | 'metric'
  | 'min_value'
  | 'max_value'
  | 'effective_from'
  | 'effective_to'
  | 'deployment_id'
  | 'count_pending_as_unavailable'
>

/** What D-031 compares to decide which rule is effective. */
export interface RuleTarget {
  /** The evaluated unit (its tree). NULL = the whole organization. */
  readonly scope_unit_id: UnitId | null
  /** `filterKey` of the population filter (D-067). */
  readonly population_key: string
  readonly group: RuleGroupValue | null
  readonly date: CalendarDate
}

/** One rule on one target. */
export interface RuleTargetResult extends RuleTarget {
  readonly rule_id: AvailabilityRuleId
  readonly enforcement: RuleEnforcement
  readonly priority: number
  /** The soldiers the rule counts on this target. */
  readonly members: readonly SoldierId[]
  /** How many members are available. */
  readonly available: number
  /** The members who are not available that day, by id. */
  readonly unavailable: readonly SoldierId[]
  /** At least this many must be available; NULL = no minimum. */
  readonly required_min: number | null
  /** At most this many may be available; NULL = no maximum. */
  readonly allowed_max: number | null
  readonly broken: readonly RuleBound[]
  /** Higher-priority rules on the same target. Empty = this rule is effective (D-031). */
  readonly overridden_by: readonly AvailabilityRuleId[]
}

/** Effective rules on one target whose minimum exceeds their maximum (D-031). */
export interface RuleConflict extends RuleTarget {
  readonly rule_ids: readonly AvailabilityRuleId[]
  readonly required_min: number
  readonly allowed_max: number
}

export interface RuleEvaluation {
  readonly targets: readonly RuleTargetResult[]
  readonly conflicts: readonly RuleConflict[]
}

export interface RuleEvaluationRequest {
  readonly dates: Iterable<CalendarDate>
  /** Keep only targets with at least one of these soldiers. Omitted = every target. */
  readonly soldier_ids?: Iterable<SoldierId>
}

// ---------------------------------------------------------------------------- thresholds

/** NUMERIC(7, 2) values are compared in hundredths, so no float error reaches a count. */
const HUNDREDTHS = 100
const PERCENT_WHOLE = 100

export interface RuleThresholds {
  readonly required_min: number | null
  readonly allowed_max: number | null
}

/**
 * The thresholds as counts of available soldiers (D-071): a minimum rounds up and a maximum
 * rounds down, which is exactly "available / population ≥ min%" and "≤ max%".
 */
export function ruleThresholds(
  rule: Pick<RuleShape, 'metric' | 'min_value' | 'max_value'>,
  population: number,
): RuleThresholds {
  const scale = rule.metric === RuleMetric.enum.percent ? population : 1
  const divisor = rule.metric === RuleMetric.enum.percent ? HUNDREDTHS * PERCENT_WHOLE : HUNDREDTHS
  const ratio = (value: number) => (Math.round(value * HUNDREDTHS) * scale) / divisor
  return {
    required_min: rule.min_value === null ? null : Math.ceil(ratio(rule.min_value)),
    allowed_max: rule.max_value === null ? null : Math.floor(ratio(rule.max_value)),
  }
}

// ---------------------------------------------------------------------------- structure

interface PlannedTarget extends RuleTarget {
  readonly key: string
  readonly rule: RuleShape
  readonly members: readonly SoldierId[]
  readonly thresholds: RuleThresholds
  overridden_by: AvailabilityRuleId[]
}

interface Plan {
  readonly targets: readonly PlannedTarget[]
  readonly conflicts: readonly RuleConflict[]
}

interface Group {
  readonly value: RuleGroupValue | null
  readonly members: readonly SoldierId[]
}

function targetKey(scopeUnitId: UnitId | null, populationKey: string, group: RuleGroupValue | null, date: CalendarDate): string {
  return JSON.stringify([scopeUnitId, populationKey, groupKeyOf(group), date])
}

function groupKeyOf(group: RuleGroupValue | null): string | null {
  if (group === null) return null
  return group.group_by === RuleGroupBy.enum.tag ? `tag:${group.tag_id}` : `rank:${group.command_rank_id}`
}

function covers(from: CalendarDate | null, to: CalendarDate | null, date: CalendarDate): boolean {
  return (from === null || compareDates(from, date) <= 0) && (to === null || compareDates(date, to) <= 0)
}

function sortedIds<T extends string>(ids: Iterable<T>): T[] {
  return [...new Set(ids)].sort(compareCodeUnits)
}

interface Structure {
  plan(rules: Iterable<RuleShape>, dates: readonly CalendarDate[]): Plan
}

function createStructure(data: RuleData): Structure {
  const units = [...data.units]
  const soldiers = [...data.soldiers]
  const memberships: MembershipSpan[] = [...data.unit_memberships]
  const soldierTags = [...data.soldier_tags]
  const commandRanks = [...data.command_ranks]
  const filters = createFilterContext({
    units,
    soldiers,
    soldier_tags: soldierTags,
    command_ranks: commandRanks,
    seniority_overrides: [...data.seniority_overrides],
    unit_memberships: memberships,
    property_definitions: [...data.property_definitions],
  })
  const tree = buildUnitTree(units)
  const unitsById = new Map(units.map((unit) => [unit.id, unit]))
  const ranks = new Map<CommandRankId, RuleCommandRank>(commandRanks.map((rank) => [rank.id, rank]))
  const tags = new Map<TagId, RuleTag>([...data.tags].map((tag) => [tag.id, tag]))
  const deployments = new Map<DeploymentId, RuleDeployment>([...data.deployments].map((row) => [row.id, row]))
  const rotationMembership = createRotationMembership({
    units,
    unit_memberships: memberships,
    deployment_members: data.deployment_members,
  })

  // Only active, non-archived soldiers can be counted (D-071).
  const countable = soldiers.filter((soldier) => soldier.status === SoldierStatus.enum.active && soldier.archived_at === null)
  const soldierById = new Map(soldiers.map((soldier) => [soldier.id, soldier]))
  const tagsBySoldier = new Map<SoldierId, Set<TagId>>()
  for (const row of soldierTags) {
    const own = tagsBySoldier.get(row.soldier_id)
    if (own === undefined) tagsBySoldier.set(row.soldier_id, new Set([row.tag_id]))
    else own.add(row.tag_id)
  }
  const membershipsBySoldier = new Map<SoldierId, MembershipSpan[]>()
  for (const row of memberships) {
    const own = membershipsBySoldier.get(row.soldier_id)
    if (own === undefined) membershipsBySoldier.set(row.soldier_id, [row])
    else own.push(row)
  }

  const placementCache = new Map<CalendarDate, ReadonlyMap<SoldierId, UnitId>>()
  /** Countable soldiers with a primary membership on `date`, and their unit (D-054). */
  function placedOn(date: CalendarDate): ReadonlyMap<SoldierId, UnitId> {
    const cached = placementCache.get(date)
    if (cached !== undefined) return cached
    const placed = new Map<SoldierId, UnitId>()
    for (const soldier of countable) {
      const unitId = primaryUnitOn(membershipsBySoldier.get(soldier.id) ?? [], soldier.id, date)
      if (unitId !== null) placed.set(soldier.id, unitId)
    }
    placementCache.set(date, placed)
    return placed
  }

  const subtreeCache = new Map<UnitId, ReadonlySet<UnitId>>()
  function subtreeOf(unitId: UnitId): ReadonlySet<UnitId> {
    const cached = subtreeCache.get(unitId)
    if (cached !== undefined) return cached
    const subtree = new Set<UnitId>([unitId, ...descendantsOf(tree, unitId)])
    subtreeCache.set(unitId, subtree)
    return subtree
  }

  function unitLiveOn(unit: RuleUnit, date: CalendarDate): boolean {
    return unit.archived_at === null && covers(unit.valid_from, unit.valid_to, date)
  }

  /** NULL = the rule has no deployment; undefined = its deployment does not run on `date`. */
  function deploymentOn(rule: RuleShape, date: CalendarDate): RuleDeployment | null | undefined {
    if (rule.deployment_id === null) return null
    const deployment = deployments.get(rule.deployment_id)
    if (deployment === undefined || deployment.archived_at !== null) return undefined
    return covers(deployment.start_date, deployment.end_date, date) ? deployment : undefined
  }

  function appliesOn(rule: RuleShape, date: CalendarDate): boolean {
    if (!rule.is_enabled || rule.archived_at !== null) return false
    if (!covers(rule.effective_from, rule.effective_to, date)) return false
    return deploymentOn(rule, date) !== undefined
  }

  /** The evaluated units (D-071). NULL = the whole organization. Archived units are no target. */
  function targetUnits(rule: RuleShape, date: CalendarDate): (UnitId | null)[] {
    const live = (unit: RuleUnit | undefined): unit is RuleUnit => unit !== undefined && unitLiveOn(unit, date)
    const atLevel = (unit: RuleUnit) => unit.unit_level_id === rule.scope_level_id
    if (rule.scope_unit_id === null) {
      switch (rule.scope_mode) {
        case RuleScopeMode.enum.unit_tree:
          return [null]
        case RuleScopeMode.enum.each_child:
          return units.filter((unit) => unit.parent_id === null && live(unit)).map((unit) => unit.id)
        case RuleScopeMode.enum.each_descendant_at_level:
          return units.filter((unit) => live(unit) && atLevel(unit)).map((unit) => unit.id)
      }
    }
    const scope = unitsById.get(rule.scope_unit_id)
    if (!live(scope)) return []
    switch (rule.scope_mode) {
      case RuleScopeMode.enum.unit_tree:
        return [scope.id]
      case RuleScopeMode.enum.each_child:
        return (tree.children.get(scope.id) ?? []).filter((id) => live(unitsById.get(id)))
      case RuleScopeMode.enum.each_descendant_at_level:
        return descendantsOf(tree, scope.id).filter((id) => {
          const unit = unitsById.get(id)
          return live(unit) && atLevel(unit)
        })
    }
  }

  function inDeployment(deployment: RuleDeployment | null, soldierId: SoldierId, date: CalendarDate): boolean {
    if (deployment === null) return true
    // Listed members on their days, else the whole unit (D-259, D-221): one test for every caller (D-336).
    return rotationMembership.servesOn(deployment, soldierId, date)
  }

  function membersOf(rule: RuleShape, unitId: UnitId | null, date: CalendarDate): SoldierId[] {
    const deployment = deploymentOn(rule, date) ?? null
    const subtree = unitId === null ? null : subtreeOf(unitId)
    const members: SoldierId[] = []
    for (const [soldierId, placedUnit] of placedOn(date)) {
      if (subtree !== null && !subtree.has(placedUnit)) continue
      if (!inDeployment(deployment, soldierId, date)) continue
      if (!filters.matches(rule.population_filter, soldierId, date)) continue
      members.push(soldierId)
    }
    return members
  }

  /** Groups of a target (D-072): positive selections of the filter plus what members hold. */
  function groupsOf(rule: RuleShape, members: readonly SoldierId[]): Group[] {
    switch (rule.group_by) {
      case RuleGroupBy.enum.none:
        return [{ value: null, members }]
      case RuleGroupBy.enum.tag: {
        const held = members.flatMap((id) => [...(tagsBySoldier.get(id) ?? [])])
        const ids = sortedIds([...positiveSelections(rule.population_filter).tag_ids, ...held]).filter((id) => {
          const tag = tags.get(id)
          if (tag === undefined || tag.archived_at !== null) return false
          return rule.group_tag_category_id === null || tag.category_id === rule.group_tag_category_id
        })
        return ids.map((tagId) => ({
          value: { group_by: RuleGroupBy.enum.tag, tag_id: tagId },
          members: members.filter((id) => tagsBySoldier.get(id)?.has(tagId) === true),
        }))
      }
      case RuleGroupBy.enum.command_rank: {
        const held = members.flatMap((id) => {
          const rankId = soldierById.get(id)?.command_rank_id
          return rankId === undefined || rankId === null ? [] : [rankId]
        })
        const ids = sortedIds([...positiveSelections(rule.population_filter).command_rank_ids, ...held]).filter((id) => {
          const rank = ranks.get(id)
          return rank !== undefined && rank.archived_at === null
        })
        return ids.map((rankId) => ({
          value: { group_by: RuleGroupBy.enum.command_rank, command_rank_id: rankId },
          members: members.filter((id) => soldierById.get(id)?.command_rank_id === rankId),
        }))
      }
    }
  }

  function plan(rules: Iterable<RuleShape>, dates: readonly CalendarDate[]): Plan {
    const ruleList = [...rules]
    const populationKeys = new Map(ruleList.map((rule) => [rule.id, filterKey(rule.population_filter)]))
    const targets: PlannedTarget[] = []
    for (const date of dates) {
      for (const rule of ruleList) {
        if (!appliesOn(rule, date)) continue
        const populationKey = populationKeys.get(rule.id) ?? filterKey(rule.population_filter)
        for (const unitId of targetUnits(rule, date)) {
          for (const group of groupsOf(rule, membersOf(rule, unitId, date))) {
            targets.push({
              key: targetKey(unitId, populationKey, group.value, date),
              rule,
              scope_unit_id: unitId,
              population_key: populationKey,
              group: group.value,
              date,
              members: group.members,
              thresholds: ruleThresholds(rule, group.members.length),
              overridden_by: [],
            })
          }
        }
      }
    }
    return { targets, conflicts: resolvePriority(targets) }
  }

  return { plan }
}

/** Marks overridden targets and returns the configuration conflicts (D-031). */
function resolvePriority(targets: readonly PlannedTarget[]): RuleConflict[] {
  const byKey = new Map<string, PlannedTarget[]>()
  for (const target of targets) {
    const same = byKey.get(target.key)
    if (same === undefined) byKey.set(target.key, [target])
    else same.push(target)
  }
  const conflicts: RuleConflict[] = []
  for (const same of byKey.values()) {
    const top = Math.max(...same.map((target) => target.rule.priority))
    const effective = same.filter((target) => target.rule.priority === top)
    const winners = [...new Set(effective.map((target) => target.rule.id))]
    for (const target of same) {
      if (target.rule.priority < top) target.overridden_by = winners
    }
    const mins = effective.flatMap((target) => (target.thresholds.required_min === null ? [] : [target.thresholds.required_min]))
    const maxes = effective.flatMap((target) => (target.thresholds.allowed_max === null ? [] : [target.thresholds.allowed_max]))
    if (mins.length === 0 || maxes.length === 0) continue
    const requiredMin = Math.max(...mins)
    const allowedMax = Math.min(...maxes)
    if (requiredMin <= allowedMax) continue
    const first = effective[0]
    if (first === undefined) continue
    conflicts.push({
      scope_unit_id: first.scope_unit_id,
      population_key: first.population_key,
      group: first.group,
      date: first.date,
      rule_ids: [
        ...new Set(
          effective
            .filter((target) => target.thresholds.required_min === requiredMin || target.thresholds.allowed_max === allowedMax)
            .map((target) => target.rule.id),
        ),
      ],
      required_min: requiredMin,
      allowed_max: allowedMax,
    })
  }
  return conflicts
}

function measure(target: PlannedTarget, availability: AvailabilityContext): RuleTargetResult {
  const options = { count_pending_as_unavailable: target.rule.count_pending_as_unavailable }
  const unavailable = target.members.filter((id) => !availability.isAvailable(id, target.date, options))
  const available = target.members.length - unavailable.length
  const { required_min, allowed_max } = target.thresholds
  const broken: RuleBound[] = []
  if (required_min !== null && available < required_min) broken.push(RuleBound.enum.min)
  if (allowed_max !== null && available > allowed_max) broken.push(RuleBound.enum.max)
  return {
    rule_id: target.rule.id,
    enforcement: target.rule.enforcement,
    priority: target.rule.priority,
    scope_unit_id: target.scope_unit_id,
    population_key: target.population_key,
    group: target.group,
    date: target.date,
    members: target.members,
    available,
    unavailable: sortedIds(unavailable),
    required_min,
    allowed_max,
    broken,
    overridden_by: target.overridden_by,
  }
}

function focusFilter(plan: Plan, soldierIds: Iterable<SoldierId> | undefined): Plan {
  if (soldierIds === undefined) return plan
  const focus = new Set(soldierIds)
  const touched = (target: PlannedTarget) => target.members.some((id) => focus.has(id))
  const touchedKeys = new Set(plan.targets.filter(touched).map((target) => target.key))
  return {
    targets: plan.targets.filter(touched),
    conflicts: plan.conflicts.filter((conflict) =>
      touchedKeys.has(targetKey(conflict.scope_unit_id, conflict.population_key, conflict.group, conflict.date)),
    ),
  }
}

function sortedDates(dates: Iterable<CalendarDate>): CalendarDate[] {
  return [...new Set(dates)].sort(compareDates)
}

/** The indexed snapshot. Build once with `createRuleContext`, evaluate many times. */
export interface RuleContext {
  evaluate(rules: Iterable<RuleShape>, request: RuleEvaluationRequest): RuleEvaluation
}

export function createRuleContext(data: RuleData): RuleContext {
  const structure = createStructure(data)
  const availability = createAvailabilityContext(data)
  return {
    evaluate(rules, request) {
      // Priority is resolved on every target before the focus filter, so a higher-priority
      // rule that does not count the focused soldiers still overrides (D-031).
      const plan = focusFilter(structure.plan(rules, sortedDates(request.dates)), request.soldier_ids)
      return { targets: plan.targets.map((target) => measure(target, availability)), conflicts: plan.conflicts }
    },
  }
}

/** Internal: one plan measured against two leave sets (before and after a change). */
export function evaluateBeforeAfter(
  data: RuleData,
  after: AvailabilityData['leaves'],
  rules: Iterable<RuleShape>,
  request: RuleEvaluationRequest,
): { before: readonly RuleTargetResult[]; after: readonly RuleTargetResult[] } {
  const structure = createStructure(data)
  const plan = focusFilter(structure.plan(rules, sortedDates(request.dates)), request.soldier_ids)
  const leaveTypes = [...data.leave_types]
  const beforeAvailability = createAvailabilityContext({ leaves: data.leaves, leave_types: leaveTypes })
  const afterAvailability = createAvailabilityContext({ leaves: after, leave_types: leaveTypes })
  return {
    before: plan.targets.map((target) => measure(target, beforeAvailability)),
    after: plan.targets.map((target) => measure(target, afterAvailability)),
  }
}
