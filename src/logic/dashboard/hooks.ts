import { DASHBOARD, DASHBOARD_TEMPLATES } from '@config'
import {
  DASHBOARD_METRIC_IDS,
  DASHBOARD_MODULE_IDS,
  type CalendarDate,
  type DashboardLayout,
  type DashboardModule,
  type DashboardTemplateId,
  type Deployment,
  type Leave,
  type LeaveEvent,
  type LeaveId,
  type PermissionCheck,
  type Soldier,
  type SoldierId,
  type Unit,
  type UnitId,
  type UnitMembership,
} from '@contracts'
import {
  LEAVE_PERMISSIONS,
  addDays,
  addModule,
  ancestorsOf,
  buildUnitTree,
  compareDates,
  defaultTemplate,
  descendantsOf,
  eachDay,
  layoutModules,
  layoutTemplate,
  moduleKey,
  moveModule,
  planOf,
  primaryUnitOn,
  removeModule,
  spanCovers,
  spansOverlap,
  startOfDay,
  templateChoice,
  type PlanEvent,
  type UnitTree,
} from '@domain'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useDeployments, useRotationMembership } from '../deployments/hooks'
import { useFilterSource } from '../filters/source'
import { useLeaveTypeGroups, useLeaveTypes, useLeaves, useLeavesOfAnyStatus } from '../leaves/hooks'
import { usePendingRequests } from '../leaves/workflowHooks'
import { checkOn } from '../permissions/checks'
import { useCanAnswers } from '../permissions/hooks'
import { type BoardGroupLabel } from '../board/rows'
import { useDayReport, useReportConfirmations } from '../presence/hooks'
import { QUERY_KEYS } from '../queries/client'
import { loaded, type Loaded } from '../queries/loaded'
import { unwrap } from '../queries/results'
import { useRuleDays, type RuleDay } from '../rules/hooks'
import { usePorts } from '../runtime/context'
import { useSession } from '../session/hooks'
import { useMyPreferences, useUpdateMyPreferences } from '../session/preferences'
import { useTimezone } from '../session/today'
import { bySortOrder } from '../units/tree'
import { unitFilterOf } from '../view-state/filter'
import { useChangeSearch, useWorkspaceSearch } from '../view-state/search'
import { rotationDays, scopeRotations, useDateWindow, type DateWindow } from '../view-state/window'
import { dashboardTally, planTally, type DashboardRowInput, type DashboardTally, type PlanTally } from './tally'

// The command dashboard (D-349): its scope, the one tally every module reads, the parts that need more than the tally,
// and the board the actor keeps. Everything is derived on each render; only the layout is stored (P-6).

/** The scope the board reads: a unit, the workspace's window, and whether future days count. */
export interface DashboardScope {
  /** The units the actor may pick: live ones that hold, or are above, a soldier the actor reads in the span. */
  readonly units: readonly Unit[]
  readonly unitId: UnitId
  /** The unit's live direct sub-units, in the tree's order. */
  readonly subUnitIds: readonly UnitId[]
  readonly window: DateWindow
  /** The rotation the window shows; NULL for a routine range. */
  readonly rotation: Deployment | null
  readonly today: CalendarDate
  readonly planned: boolean
  readonly rows: readonly DashboardRowInput[]
}

/** The plan of a started rotation against what happened since (P-9). */
export interface DashboardPlan extends PlanTally {
  readonly added: number
  readonly cancelled: number
  readonly moved: number
}

/** The unit's rules over the counted days and the days ahead; per sub-unit, today's day. */
export interface DashboardRules {
  /** Counted days on which the unit is below a minimum. */
  readonly belowDays: number
  /** The next day ahead below a minimum, counting approved and pending leaves; NULL when none is. */
  readonly nextBelow: CalendarDate | null
  /** The unit's days, the counted ones; empty where no rule concerns it. */
  readonly days: ReadonlyMap<CalendarDate, RuleDay>
  /** Days ahead that break a rule, soonest first. */
  readonly ahead: readonly CalendarDate[]
  /** Today's rule day of each sub-unit a rule concerns. */
  readonly today: ReadonlyMap<UnitId, RuleDay>
}

