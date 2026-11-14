import {
  ReportConfirmationId,
  type CalendarDate,
  type ChangeSeq,
  type Deployment,
  type FilterExpression,
  type PermissionCheck,
  type ReportConfirmation,
  type ConfirmableReport,
  type ConfirmableReportQuery,
  type ReportSectionCount,
  type ReportSectionQuery,
  type ReportConfirmationQuery,
  type Soldier,
  type UnitId,
} from '@contracts'
import { addDays, buildUnitTree, compareCodeUnits, CONFIRM_DAY_REPORT, dayReportTarget } from '@domain'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useRotationScope } from '../view-state/rotation'
import { useFilterSource } from '../filters/source'
import { useLeaves, useLeaveTypeGroups, useLeaveTypes } from '../leaves/hooks'
import { checkOf, checkOn } from '../permissions/checks'
import { useCanAnswers } from '../permissions/hooks'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { loaded, type Loaded } from '../queries/loaded'
import { unwrap } from '../queries/results'
import { usePorts } from '../runtime/context'
import { useSession } from '../session/hooks'
import { dateWindowOf } from '../view-state/window'
import { usePlacementHints } from '../roster/hooks'
import { useUnits } from '../units/hooks'
import { filterUnitOf } from '../view-state/filter'
import { presenceLists, type PresenceLists } from './presence'
import { dayConfirmations, type DayConfirmations, type ReadChanges } from './confirmations'
import { dayReport, type DayReport } from './report'

// The present and absent lists of a day, read like the board (D-134), and the day report (D-193).

/** The lists of `day`. Loading while the day is unknown. */
export function usePresence(day: CalendarDate | null, filter: FilterExpression | null): Loaded<PresenceLists> {
  const window = useMemo(() => (day === null ? null : dateWindowOf({ from: day, to: day }, day)), [day])
  const source = useFilterSource(useRotationScope().rotation?.id ?? null)
  const leaves = useLeaves(window)
  const types = useLeaveTypes()
  const checks = useMemo(
    (): readonly PermissionCheck[] => (source.status === 'ready' ? source.value.soldiers.map(leavesCheckOf) : []),
    [source],
  )
  const answers = useCanAnswers(checks)
  return useMemo((): Loaded<PresenceLists> => {
    if (day === null) return { status: 'loading' }
    if (source.status !== 'ready') return source
    if (leaves.status !== 'ready') return leaves
    if (types.status !== 'ready') return types
    // The lists wait for every answer, so a soldier never moves out of them a moment later (D-161).
    if (!checks.every(answers.known)) return { status: 'loading' }
    const readsLeavesOf = (soldier: Soldier) => answers.can(leavesCheckOf(soldier))
    return {
      status: 'ready',
      value: presenceLists({ source: source.value, filter, leaves: leaves.value, types: types.value, day, readsLeavesOf }),
    }
  }, [day, source, leaves, types, filter, checks, answers])
}

function leavesCheckOf(soldier: Soldier): PermissionCheck {
  return checkOn({ resource: 'leaves', action: 'view' }, soldier.id)
}

const NO_SOLDIERS: readonly Soldier[] = []

/**
 * The report of `days` (D-193): the leaves of the day before the first through the day after the last, so the first
 * and the last day know who leaves and who returns. Loading while the days are unknown.
 */
export function useDayReport(
  days: readonly CalendarDate[],
  filter: FilterExpression | null,
  rotations: readonly Deployment[],
): Loaded<DayReport> {
  const first = days[0]
  const last = days.at(-1)
  const span = useMemo(
    () => (first === undefined || last === undefined ? null : { from: addDays(first, -1), to: addDays(last, 1) }),
    [first, last],
  )
  const source = useFilterSource(useRotationScope().rotation?.id ?? null)
  const leaves = useLeaves(span)
  const types = useLeaveTypes()
  const groups = useLeaveTypeGroups()
  const soldiers = source.status === 'ready' ? source.value.soldiers : NO_SOLDIERS
  const checks = useMemo((): readonly PermissionCheck[] => soldiers.map(leavesCheckOf), [soldiers])
  const answers = useCanAnswers(checks)
  const placements = usePlacementHints(soldiers)
  return useMemo((): Loaded<DayReport> => {
    if (span === null) return { status: 'loading' }
    if (source.status !== 'ready') return source
    if (leaves.status !== 'ready') return leaves
    if (types.status !== 'ready') return types
    if (groups.status !== 'ready') return groups
    // The report waits for every answer, so a soldier never moves out of it a moment later (D-161, D-122).
    if (!checks.every(answers.known) || !placements.settled) return { status: 'loading' }
    const unit = filterUnitOf(filter)
    return {
      status: 'ready',
      value: dayReport({
        source: source.value,
        filter,
        leaves: leaves.value,
        types: types.value,
        groups: groups.value,
        days,
        scopeUnitId: unit.kind === 'unit' ? unit.unitId : null,
        rotations,
        readsLeavesOf: (soldier) => answers.can(leavesCheckOf(soldier)),
        readsPlacements: placements.readsOrPending,
      }),
    }
  }, [span, source, leaves, types, groups, checks, answers, placements, filter, days, rotations])
}

