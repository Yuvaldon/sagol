import type {
  AvailabilityRule,
  CalendarDate,
  Leave,
  PermissionCheck,
  PolicyTarget,
  Result,
  RuleViolation,
  Unit,
  UnitId,
} from '@contracts'
import { EVERY_SOLDIER, compareDates, type AvailabilityLeave, type RuleData } from '@domain'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useFilterSource } from '../filters/source'
import { useLeaves, useLeaveTypes } from '../leaves/hooks'
import { checkOf } from '../permissions/checks'
import { useCan } from '../permissions/hooks'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { loaded, type Loaded } from '../queries/loaded'
import { unwrap } from '../queries/results'
import { useUnitsWithArchived } from '../roster/hooks'
import { usePorts } from '../runtime/context'
import { useTags } from '../tags/hooks'
import {
  dayViolations,
  heatRow,
  leaveViolations,
  ruleDataOf,
  windowConflicts,
  type HeatDay,
  type WindowConflict,
} from './evaluation'
import { toCreateRuleInput, toUpdateRuleInput, type RuleFormValues } from './rules'

// Reading and changing availability rules, and evaluating them over what the actor reads (D-139 … D-142).

const LIVE = { include_archived: false }

/** The live rules the actor sees, by priority then name (D-140). */
export function useAvailabilityRules(): Loaded<readonly AvailabilityRule[]> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.availabilityRules, LIVE],
      queryFn: () => unwrap(data.repositories.availability_rules.list(LIVE)),
    }),
  )
}

export function useRuleCommands() {
  const { data } = usePorts()
  const rules = data.commands.availability_rules
  const keys = [QUERY_KEYS.availabilityRules]
  const create = useCommand(keys, (values: RuleFormValues) => rules.create(toCreateRuleInput(values)))
  const update = useCommand(
    keys,
    async ({ rule, openedVersion, values }: { rule: AvailabilityRule; openedVersion: number; values: RuleFormValues }) => {
      const input = toUpdateRuleInput(rule, openedVersion, values)
      const unchanged: Result<AvailabilityRule> = { ok: true, value: rule }
      return input === null ? unchanged : rules.update(input)
    },
  )
  const archive = useCommand(keys, (rule: AvailabilityRule) => rules.archive({ id: rule.id, expected_version: rule.version }))
  return { create, update, archive }
}

// ---------------------------------------------------------------------- hints

const ORGANIZATION: PolicyTarget = { kind: 'organization' }

/** A rule's target: its scope unit, or the organization when global (D-053, D-139). */
function targetOf(scopeUnitId: UnitId | null): PolicyTarget {
  return scopeUnitId === null ? ORGANIZATION : { kind: 'unit', unit_id: scopeUnitId }
}

const ruleCheck = (action: 'create' | 'update' | 'delete', scopeUnitId: UnitId | null): PermissionCheck =>
  checkOf({ resource: 'availability_rules', action }, targetOf(scopeUnitId))

/**
 * Where the actor may create, change and archive rules (D-139): globally, and on each unit they see. A hint: the
 * command decides again.
 */
export function useRulePermissions(units: readonly Unit[], rules: readonly AvailabilityRule[]) {
  const checks = useMemo(() => {
    const scopes = [null, ...units.map((unit) => unit.id), ...rules.map((rule) => rule.scope_unit_id)]
    return [...new Set(scopes)].flatMap((scope) => [
      ruleCheck('create', scope),
      ruleCheck('update', scope),
      ruleCheck('delete', scope),
    ])
  }, [units, rules])
  const can = useCan(checks)
  return useMemo(
    () => ({
      /** Where a new rule may go: NULL is the whole organization. */
      createIn: (scopeUnitId: UnitId | null) => can(ruleCheck('create', scopeUnitId)),
      createAny: [null, ...units.map((unit) => unit.id)].some((scope) => can(ruleCheck('create', scope))),
      update: (rule: AvailabilityRule) => can(ruleCheck('update', rule.scope_unit_id)),
      /** Moving a rule needs `update` where it lands too. */
      moveTo: (scopeUnitId: UnitId | null) => can(ruleCheck('update', scopeUnitId)),
      archive: (rule: AvailabilityRule) => can(ruleCheck('delete', rule.scope_unit_id)),
    }),
    [can, units],
  )
}

// ------------------------------------------------------------------ evaluation

interface Span {
  readonly from: CalendarDate
  readonly to: CalendarDate
}

/** What rule evaluation reads on the days of a span, over what the actor reads. Loading while there is no span. */
export function useRuleData(span: Span | null): Loaded<RuleData> {
  const source = useFilterSource()
  const units = useUnitsWithArchived()
  const tags = useTags()
  const leaves = useLeaves(span)
  const types = useLeaveTypes()
  return useMemo((): Loaded<RuleData> => {
    if (source.status !== 'ready') return source
    if (units.status !== 'ready') return units
    if (tags.status !== 'ready') return tags
    if (leaves.status !== 'ready') return leaves
    if (types.status !== 'ready') return types
    return {
      status: 'ready',
      value: ruleDataOf({ source: source.value, units: units.value, tags: tags.value, leaves: leaves.value, types: types.value }),
    }
  }, [source, units, tags, leaves, types])
}

