import type { Store } from './store'
import {
  IssueCode,
  LeaveFeedQuery,
  LeaveQuery,
  LeaveEventsQuery,
  type DataRepositories,
  type DeploymentId,
  type Issue,
  type Leave,
  type LeaveType,
  type OrganizationId,
  type Soldier,
  type SoldierId,
  type TableName,
  type TableRow,
} from '@contracts'
import {
  LEAVE_PERMISSIONS,
  compareInstants,
  effectiveSoldierTags,
  leaveReasonIssues,
  rotationLeaveReasonIssues,
  soldierTarget,
  type RuleData,
} from '@domain'
import { holds, loadActorScope, type ActorScope } from './actor'
import { tableOf } from './store'
import type { LocalDependencies } from './dependencies'
import { asResult, fail, parseInput, parsedRow } from './failure'
import { permissionOf } from './reference'
import { POLICY_TABLES } from './snapshot'

// Reading leaves, and what the leave commands share (D-012, D-114). A leave is visible with `leaves:view` over its
// soldier, and so are its events. The commands are in `leaveCommands.ts` and the comments in `leaveComments.ts`.

/** Every table rule evaluation reads, beyond the policy tables (D-071). */
const RULE_TABLES = [
  'availability_rules',
  'tags',
  'tag_categories',
  'soldier_tags',
  'deployments',
  'deployment_members',
  'property_definitions',
  'leaves',
  'leave_types',
] as const satisfies readonly TableName[]

/** Every table a leave command reads or writes. */
export const LEAVE_TABLES: readonly TableName[] = [
  ...new Set<TableName>([...POLICY_TABLES, ...RULE_TABLES, 'leave_type_groups', 'leave_events', 'leave_comments', 'change_counters']),
]

const READ_TABLES: readonly TableName[] = [...POLICY_TABLES, 'leaves', 'leave_events']

export function canView(scope: ActorScope, leave: Pick<Leave, 'soldier_id'>): boolean {
  return holds(scope, LEAVE_PERMISSIONS.view, soldierTarget(leave.soldier_id))
}

/** The leave, or `not_found` when it is missing or invisible to the actor (D-046). */
export async function visibleLeave(database: Store, scope: ActorScope, id: string): Promise<Leave> {
  const stored = await tableOf(database, 'leaves').get(id)
  if (stored === undefined || stored.organization_id !== scope.organization_id || !canView(scope, stored)) {
    return fail({ code: 'not_found' })
  }
  return parsedRow('leaves', stored)
}

/** The leave's soldier, or `not_found` when the actor cannot see them through `soldiers:view` (D-096, D-114). */
export async function visibleSoldier(database: Store, scope: ActorScope, id: SoldierId): Promise<Soldier> {
  const stored = await tableOf(database, 'soldiers').get(id)
  const visible =
    stored !== undefined &&
    stored.organization_id === scope.organization_id &&
    holds(scope, permissionOf('soldiers', 'view'), soldierTarget(id))
  if (!visible) return fail({ code: 'not_found' })
  return parsedRow('soldiers', stored)
}

/**
 * Everything the rules count, read without the actor's filter: a rule counts soldiers the actor may not see
 * (OI-027). Nothing of it reaches the actor but the violations, which name only who is unavailable (D-138).
 * A soldier's tags are the ones they hold in `rotationId`: the persistent set plus that rotation's (D-260, D-222).
 */
export async function ruleData(database: Store, organizationId: OrganizationId, rotationId: DeploymentId | null) {
  const rowsOf = <T extends Exclude<TableName, 'organizations'>>(table: T) =>
    tableOf(database, table).where('organization_id').equals(organizationId).toArray()
  const [rules, units, soldiers, command_ranks, tags, soldier_tags, seniority_overrides, unit_memberships] =
    await Promise.all([
      rowsOf('availability_rules'),
      rowsOf('units'),
      rowsOf('soldiers'),
      rowsOf('command_ranks'),
      rowsOf('tags'),
      rowsOf('soldier_tags'),
      rowsOf('seniority_overrides'),
      rowsOf('unit_memberships'),
    ])
  const [property_definitions, deployments, deployment_members, leaves, leave_types, tag_categories] = await Promise.all([
    rowsOf('property_definitions'),
    rowsOf('deployments'),
    rowsOf('deployment_members'),
    rowsOf('leaves'),
    rowsOf('leave_types'),
    rowsOf('tag_categories'),
  ])
  const data: RuleData = {
    units,
    soldiers,
    command_ranks,
    tags,
    soldier_tags: effectiveSoldierTags(soldier_tags, rotationId, tags, tag_categories),
    seniority_overrides,
    unit_memberships,
    property_definitions,
    deployments,
    deployment_members,
    leaves,
    leave_types,
  }
  return { data, rules }
}

