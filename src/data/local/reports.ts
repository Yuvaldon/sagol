import { DAY_REPORT } from '@config'
import {
  ConfirmableReportQuery,
  ConfirmDayReportInput,
  IssueCode,
  ReportConfirmationQuery,
  ReportSectionQuery,
  SoldierStatus,
  type ConfirmableReport,
  type DateWindow,
  type DataCommands,
  type DataRepositories,
  type Deployment,
  type ReportConfirmation,
  type ReportSectionCount,
  type SoldierId,
  type TableName,
  type Unit,
  type UnitId,
  type UnitMembership,
} from '@contracts'
import {
  addDays,
  buildUnitTree,
  compareCodeUnits,
  compareDates,
  CONFIRM_DAY_REPORT,
  confirmedAtOf,
  confirmReportIssues,
  daysBetween,
  dayReportTarget,
  isAncestorOrSelf,
  primaryUnitOn,
  reportRotationOf,
  soldierTarget,
  unitTarget,
} from '@domain'
import { holds, loadActorScope, requirePermission, type ActorScope } from './actor'
import type { LocalDependencies } from './dependencies'
import { asResult, failValidation, parseInput, parsedRow } from './failure'
import { permissionOf } from './reference'
import { POLICY_TABLES } from './snapshot'
import { tableOf, type Store } from './store'

// The daily report workflow (D-269, D-293): one confirmation per unit and date, kept and moved on each confirm, never
// deleted. Whether the report changed since is derived from the leaves by who reads it, never stored here.

const TABLES: readonly TableName[] = [...POLICY_TABLES, 'deployments', 'report_confirmations']

async function rotationsOf(database: Store, scope: ActorScope): Promise<Deployment[]> {
  const rows = await tableOf(database, 'deployments').where('organization_id').equals(scope.organization_id).toArray()
  return rows.map((row) => parsedRow('deployments', row))
}

async function unitsOf(database: Store, scope: ActorScope): Promise<Unit[]> {
  const rows = await tableOf(database, 'units').where('organization_id').equals(scope.organization_id).toArray()
  return rows.map((row) => parsedRow('units', row))
}

/** The report's span bounds a window, as its input's shape: checked before any row is read (D-302). */
function checkSpan(window: DateWindow): void {
  if (daysBetween(window.start_date, window.end_date) + 1 > DAY_REPORT.maxSpanDays) {
    failValidation([{ path: ['window', 'end_date'], code: IssueCode.enum.too_big }])
  }
}

/** Who reads a rotation's summary: its report owner, or, with none named, who may confirm its unit (D-293). */
const SOLDIERS_VIEW = { resource: 'soldiers', action: 'view' } as const
const MEMBERSHIPS_VIEW = { resource: 'memberships', action: 'view' } as const

/** Whether the actor's report lists the soldier under their unit: it reads the soldier and their memberships. */
function seesInReport(scope: ActorScope, soldierId: SoldierId): boolean {
  return holds(scope, SOLDIERS_VIEW, soldierTarget(soldierId)) && holds(scope, MEMBERSHIPS_VIEW, soldierTarget(soldierId))
}

function readsSummaryOf(scope: ActorScope, rotation: Deployment): boolean {
  return rotation.report_owner_id === null
    ? holds(scope, CONFIRM_DAY_REPORT, dayReportTarget(rotation.unit_id))
    : rotation.report_owner_id === scope.soldier_id
}

function viewsUnit(scope: ActorScope, unit: Unit | undefined): boolean {
  return unit !== undefined && holds(scope, permissionOf('units', 'view'), unitTarget(unit))
}

/** Who views the unit, may confirm it, or owns the report of a live rotation over it that day (D-293). */
function readerOf(scope: ActorScope, rotations: readonly Deployment[], units: readonly Unit[]) {
  const tree = buildUnitTree(units)
  const byId = new Map(units.map((unit) => [unit.id, unit]))
  const owned = rotations.filter((rotation) => rotation.archived_at === null && rotation.report_owner_id === scope.soldier_id)
  return (row: ReportConfirmation): boolean =>
    viewsUnit(scope, byId.get(row.unit_id)) ||
    holds(scope, CONFIRM_DAY_REPORT, dayReportTarget(row.unit_id)) ||
    owned.some(
      (rotation) =>
        compareDates(rotation.start_date, row.report_date) <= 0 &&
        (rotation.end_date === null || compareDates(row.report_date, rotation.end_date) <= 0) &&
        isAncestorOrSelf(tree, rotation.unit_id, row.unit_id),
    )
}