interface WindowRequest {
  readonly from: CalendarDate
  readonly to: CalendarDate
  readonly days: readonly CalendarDate[]
}

/** The rules and their data for a window, or NULL when the actor sees no rule: the heat row then has no place. */
function useWindowEvaluation(window: WindowRequest | null): Loaded<{ rules: readonly AvailabilityRule[]; data: RuleData } | null> {
  const rules = useAvailabilityRules()
  const data = useRuleData(window)
  return useMemo(() => {
    if (rules.status !== 'ready') return rules
    if (rules.value.length === 0) return { status: 'ready', value: null }
    if (data.status !== 'ready') return data
    return { status: 'ready', value: { rules: rules.value, data: data.value } }
  }, [rules, data])
}

/** The heat row of the board (D-141). NULL when the actor sees no rule. */
export function useHeatRow(window: WindowRequest | null, unitId: UnitId | null): Loaded<readonly HeatDay[] | null> {
  const evaluation = useWindowEvaluation(window)
  return useMemo(() => {
    if (evaluation.status !== 'ready') return evaluation
    if (evaluation.value === null || window === null) return { status: 'ready', value: null }
    return { status: 'ready', value: heatRow({ ...evaluation.value, days: window.days, unitId }) }
  }, [evaluation, window, unitId])
}

/** The broken rules of one day for the board's unit (D-141). */
export function useDayViolations(day: CalendarDate | null, unitId: UnitId | null): Loaded<readonly RuleViolation[]> {
  const window = useMemo(() => (day === null ? null : { from: day, to: day, days: [day] }), [day])
  const evaluation = useWindowEvaluation(window)
  return useMemo(() => {
    if (evaluation.status !== 'ready') return evaluation
    if (evaluation.value === null || day === null) return { status: 'ready', value: [] }
    return { status: 'ready', value: dayViolations({ ...evaluation.value, day, unitId }) }
  }, [evaluation, day, unitId])
}

/** The configuration conflicts on the days of the board's window (D-140). */
export function useRuleConflicts(window: WindowRequest | null): Loaded<readonly WindowConflict[]> {
  const evaluation = useWindowEvaluation(window)
  return useMemo(() => {
    if (evaluation.status !== 'ready') return evaluation
    if (evaluation.value === null || window === null) return { status: 'ready', value: [] }
    return { status: 'ready', value: windowConflicts({ ...evaluation.value, days: window.days }) }
  }, [evaluation, window])
}

/**
 * The live warning of a form (D-142): what the leave, as the command would leave it, breaks. `stored` is the leave
 * before an edit, so the days it leaves are judged too. Empty while the form is not complete.
 *
 * Loading until the first answer, and failed when a read fails (OI-099). Once it has answered, a new span keeps the
 * last answer until its own data arrives, so a drag that crosses days does not flash "nothing broken".
 */
export function useLeaveRuleCheck(changed: AvailabilityLeave | null, stored: Leave | null = null): Loaded<readonly RuleViolation[]> {
  const can = useCan(READS_EVERYTHING)
  const readsEverything = READS_EVERYTHING.every(can)
  const span = useMemo(() => {
    if (changed === null || !readsEverything) return null
    const dates = [changed.start_date, changed.end_date, ...(stored === null ? [] : [stored.start_date, stored.end_date])].sort(compareDates)
    const [from] = dates
    const to = dates.at(-1)
    return from === undefined || to === undefined ? null : { from, to }
  }, [changed, stored, readsEverything])
  const rules = useAvailabilityRules()
  const data = useRuleData(span)
  const current = useMemo((): Loaded<readonly RuleViolation[]> => {
    if (changed === null || !readsEverything) return NO_CHECK
    if (rules.status !== 'ready') return rules
    if (rules.value.length === 0) return NO_CHECK
    if (data.status !== 'ready') return data
    return { status: 'ready', value: leaveViolations(data.value, rules.value, changed) }
  }, [changed, readsEverything, rules, data])
  // The last answer, kept from an earlier render (React's "storing information from previous renders").
  const [last, setLast] = useState<Loaded<readonly RuleViolation[]> | null>(null)
  // A new candidate after none starts loading afresh.
  if (changed === null ? last !== null : current.status === 'ready' && current !== last) setLast(changed === null ? null : current)
  return current.status === 'loading' && last !== null ? last : current
}

/** The live warning as a list: nothing while it loads or fails. */
export function useLeaveRuleWarnings(changed: AvailabilityLeave | null, stored: Leave | null = null): readonly RuleViolation[] {
  const check = useLeaveRuleCheck(changed, stored)
  return check.status === 'ready' ? check.value : NO_VIOLATIONS
}

/**
 * What a rule counts, at organization scope with `any` (D-162). An actor who reads less sees a rule only through the
 * command's answer, because a warning from part of the data could differ from it.
 */
const READS_EVERYTHING: readonly PermissionCheck[] = [
  checkOf({ resource: 'soldiers', action: 'view' }, EVERY_SOLDIER),
  checkOf({ resource: 'memberships', action: 'view' }, EVERY_SOLDIER),
  checkOf({ resource: 'leaves', action: 'view' }, EVERY_SOLDIER),
]

const NO_VIOLATIONS: readonly RuleViolation[] = []
const NO_CHECK: Loaded<readonly RuleViolation[]> = { status: 'ready', value: NO_VIOLATIONS }