export type OutstandingItem =
  | { readonly kind: 'request'; readonly leave: Leave }
  | { readonly kind: 'rule'; readonly date: CalendarDate }

export interface DashboardOutstanding {
  /** Up to `DASHBOARD.outstandingLimit`: requests oldest first, then rule days soonest first. */
  readonly items: readonly OutstandingItem[]
  readonly total: number
}

export interface ReportSectionStatus {
  readonly key: string
  readonly unitId: UnitId | null
  readonly label: BoardGroupLabel
  readonly status: 'confirmed' | 'not_yet' | 'changed_since'
}

/** Today's report of the unit (D-293). */
export interface DashboardReport {
  readonly date: CalendarDate
  readonly sections: readonly ReportSectionStatus[]
  readonly unconfirmed: number
  readonly present: number
  readonly absent: number
}

export interface Dashboard {
  readonly scope: DashboardScope
  readonly tally: DashboardTally
  /** NULL where the board draws no plan: a routine range, a rotation not started, or no plan module on the board. */
  readonly plan: Loaded<DashboardPlan> | null
  /** NULL when the actor sees no rule in the unit. */
  readonly rules: Loaded<DashboardRules | null>
  /** Whether the actor holds `leaves:approve` over a row. */
  readonly approver: boolean
  /** The rows' requests awaiting the actor, oldest first. */
  readonly requests: Loaded<readonly Leave[]>
  /** NULL where no report is read: a routine range, a span without today, or no section to confirm. */
  readonly report: Loaded<DashboardReport | null>
}

export type ModuleState = 'hidden' | 'loading' | 'ready' | 'failed'

const NO_ROTATIONS: readonly Deployment[] = []
const NO_DAYS: readonly CalendarDate[] = []
const NO_CHECKS: readonly PermissionCheck[] = []

/** The modules that read the plan. */
const PLAN_MODULES = (module: DashboardModule) =>
  module.module === 'plan_vs_actual' || (module.module === 'stat' && module.metric === 'plan_drift')

/** The modules that read today's report. */
const REPORT_MODULES = (module: DashboardModule) =>
  module.module === 'report_status' || (module.module === 'stat' && module.metric === 'unconfirmed_units')

/** The direct child of `unitId` on the way from `memberUnit` up, `unitId` itself for its own members, or NULL. */
function subUnitOf(tree: UnitTree, unitId: UnitId, memberUnit: UnitId): UnitId | null | undefined {
  if (memberUnit === unitId) return null
  const path = [memberUnit, ...ancestorsOf(tree, memberUnit)]
  const at = path.indexOf(unitId)
  return at > 0 ? path[at - 1] : undefined
}

interface RowsInput {
  readonly tree: UnitTree
  readonly unitId: UnitId
  readonly window: DateWindow
  readonly rotation: Deployment | null
  readonly servesInRotation: ((soldierId: SoldierId, day: CalendarDate) => boolean) | null
  readonly today: CalendarDate
  readonly memberships: readonly UnitMembership[]
}

/**
 * The rows of the unit (P-3): who serves in the span in the unit's tree. In a rotation, its days, with a membership in
 * the tree that day or the rotation's unit in the tree; in a routine range, a membership in the tree that day.
 */
function rowsOf(input: RowsInput & { readonly readable: readonly Soldier[] }): DashboardRowInput[] {
  const { tree, unitId, window, rotation, servesInRotation } = input
  const inTree = new Set<UnitId>([unitId, ...descendantsOf(tree, unitId)])
  const rotationInTree = rotation !== null && inTree.has(rotation.unit_id)
  const span = { valid_from: window.from, valid_to: window.to }
  return input.readable.flatMap((soldier) => {
    const own = input.memberships.filter(
      (membership) => membership.soldier_id === soldier.id && inTree.has(membership.unit_id) && spansOverlap(membership, span),
    )
    if (own.length === 0 && !rotationInTree) return []
    const inUnit = (day: CalendarDate) => own.some((membership) => spanCovers(membership, day))
    const serves =
      servesInRotation === null
        ? inUnit
        : (day: CalendarDate) => servesInRotation(soldier.id, day) && (rotationInTree || inUnit(day))
    if (!window.days.some(serves)) return []
    // The sub-unit of the membership that holds today, else of the first in the span; a primary one before others.
    const ordered = [...own].sort(
      (a, b) =>
        Number(spanCovers(b, input.today)) - Number(spanCovers(a, input.today)) ||
        Number(b.membership_type === 'primary') - Number(a.membership_type === 'primary') ||
        compareDates(a.valid_from, b.valid_from),
    )
    const first = ordered[0]
    const subUnitId = first === undefined ? null : (subUnitOf(tree, unitId, first.unit_id) ?? null)
    return [{ soldier, subUnitId, serves }]
  })
}