export function createReportConfirmationRepository(dependencies: LocalDependencies): DataRepositories['report_confirmations'] {
  const { database } = dependencies
  return {
    list: (raw) =>
      asResult(() => {
        const query = parseInput(ReportConfirmationQuery, raw)
        return database.transaction('r', TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const readable = readerOf(scope, await rotationsOf(database, scope), await unitsOf(database, scope))
          const rows = await tableOf(database, 'report_confirmations')
            .where('organization_id')
            .equals(scope.organization_id)
            .toArray()
          const { start_date: start, end_date: end } = query.window
          return rows
            .map((row) => parsedRow('report_confirmations', row))
            .filter((row) => compareDates(start, row.report_date) <= 0 && compareDates(row.report_date, end) <= 0)
            .filter((row) => query.unit_ids === null || query.unit_ids.includes(row.unit_id))
            .filter(readable)
            .sort((a, b) => a.report_date.localeCompare(b.report_date) || compareCodeUnits(a.unit_id, b.unit_id))
        })
      }),
    confirmable: (raw) =>
      asResult(() => {
        const query = parseInput(ConfirmableReportQuery, raw)
        checkSpan(query.window)
        return database.transaction('r', TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const units = await unitsOf(database, scope)
          const rotations = await rotationsOf(database, scope)
          // Read on the whole tree, which the actor may not see: a level between their unit and the rotation's unit
          // must not hide the button from who may confirm (D-293). Only units the actor may confirm answer.
          const tree = buildUnitTree(units)
          const confirmable = units.filter(
            (unit) =>
              query.unit_ids.includes(unit.id) &&
              unit.archived_at === null &&
              holds(scope, CONFIRM_DAY_REPORT, dayReportTarget(unit.id)),
          )
          const answers: ConfirmableReport[] = []
          const { start_date: start, end_date: end } = query.window
          for (let date = start; compareDates(date, end) <= 0; date = addDays(date, 1)) {
            for (const unit of confirmable) {
              const rotation = reportRotationOf(rotations, tree, unit.id, date)
              if (confirmReportIssues(rotation).length === 0) answers.push({ unit_id: unit.id, report_date: date })
            }
          }
          return answers.sort((a, b) => a.report_date.localeCompare(b.report_date) || compareCodeUnits(a.unit_id, b.unit_id))
        })
      }),
    sections: (raw) =>
      asResult(() => {
        const query = parseInput(ReportSectionQuery, raw)
        checkSpan(query.window)
        return database.transaction('r', TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const units = await unitsOf(database, scope)
          // Read on the whole tree, which the actor may not see: the summary counts every section, and a count names
          // no unit (D-303). A section is a unit whose active soldiers it holds on the day, archived units too, as the
          // report heads them (D-147).
          const tree = buildUnitTree(units)
          const read = (await rotationsOf(database, scope)).filter(
            (rotation) =>
              query.deployment_ids.includes(rotation.id) && rotation.archived_at === null && readsSummaryOf(scope, rotation),
          )
          const soldiers = (await tableOf(database, 'soldiers').where('organization_id').equals(scope.organization_id).toArray())
            .map((row) => parsedRow('soldiers', row))
            .filter((soldier) => soldier.archived_at === null && soldier.status === SoldierStatus.enum.active)
          const bySoldier = new Map<SoldierId, UnitMembership[]>()
          for (const row of await tableOf(database, 'unit_memberships').where('organization_id').equals(scope.organization_id).toArray()) {
            const membership = parsedRow('unit_memberships', row)
            bySoldier.set(membership.soldier_id, [...(bySoldier.get(membership.soldier_id) ?? []), membership])
          }
          const answers: ReportSectionCount[] = []
          const { start_date: start, end_date: end } = query.window
          for (let date = start; compareDates(date, end) <= 0; date = addDays(date, 1)) {
            const running = read.filter(
              (rotation) =>
                compareDates(rotation.start_date, date) <= 0 && (rotation.end_date === null || compareDates(date, rotation.end_date) <= 0),
            )
            if (running.length === 0) continue
            const sections = new Set<UnitId>()
            const seen = new Set<UnitId>()
            for (const soldier of soldiers) {
              const unitId = primaryUnitOn(bySoldier.get(soldier.id) ?? [], soldier.id, date)
              if (unitId === null || !running.some((rotation) => isAncestorOrSelf(tree, rotation.unit_id, unitId))) continue
              sections.add(unitId)
              // The actor's report heads the unit when it holds a soldier the actor views with their unit.
              if (seesInReport(scope, soldier.id)) seen.add(unitId)
            }
            answers.push({ report_date: date, sections: sections.size, unseen: sections.size - seen.size })
          }
          return answers
        })
      }),
  }
}

export function createDayReportCommands(dependencies: LocalDependencies): DataCommands['day_reports'] {
  const { database, changes } = dependencies
  return {
    confirm: (raw) =>
      asResult(async () => {
        const input = parseInput(ConfirmDayReportInput, raw)
        const row = await database.transaction('rw', TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const units = await unitsOf(database, scope)
          const unit = units.find((candidate) => candidate.id === input.unit_id)
          const visible =
            unit !== undefined && (viewsUnit(scope, unit) || holds(scope, CONFIRM_DAY_REPORT, dayReportTarget(unit.id)))
          if (!visible) return failValidation([{ path: ['unit_id'], code: IssueCode.enum.reference_not_found }])
          requirePermission(scope, CONFIRM_DAY_REPORT, dayReportTarget(unit.id))
          if (unit.archived_at !== null) return failValidation([{ path: ['unit_id'], code: IssueCode.enum.reference_archived }])
          const rotation = reportRotationOf(await rotationsOf(database, scope), buildUnitTree(units), unit.id, input.report_date)
          const issues = confirmReportIssues(rotation)
          if (issues.length > 0) return failValidation(issues)

          const table = tableOf(database, 'report_confirmations')
          const stored = await table.where('[unit_id+report_date]').equals([unit.id, input.report_date]).first()
          // A unit and date already confirmed keep their row; the id may name no other row, new or not.
          const holder = await table.get(input.id)
          if (holder !== undefined && holder.id !== stored?.id) {
            return failValidation([{ path: ['id'], code: IssueCode.enum.already_exists }])
          }
          const confirmed = parsedRow('report_confirmations', {
            id: stored?.id ?? input.id,
            organization_id: scope.organization_id,
            unit_id: unit.id,
            report_date: input.report_date,
            confirmed_by: scope.soldier_id,
            confirmed_at: confirmedAtOf(scope.now, input.seen_at),
          })
          await table.put(confirmed)
          return confirmed
        })
        changes.publish([{ table: 'report_confirmations', ids: [row.id] }])
        return row
      }),
  }
}