interface ConfirmationReads {
  readonly seenSeq: ChangeSeq
  readonly confirmations: readonly ReportConfirmation[]
  readonly changes: ReadChanges
}

/**
 * The confirmations the actor reads of `days` (D-293), and what was written after the smallest `seen_seq` among them,
 * read in the order D-373 needs: the change counter first, then the confirmations, the leave events after that number,
 * the leaves of those events, and the memberships in `units`. A change committed between the reads shows as one until
 * the next read; none is ever missed. Loading while the days are unknown.
 */
function useConfirmationReads(
  days: readonly CalendarDate[],
  units: readonly UnitId[] | null,
): Loaded<ConfirmationReads> {
  const { data } = usePorts()
  const { repositories } = data
  const first = days[0]
  const last = days.at(-1)
  const query = useMemo(
    (): ReportConfirmationQuery | null =>
      first === undefined || last === undefined || units === null
        ? null
        : { window: { start_date: first, end_date: last }, unit_ids: null },
    [first, last, units],
  )
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.reportConfirmations, CHANGES, query, units],
      queryFn: async (): Promise<ConfirmationReads> => {
        const seenSeq = await unwrap(repositories.change_counters.current())
        if (query === null || units === null) return { seenSeq, confirmations: [], changes: NO_CHANGES }
        const confirmations = await unwrap(repositories.report_confirmations.list(query))
        if (confirmations.length === 0) return { seenSeq, confirmations, changes: NO_CHANGES }
        const after = Math.min(...confirmations.map((row) => row.seen_seq))
        const events = await unwrap(repositories.leave_events.list({ leave_ids: null, after_seq: after }))
        const ids = [...new Set(events.map((event) => event.leave_id))].sort(compareCodeUnits)
        const leaves =
          ids.length === 0
            ? []
            : await unwrap(repositories.leaves.list({ ids, window: null, soldier_ids: null, statuses: null }))
        const memberships =
          units.length === 0
            ? []
            : await unwrap(
                repositories.unit_memberships.list({ soldier_ids: null, unit_ids: [...units], window: null }),
              )
        return {
          seenSeq,
          confirmations,
          changes: { leaves, events, memberships: memberships.filter((row) => row.change_seq > after) },
        }
      },
      enabled: query !== null,
    }),
  )
}

const CHANGES = 'changes'
const NO_CHANGES: ReadChanges = { leaves: [], events: [], memberships: [] }

function confirmCheckOf(unitId: UnitId): PermissionCheck {
  return checkOf(CONFIRM_DAY_REPORT, dayReportTarget(unitId))
}

/** Which of `units`' reports of `days` the actor may confirm, as the data layer answers it on the whole tree (D-293). */
function useConfirmable(days: readonly CalendarDate[], units: readonly UnitId[]): Loaded<readonly ConfirmableReport[]> {
  const { data } = usePorts()
  const first = days[0]
  const last = days.at(-1)
  const query = useMemo(
    (): ConfirmableReportQuery | null =>
      first === undefined || last === undefined ? null : { window: { start_date: first, end_date: last }, unit_ids: [...units] },
    [first, last, units],
  )
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.reportConfirmations, CONFIRMABLE, query],
      queryFn: () => (query === null ? Promise.resolve([]) : unwrap(data.repositories.report_confirmations.confirmable(query))),
      enabled: query !== null,
    }),
  )
}

const CONFIRMABLE = 'confirmable'

/**
 * How many unit sections the rotations' reports of `days` hold on the whole tree, for the rotations whose summary the
 * actor reads (D-303): a count only, so the owner learns that units lie outside the view without learning which.
 */
function useReportSections(days: readonly CalendarDate[], rotations: readonly Deployment[]): Loaded<readonly ReportSectionCount[]> {
  const { data } = usePorts()
  const first = days[0]
  const last = days.at(-1)
  const ids = useMemo(() => rotations.map((rotation) => rotation.id).sort(compareCodeUnits), [rotations])
  const query = useMemo(
    (): ReportSectionQuery | null =>
      first === undefined || last === undefined ? null : { window: { start_date: first, end_date: last }, deployment_ids: ids },
    [first, last, ids],
  )
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.reportConfirmations, SECTIONS, query],
      queryFn: () => (query === null ? Promise.resolve([]) : unwrap(data.repositories.report_confirmations.sections(query))),
      enabled: query !== null,
    }),
  )
}