/** The live units that hold, or are above, a membership of a readable soldier in the span; in tree order. */
function pickableUnits(
  units: readonly Unit[],
  tree: UnitTree,
  readable: ReadonlySet<SoldierId>,
  memberships: readonly UnitMembership[],
  window: DateWindow,
): Unit[] {
  const span = { valid_from: window.from, valid_to: window.to }
  const held = new Set<UnitId>()
  for (const membership of memberships) {
    if (!readable.has(membership.soldier_id) || !spansOverlap(membership, span)) continue
    for (const unitId of [membership.unit_id, ...ancestorsOf(tree, membership.unit_id)]) held.add(unitId)
  }
  return units.filter((unit) => held.has(unit.id))
}

/** The board's unit: the URL's when it may be picked, else the actor's own unit today, else the first. */
function chosenUnit(pickable: readonly Unit[], asked: UnitId | undefined, own: UnitId | null): UnitId | null {
  const ids = new Set(pickable.map((unit) => unit.id))
  if (asked !== undefined && ids.has(asked)) return asked
  if (own !== null && ids.has(own)) return own
  return pickable[0]?.id ?? null
}

/** The leaves the tally reads: the span, the day before today and the days ahead. */
function leaveSpanOf(window: DateWindow, today: CalendarDate) {
  const before = addDays(today, -1)
  const ahead = addDays(today, DASHBOARD.upcomingDays)
  return {
    from: compareDates(window.from, before) <= 0 ? window.from : before,
    to: compareDates(window.to, ahead) >= 0 ? window.to : ahead,
  }
}

function aheadWindow(today: CalendarDate) {
  const to = addDays(today, DASHBOARD.outstandingDays - 1)
  return { from: today, to, days: eachDay({ start_date: today, end_date: to }) }
}