/** A type a new leave points to must exist, be visible and be live (D-113). */
export async function leaveTypeOf(
  database: Store,
  scope: ActorScope,
  id: Leave['leave_type_id'],
): Promise<{ type: LeaveType | null; issues: Issue[] }> {
  const type = await tableOf(database, 'leave_types').get(id)
  const visible =
    type !== undefined &&
    type.organization_id === scope.organization_id &&
    holds(scope, permissionOf('leave_types', 'view'), { kind: 'organization' })
  if (!visible) return { type: null, issues: [{ path: ['leave_type_id'], code: IssueCode.enum.reference_not_found }] }
  if (type.archived_at !== null) {
    return { type: null, issues: [{ path: ['leave_type_id'], code: IssueCode.enum.reference_archived }] }
  }
  return { type, issues: [] }
}

/**
 * The reason a leave of this type takes: the one the type asks for (D-117), and none on a type of the built-in group
 * (D-347, D-430).
 */
export async function leaveReasonCheck(
  database: Store,
  type: Pick<LeaveType, 'requires_reason' | 'group_id'>,
  reason: string | null,
): Promise<Issue[]> {
  const group = type.group_id === null ? undefined : await tableOf(database, 'leave_type_groups').get(type.group_id)
  return [...leaveReasonIssues(type, reason), ...rotationLeaveReasonIssues(group ?? null, reason)]
}

// --------------------------------------------------------------------- reads

export function createLeaveRepository(dependencies: LocalDependencies): DataRepositories['leaves'] {
  const { database } = dependencies
  return {
    get: (id) =>
      asResult(() =>
        database.transaction('r', READ_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          return visibleLeave(database, scope, id)
        }),
      ),
    list: (raw) =>
      asResult(() => {
        const query = parseInput(LeaveQuery, raw)
        // No window means any dates (D-120).
        const { window } = query
        return database.transaction('r', READ_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const rows = await tableOf(database, 'leaves').where('organization_id').equals(scope.organization_id).toArray()
          return rows
            .filter((row) => query.ids === null || query.ids.includes(row.id))
            .filter(
              (row) => window === null || (row.start_date <= window.end_date && row.end_date >= window.start_date),
            )
            .filter((row) => query.soldier_ids === null || query.soldier_ids.includes(row.soldier_id))
            .filter((row) => query.statuses === null || query.statuses.includes(row.status))
            .filter((row) => canView(scope, row))
            .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id.localeCompare(b.id))
            .map((row) => parsedRow('leaves', row))
        })
      }),
  }
}

/**
 * The events numbered after `after_seq` of the visible leaves, of the listed ones or of every one, by number (D-373).
 * A listed leave the actor may not see answers `not_found` (D-046).
 */
export function createLeaveEventRepository(dependencies: LocalDependencies): DataRepositories['leave_events'] {
  const { database } = dependencies
  return {
    list: (raw) =>
      asResult(() => {
        const query = parseInput(LeaveEventsQuery, raw)
        return database.transaction('r', READ_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          let rows: TableRow<'leave_events'>[]
          if (query.leave_ids === null) {
            const leaves = await tableOf(database, 'leaves')
              .where('organization_id')
              .equals(scope.organization_id)
              .toArray()
            const visible = new Set(leaves.filter((leave) => canView(scope, leave)).map((leave) => leave.id))
            const all = await tableOf(database, 'leave_events')
              .where('organization_id')
              .equals(scope.organization_id)
              .toArray()
            rows = all.filter((row) => visible.has(row.leave_id))
          } else {
            const leaves = []
            for (const id of new Set(query.leave_ids)) leaves.push(await visibleLeave(database, scope, id))
            rows = await threadRows(database, 'leave_events', leaves)
          }
          return rows
            .filter((row) => row.change_seq > query.after_seq)
            .sort((a, b) => a.change_seq - b.change_seq || a.id.localeCompare(b.id))
            .map((row) => parsedRow('leave_events', row))
        })
      }),
    feed: (raw) =>
      asResult(() => {
        const query = parseInput(LeaveFeedQuery, raw)
        return database.transaction('r', READ_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const leaves = await feedLeaves(database, scope, query)
          const rows = await threadRows(database, 'leave_events', leaves)
          return rows
            .filter((row) => compareInstants(row.created_at, query.since) >= 0)
            .sort(newestFirst)
            .map((row) => parsedRow('leave_events', row))
        })
      }),
  }
}

/** The soldier's leaves the actor can see, the subjects of a feed (D-352). */
export async function feedLeaves(database: Store, scope: ActorScope, query: LeaveFeedQuery): Promise<Leave[]> {
  const rows = await tableOf(database, 'leaves').where('soldier_id').equals(query.soldier_id).toArray()
  return rows.filter((row) => row.organization_id === scope.organization_id && canView(scope, row))
}

/** The events or comments of these leaves, one lookup per leave by its index. */
export async function threadRows<T extends 'leave_events' | 'leave_comments'>(
  database: Store,
  table: T,
  leaves: readonly Leave[],
): Promise<TableRow<T>[]> {
  const lists = await Promise.all(leaves.map((leave) => tableOf(database, table).where('leave_id').equals(leave.id).toArray()))
  return lists.flat()
}

/** Newest first; the id breaks ties so the order is stable. */
export function newestFirst(a: { created_at: string; id: string }, b: { created_at: string; id: string }): number {
  return b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)
}

