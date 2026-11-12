import {
  ReportConfirmationId,
  type CalendarDate,
  type Deployment,
  type FilterExpression,
  type PermissionCheck,
  type ReportConfirmation,
  type ReportConfirmationQuery,
  type Soldier,
  type UnitId,
} from '@contracts'
import { addDays, buildUnitTree, CONFIRM_DAY_REPORT, dayReportTarget } from '@domain'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useRotationScope } from '../view-state/rotation'
import { useFilterSource } from '../filters/source'
import { useLeaves, useLeavesOfAnyStatus, useLeaveTypes } from '../leaves/hooks'
import { checkOf, checkOn } from '../permissions/checks'
import { useCanAnswers } from '../permissions/hooks'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { loaded, type Loaded } from '../queries/loaded'
import { unwrap } from '../queries/results'
import { usePorts } from '../runtime/context'
import { useSession } from '../session/hooks'
import { useUnits } from '../units/hooks'
import { dateWindowOf } from '../view-state/window'
import { usePlacementHints } from '../roster/hooks'
import { filterUnitOf } from '../view-state/filter'
import { presenceLists, type PresenceLists } from './presence'
import { dayConfirmations, type DayConfirmations } from './confirmations'
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
  const soldiers = source.status === 'ready' ? source.value.soldiers : NO_SOLDIERS
  const checks = useMemo((): readonly PermissionCheck[] => soldiers.map(leavesCheckOf), [soldiers])
  const answers = useCanAnswers(checks)
  const placements = usePlacementHints(soldiers)
  return useMemo((): Loaded<DayReport> => {
    if (span === null) return { status: 'loading' }
    if (source.status !== 'ready') return source
    if (leaves.status !== 'ready') return leaves
    if (types.status !== 'ready') return types
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
        days,
        scopeUnitId: unit.kind === 'unit' ? unit.unitId : null,
        rotations,
        readsLeavesOf: (soldier) => answers.can(leavesCheckOf(soldier)),
        readsPlacements: placements.readsOrPending,
      }),
    }
  }, [span, source, leaves, types, checks, answers, placements, filter, days, rotations])
}

/** The confirmations the actor reads of `days` (D-293). Loading while the days are unknown. */
function useDayConfirmations(days: readonly CalendarDate[]): Loaded<readonly ReportConfirmation[]> {
  const { data } = usePorts()
  const first = days[0]
  const last = days.at(-1)
  const query = useMemo(
    (): ReportConfirmationQuery | null =>
      first === undefined || last === undefined ? null : { window: { start_date: first, end_date: last }, unit_ids: null },
    [first, last],
  )
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.reportConfirmations, query],
      queryFn: () => (query === null ? Promise.resolve([]) : unwrap(data.repositories.report_confirmations.list(query))),
      enabled: query !== null,
    }),
  )
}

function confirmCheckOf(unitId: UnitId): PermissionCheck {
  return checkOf(CONFIRM_DAY_REPORT, dayReportTarget(unitId))
}

/**
 * Where each unit's section of the report's days stands (D-269, D-293), by date. Read from the leaves of every status
 * that bear on the days, so a leave written after a confirmation shows at once as a change. Loading until the report,
 * the confirmations and the permission answers are in.
 */
export function useReportConfirmations(
  report: Loaded<DayReport>,
  rotations: readonly Deployment[],
): Loaded<ReadonlyMap<CalendarDate, DayConfirmations>> {
  const reportDays = report.status === 'ready' ? report.value.days : null
  const days = useMemo(() => (reportDays ?? []).map((day) => day.date), [reportDays])
  const first = days[0]
  const last = days.at(-1)
  const span = useMemo(
    () => (first === undefined || last === undefined ? null : { from: addDays(first, -1), to: addDays(last, 1) }),
    [first, last],
  )
  const confirmations = useDayConfirmations(days)
  const leaves = useLeavesOfAnyStatus(span)
  const units = useUnits()
  const session = useSession()
  const actorId = session.status === 'ready' && session.value.status === 'linked' ? session.value.soldier_id : null
  const checks = useMemo((): readonly PermissionCheck[] => {
    const ids = new Set<UnitId>(rotations.map((rotation) => rotation.unit_id))
    for (const day of reportDays ?? []) for (const section of day.units) if (section.unitId !== null) ids.add(section.unitId)
    return [...ids].map(confirmCheckOf)
  }, [reportDays, rotations])
  const answers = useCanAnswers(checks)
  return useMemo((): Loaded<ReadonlyMap<CalendarDate, DayConfirmations>> => {
    if (report.status !== 'ready') return report
    if (confirmations.status !== 'ready') return confirmations
    if (leaves.status !== 'ready') return leaves
    if (units.status !== 'ready') return units
    // A button never shows a moment late, as the report's soldiers never do (D-122).
    if (!checks.every(answers.known)) return { status: 'loading' }
    const tree = buildUnitTree(units.value)
    const mayConfirm = (unitId: UnitId) => answers.can(confirmCheckOf(unitId))
    return {
      status: 'ready',
      value: new Map(
        report.value.days.map((day) => [
          day.date,
          dayConfirmations({ day, confirmations: confirmations.value, leaves: leaves.value, tree, rotations, mayConfirm, actorId }),
        ]),
      ),
    }
  }, [report, confirmations, leaves, units, checks, answers, rotations, actorId])
}

/** Confirms a unit's report of a date (D-293); confirming again moves the confirmation to the actor and now. */
export function useConfirmDayReport() {
  const { data } = usePorts()
  const command = useCommand([QUERY_KEYS.reportConfirmations], (input: { unit_id: UnitId; report_date: CalendarDate }) =>
    data.commands.day_reports.confirm({ id: ReportConfirmationId.parse(crypto.randomUUID()), ...input }),
  )
  const run = useCallback((unitId: UnitId, date: CalendarDate) => command.run({ unit_id: unitId, report_date: date }), [command])
  return { run, isPending: command.isPending }
}