/** The scope, the tally and the parts of the board; `modules` are the board's, so the plan and report load only for it. */
export function useDashboard(modules: readonly DashboardModule[]): Loaded<Dashboard> | null {
  const search = useWorkspaceSearch()
  const session = useSession()
  const timezone = useTimezone()
  const { window, today } = useDateWindow()
  const deployments = useDeployments()
  const membership = useRotationMembership()
  const rotation = useMemo((): Deployment | null => {
    if (window?.kind !== 'rotation' || deployments.status !== 'ready') return null
    return deployments.value.find((deployment) => deployment.id === window.rotationId) ?? null
  }, [window, deployments])
  const source = useFilterSource(rotation?.id ?? null)
  const soldiers = source.status === 'ready' ? source.value.soldiers : null
  const checks = useMemo(
    () =>
      soldiers === null
        ? NO_CHECKS
        : soldiers.flatMap((soldier) => [checkOn(LEAVE_PERMISSIONS.view, soldier.id), checkOn(LEAVE_PERMISSIONS.approve, soldier.id)]),
    [soldiers],
  )
  const answers = useCanAnswers(checks)
  const actorId = session.status === 'ready' && session.value.status === 'linked' ? session.value.soldier_id : null

  const scope = useMemo((): Loaded<DashboardScope> | null => {
    if (window === null || today === null) return { status: 'loading' }
    if (source.status !== 'ready') return source
    if (deployments.status !== 'ready') return deployments
    if (window.kind === 'rotation' && (rotation === null || membership === null)) return { status: 'loading' }
    if (!checks.every((check) => answers.known(check))) return { status: 'loading' }
    const { units, unitTree, memberships } = source.value
    const tree = buildUnitTree(unitTree)
    const readableSoldiers = source.value.soldiers.filter((soldier) => answers.can(checkOn(LEAVE_PERMISSIONS.view, soldier.id)))
    const readable = new Set(readableSoldiers.map((soldier) => soldier.id))
    const pickable = pickableUnits(units, tree, readable, memberships, window)
    const own = actorId === null ? null : primaryUnitOn(memberships, actorId, today)
    const unitId = chosenUnit(pickable, search.unit, own)
    if (unitId === null) return null
    const servesInRotation =
      rotation === null || membership === null
        ? null
        : (soldierId: SoldierId, day: CalendarDate) => membership.servesOn(rotation, soldierId, day)
    const rows = rowsOf({ tree, unitId, window, rotation, servesInRotation, today, readable: readableSoldiers, memberships })
    const subUnitIds = units
      .filter((unit) => unit.parent_id === unitId)
      .sort(bySortOrder)
      .map((unit) => unit.id)
    return {
      status: 'ready',
      value: { units: pickable, unitId, subUnitIds, window, rotation, today, planned: search.planned === true, rows },
    }
  }, [window, today, source, deployments, rotation, membership, checks, answers, actorId, search.unit, search.planned])

  const ready = scope?.status === 'ready' ? scope.value : null
  const leaves = useLeaves(ready === null ? null : leaveSpanOf(ready.window, ready.today))
  const types = useLeaveTypes()
  const groups = useLeaveTypeGroups()

  const tally = useMemo((): Loaded<DashboardTally> | null => {
    if (scope === null) return null
    if (scope.status !== 'ready') return scope
    if (leaves.status !== 'ready') return leaves
    if (types.status !== 'ready') return types
    if (groups.status !== 'ready') return groups
    const { window: span, today: day, planned, rows, subUnitIds } = scope.value
    const ids = new Set(rows.map((row) => row.soldier.id))
    return {
      status: 'ready',
      value: dashboardTally({
        days: span.days,
        today: day,
        planned,
        rows,
        subUnitIds,
        leaves: leaves.value.filter((leave) => ids.has(leave.soldier_id)),
        types: types.value,
        groups: groups.value,
      }),
    }
  }, [scope, leaves, types, groups])

  const counted = tally?.status === 'ready' ? tally.value.counted : NO_DAYS
  const plan = usePlan(ready, counted, timezone, modules.some(PLAN_MODULES))
  const rules = useRules(ready, counted)
  const pending = usePendingRequests()
  const requests = useMemo((): Loaded<readonly Leave[]> => {
    if (pending.status !== 'ready' || ready === null) return pending.status === 'ready' ? { status: 'loading' } : pending
    const ids = new Set(ready.rows.map((row) => row.soldier.id))
    const own = pending.value.filter((leave) => ids.has(leave.soldier_id))
    return { status: 'ready', value: [...own].sort((a, b) => a.created_at.localeCompare(b.created_at)) }
  }, [pending, ready])
  const report = useReport(ready, deployments.status === 'ready' ? deployments.value : NO_ROTATIONS, modules.some(REPORT_MODULES))

  return useMemo((): Loaded<Dashboard> | null => {
    if (tally === null || scope === null) return null
    if (tally.status !== 'ready') return tally
    if (scope.status !== 'ready') return scope
    const approver = scope.value.rows.some((row) => answers.can(checkOn(LEAVE_PERMISSIONS.approve, row.soldier.id)))
    return { status: 'ready', value: { scope: scope.value, tally: tally.value, plan, rules, approver, requests, report } }
  }, [tally, scope, plan, rules, requests, report, answers])
}