const SECTIONS = 'sections'
const NO_UNITS: readonly UnitId[] = []

/**
 * Where each unit's section of the report's days stands (D-269, D-293), by date. Read on the whole report, with no
 * view filter, from what was written after each confirmation's change number (D-373), so a leave or a placement written
 * after it shows at once as a change; `shown` is the report as the view filter shows it. Loading until both reports, the
 * confirmations, the confirmable answer and the permission answers are in.
 */
export function useReportConfirmations(
  days: readonly CalendarDate[],
  shown: Loaded<DayReport>,
  rotations: readonly Deployment[],
): Loaded<ReadonlyMap<CalendarDate, DayConfirmations>> {
  const report = useDayReport(days, null, rotations)
  const reportDays = report.status === 'ready' ? report.value.days : null
  const units = useMemo((): readonly UnitId[] | null => {
    if (reportDays === null) return null
    const ids = new Set<UnitId>()
    for (const day of reportDays) for (const section of day.units) if (section.unitId !== null) ids.add(section.unitId)
    return [...ids].sort(compareCodeUnits)
  }, [reportDays])
  const reads = useConfirmationReads(days, units)
  const confirmable = useConfirmable(reportDays === null ? [] : days, units ?? NO_UNITS)
  const sectionCounts = useReportSections(days, rotations)
  const session = useSession()
  const live = useUnits()
  const tree = useMemo(() => (live.status === 'ready' ? buildUnitTree(live.value) : null), [live])
  const checks = useMemo(
    (): readonly PermissionCheck[] => [...new Set<UnitId>(rotations.map((rotation) => rotation.unit_id))].map(confirmCheckOf),
    [rotations],
  )
  const answers = useCanAnswers(checks)
  return useMemo((): Loaded<ReadonlyMap<CalendarDate, DayConfirmations>> => {
    if (report.status !== 'ready') return report
    if (shown.status !== 'ready') return shown
    if (reads.status !== 'ready') return reads
    if (confirmable.status !== 'ready') return confirmable
    if (sectionCounts.status !== 'ready') return sectionCounts
    if (session.status !== 'ready') return session
    if (tree === null) return { status: 'loading' }
    // A button never shows a moment late, as the report's soldiers never do (D-122).
    if (!checks.every(answers.known)) return { status: 'loading' }
    const counts = new Map(sectionCounts.value.map((row) => [row.report_date, row.unseen] as const))
    const pairs = new Set(confirmable.value.map((pair) => pairKeyOf(pair.unit_id, pair.report_date)))
    const shownDays = new Map(shown.value.days.map((day) => [day.date, day] as const))
    const mayConfirm = (unitId: UnitId) => answers.can(confirmCheckOf(unitId))
    const actorId = session.value.status === 'linked' ? session.value.soldier_id : null
    return {
      status: 'ready',
      value: new Map(
        report.value.days.map((day) => [
          day.date,
          dayConfirmations({
            day,
            shown: shownDays.get(day.date) ?? day,
            confirmations: reads.value.confirmations,
            changes: reads.value.changes,
            confirmable: (unitId, date) => pairs.has(pairKeyOf(unitId, date)),
            mayConfirm,
            tree,
            actorId,
            seenSeq: reads.value.seenSeq,
            unseen: counts.get(day.date) ?? 0,
          }),
        ]),
      ),
    }
  }, [report, shown, reads, confirmable, sectionCounts, session, tree, checks, answers])
}

const pairKeyOf = (unitId: UnitId, date: CalendarDate) => `${date} ${unitId}`

/**
 * Confirms a unit's report of a date (D-293), as read at change number `seenSeq` (D-373); confirming again moves the
 * confirmation to the actor.
 */
export function useConfirmDayReport() {
  const { data } = usePorts()
  const command = useCommand(
    [QUERY_KEYS.reportConfirmations],
    (input: { unit_id: UnitId; report_date: CalendarDate; seen_seq: ChangeSeq }) =>
      data.commands.day_reports.confirm({ id: ReportConfirmationId.parse(crypto.randomUUID()), ...input }),
  )
  const run = useCallback(
    (unitId: UnitId, date: CalendarDate, seenSeq: ChangeSeq) =>
      command.run({ unit_id: unitId, report_date: date, seen_seq: seenSeq }),
    [command],
  )
  return { run, isPending: command.isPending }
}