/** The rotation's leaves of the rows, now and at the rotation's first day (P-9). */
function usePlan(
  scope: DashboardScope | null,
  counted: readonly CalendarDate[],
  timezone: string | null,
  wanted: boolean,
): Loaded<DashboardPlan> | null {
  const { data } = usePorts()
  const rotation = scope?.rotation ?? null
  const started = rotation !== null && scope !== null && compareDates(rotation.start_date, scope.today) <= 0
  const active = wanted && started && timezone !== null
  const query = useMemo(
    () =>
      !active || rotation === null || scope === null
        ? null
        : { deployment_id: rotation.id, soldier_ids: scope.rows.map((row) => row.soldier.id).sort() },
    [active, rotation, scope],
  )
  const events: Loaded<readonly LeaveEvent[]> = loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.leaveEvents, query],
      queryFn: () => (query === null ? Promise.resolve([]) : unwrap(data.repositories.leave_events.list(query))),
      enabled: query !== null,
    }),
  )
  const leaves = useLeavesOfAnyStatus(active && rotation !== null ? rotationDays(rotation) : null)
  const types = useLeaveTypes()
  return useMemo((): Loaded<DashboardPlan> | null => {
    if (!active || rotation === null || scope === null || timezone === null) return null
    if (events.status !== 'ready') return events
    if (leaves.status !== 'ready') return leaves
    if (types.status !== 'ready') return types
    const ids = new Set(scope.rows.map((row) => row.soldier.id))
    const own = leaves.value.filter((leave) => leave.deployment_id === rotation.id && ids.has(leave.soldier_id))
    const byLeave = new Map<LeaveId, PlanEvent[]>()
    for (const event of events.value) byLeave.set(event.leave_id, [...(byLeave.get(event.leave_id) ?? []), event])
    const plan = planOf(own, byLeave, startOfDay(rotation.start_date, timezone))
    const tally = planTally({
      counted,
      rows: scope.rows,
      subUnitIds: scope.subUnitIds,
      planned: plan.planned,
      actual: own,
      types: types.value,
    })
    return { status: 'ready', value: { ...tally, added: plan.added, cancelled: plan.cancelled, moved: plan.moved } }
  }, [active, rotation, scope, timezone, events, leaves, types, counted])
}

/** The rule figures of the unit and its sub-units (D-141, D-173). */
function useRules(scope: DashboardScope | null, counted: readonly CalendarDate[]): Loaded<DashboardRules | null> {
  const first = counted[0]
  const last = counted.at(-1)
  const past = useMemo(
    () => (first === undefined || last === undefined ? null : { from: first, to: last, days: counted }),
    [first, last, counted],
  )
  const today = scope?.today ?? null
  const ahead = useMemo(() => (today === null ? null : aheadWindow(today)), [today])
  const unitIds = useMemo(() => (scope === null ? [] : [scope.unitId, ...scope.subUnitIds]), [scope])
  const rotationId = scope?.rotation?.id ?? null
  const before = useRuleDays(past, rotationId, unitIds)
  const next = useRuleDays(ahead, rotationId, unitIds)
  return useMemo((): Loaded<DashboardRules | null> => {
    if (scope === null) return { status: 'loading' }
    if (before.status !== 'ready') return before
    if (next.status !== 'ready') return next
    const unitAhead = next.value?.get(scope.unitId) ?? null
    const unitPast = before.value?.get(scope.unitId) ?? null
    // A rule the actor sees concerns the unit: on the days ahead, or on the counted days.
    if (unitAhead === null && unitPast === null) return { status: 'ready', value: null }
    const days = new Map((unitPast ?? []).map((day) => [day.date, day]))
    const broken = (unitAhead ?? []).filter((day) => day.broken !== null).map((day) => day.date)
    const todays = new Map<UnitId, RuleDay>()
    for (const unitId of scope.subUnitIds) {
      const day = next.value?.get(unitId)?.find((item) => item.date === scope.today)
      if (day !== undefined) todays.set(unitId, day)
    }
    return {
      status: 'ready',
      value: {
        belowDays: [...days.values()].filter((day) => day.broken !== null).length,
        nextBelow: broken[0] ?? null,
        days,
        ahead: broken,
        today: todays,
      },
    }
  }, [scope, before, next])
}

/** Today's report of the unit, where the span is a rotation that holds today (D-293). */
function useReport(
  scope: DashboardScope | null,
  deployments: readonly Deployment[],
  wanted: boolean,
): Loaded<DashboardReport | null> {
  const source = useFilterSource(scope?.rotation?.id ?? null)
  const active = wanted && scope !== null && scope.rotation !== null && scope.window.holdsToday
  const days = useMemo(() => (active && scope !== null ? [scope.today] : NO_DAYS), [active, scope])
  const unitId = scope?.unitId ?? null
  const rotations = useMemo(
    () => (active && source.status === 'ready' ? scopeRotations(deployments, source.value.units, unitId) : NO_ROTATIONS),
    [active, source, deployments, unitId],
  )
  const filter = useMemo(() => unitFilterOf(unitId) ?? null, [unitId])
  const shown = useDayReport(days, filter, rotations)
  const confirmations = useReportConfirmations(days, shown, rotations)
  return useMemo((): Loaded<DashboardReport | null> => {
    if (!active || scope === null) return { status: 'ready', value: null }
    if (shown.status !== 'ready') return shown
    if (confirmations.status !== 'ready') return confirmations
    const day = shown.value.days[0]
    const states = confirmations.value.get(scope.today)
    if (day === undefined || states === undefined) return { status: 'ready', value: null }
    const sections = day.units.flatMap((section): ReportSectionStatus[] => {
      const state = states.sections.get(section.key)
      return state === undefined ? [] : [{ key: section.key, unitId: section.unitId, label: section.label, status: state.status }]
    })
    if (sections.length === 0) return { status: 'ready', value: null }
    return {
      status: 'ready',
      value: {
        date: scope.today,
        sections,
        unconfirmed: sections.filter((section) => section.status !== 'confirmed').length,
        present: day.counts.present,
        absent: day.counts.absent,
      },
    }
  }, [active, scope, shown, confirmations])
}

/** The rows' requests and the days ahead that break a rule, as one list (D-349). */
export function outstandingOf(dashboard: Dashboard): Loaded<DashboardOutstanding> {
  const { requests, rules, approver } = dashboard
  if (approver && requests.status !== 'ready') return requests
  if (rules.status !== 'ready') return rules
  const all: OutstandingItem[] = [
    ...(approver && requests.status === 'ready' ? requests.value.map((leave) => ({ kind: 'request' as const, leave })) : []),
    ...(rules.value?.ahead ?? []).map((date) => ({ kind: 'rule' as const, date })),
  ]
  return { status: 'ready', value: { items: all.slice(0, DASHBOARD.outstandingLimit), total: all.length } }
}

function stateOf<T>(value: Loaded<T> | null, shown: (value: T) => boolean): ModuleState {
  if (value === null) return 'hidden'
  // A module whose data failed keeps its frame and shows the failure there; the others still draw (D-349).
  if (value.status !== 'ready') return value.status
  return shown(value.value) ? 'ready' : 'hidden'
}

const isSome = <T>(value: T | null) => value !== null

/** Whether a module is drawn for the scope (the spec's "drawn when"): a module with nothing to show is not (D-076). */
export function moduleState(module: DashboardModule, dashboard: Dashboard): ModuleState {
  const { tally, rules, plan, report, approver } = dashboard
  const { figures } = tally
  const ready = (shown: boolean): ModuleState => (shown ? 'ready' : 'hidden')
  if (module.module === 'stat') {
    switch (module.metric) {
      case 'present_today':
      case 'home_today':
        return ready(figures.holdsToday)
      case 'serving':
        return 'ready'
      case 'avg_home_days':
        return ready(figures.fullSpan >= 1)
      case 'fairness_gap':
        return ready(figures.fullSpan >= 2)
      case 'below_minimum_days':
        return stateOf(rules, isSome)
      case 'plan_drift':
        return stateOf(plan, () => true)
      case 'awaiting_me':
        return ready(approver)
      case 'unconfirmed_units':
        return stateOf(report, isSome)
    }
  }
  switch (module.module) {
    case 'heat_map':
      return ready(tally.rows.length > 0)
    case 'presence_trend':
      return ready(tally.counted.length > 0)
    case 'plan_vs_actual':
      return stateOf(plan, () => true)
    case 'fairness_spread':
      return ready(tally.subUnits.length >= 2)
    case 'presence_by_unit':
      return ready(tally.subUnits.length >= 2 && figures.holdsToday)
    case 'home_distribution':
      return ready(figures.fullSpan >= 3)
    case 'home_by_type':
      return ready(tally.homeByType.length > 0)
    case 'upcoming':
      return 'ready'
    case 'outstanding':
      return approver ? 'ready' : stateOf(rules, isSome)
    case 'report_status':
      return stateOf(report, isSome)
  }
}

/** Every module of the catalogue: each module once, a big number once per metric. */
export const DASHBOARD_CATALOGUE: readonly DashboardModule[] = DASHBOARD_MODULE_IDS.flatMap((id): DashboardModule[] =>
  id === 'stat' ? DASHBOARD_METRIC_IDS.map((metric) => ({ module: 'stat', metric })) : [{ module: id }],
)

/**
 * What "הוספת רכיב" offers: the catalogue's modules not on the board that are drawn for the scope. The plan and the
 * report are read only for the board's own modules, so one not on the board is offered where the scope could hold it.
 */
export function addableModules(modules: readonly DashboardModule[], dashboard: Dashboard): DashboardModule[] {
  const on = new Set(modules.map(moduleKey))
  const { scope } = dashboard
  const mayPlan = scope.rotation !== null && compareDates(scope.rotation.start_date, scope.today) <= 0
  const mayReport = scope.rotation !== null && scope.window.holdsToday
  return DASHBOARD_CATALOGUE.filter((module) => {
    if (on.has(moduleKey(module))) return false
    if (PLAN_MODULES(module) && dashboard.plan === null) return mayPlan
    if (REPORT_MODULES(module) && dashboard.report.status === 'ready' && dashboard.report.value === null && !modules.some(REPORT_MODULES)) return mayReport
    const state = moduleState(module, dashboard)
    return state === 'ready' || state === 'loading'
  })
}

/** The board the actor keeps (P-5, P-6): a template, or their own list, stored in their preferences. */
export interface DashboardLayoutState {
  readonly modules: readonly DashboardModule[]
  /** The template the board follows; NULL for the actor's own list. */
  readonly template: DashboardTemplateId | null
  /** The scope's default template. */
  readonly fallback: DashboardTemplateId
  /** Whether the board is the default, so "חזרה לתבנית" has nothing to do. */
  readonly isDefault: boolean
  chooseTemplate(template: DashboardTemplateId): void
  move(index: number, offset: -1 | 1): void
  remove(index: number): void
  add(module: DashboardModule): void
  /** "חזרה לתבנית": the scope's default again. */
  reset(): void
}

/** The layout, once the preferences are read; `subUnitsWithRows` picks the default template. */
export function useDashboardLayout(subUnitsWithRows: number | null): Loaded<DashboardLayoutState> {
  const preferences = useMyPreferences()
  const update = useUpdateMyPreferences()
  const stored = preferences.status === 'ready' ? preferences.value.dashboard : null
  const fallback = defaultTemplate(subUnitsWithRows ?? 0, DASHBOARD.controlMinUnits)
  const modules = useMemo(() => layoutModules(stored, fallback, DASHBOARD_TEMPLATES), [stored, fallback])
  const save = useCallback(
    (next: DashboardLayout | null) => {
      if (JSON.stringify(next) === JSON.stringify(stored)) return
      update.run({ dashboard: next })
    },
    [stored, update],
  )
  const custom = useCallback(
    (next: readonly DashboardModule[]) => {
      if (next === modules) return
      save({ kind: 'custom', modules: [...next] })
    },
    [modules, save],
  )
  return useMemo((): Loaded<DashboardLayoutState> => {
    if (preferences.status !== 'ready') return preferences
    if (subUnitsWithRows === null) return { status: 'loading' }
    return {
      status: 'ready',
      value: {
        modules,
        template: layoutTemplate(stored, fallback),
        fallback,
        isDefault: stored === null,
        chooseTemplate: (template) => save(templateChoice(template, fallback)),
        move: (index, offset) => custom(moveModule(modules, index, offset)),
        remove: (index) => custom(removeModule(modules, index)),
        add: (module) => custom(addModule(modules, module)),
        reset: () => save(null),
      },
    }
  }, [preferences, subUnitsWithRows, modules, stored, fallback, save, custom])
}

/** Changes the board's unit or "כולל מתוכנן" in the URL (D-023). */
export function useChangeDashboardScope() {
  const change = useChangeSearch()
  return useMemo(
    () => ({
      setUnit: (unitId: UnitId) => change({ unit: unitId }),
      setPlanned: (planned: boolean) => change({ planned: planned ? true : undefined }),
    }),
    [change],
  )
}
