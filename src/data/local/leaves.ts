import type { Store } from './store'
import {
  IssueCode,
  LeaveQuery,
  LeaveThreadQuery,
  type DataRepositories,
  type Issue,
  type Leave,
  type LeaveType,
  type OrganizationId,
  type Soldier,
  type SoldierId,
  type TableName,
} from '@contracts'
import { LEAVE_PERMISSIONS, soldierTarget, type RuleData } from '@domain'
import { holds, loadActorScope, type ActorScope } from './actor'
import { tableOf } from './database'
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
  'soldier_tags',
  'deployments',
  'deployment_members',
  'property_definitions',
  'leaves',
  'leave_types',
] as const satisfies readonly TableName[]

/** Every table a leave command reads or writes. */
export const LEAVE_TABLES: readonly TableName[] = [
  ...new Set<TableName>([...POLICY_TABLES, ...RULE_TABLES, 'leave_events', 'leave_comments']),
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
 */
export async function ruleData(database: Store, organizationId: OrganizationId) {
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
  const [property_definitions, deployments, deployment_members, leaves, leave_types] = await Promise.all([
    rowsOf('property_definitions'),
    rowsOf('deployments'),
    rowsOf('deployment_members'),
    rowsOf('leaves'),
    rowsOf('leave_types'),
  ])
  const data: RuleData = {
    units,
    soldiers,
    command_ranks,
    tags,
    soldier_tags,
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
            .filter((row) => window === null || (row.start_date <= window.end_date && row.end_date >= window.start_date))
            .filter((row) => query.soldier_ids === null || query.soldier_ids.includes(row.soldier_id))
            .filter((row) => query.statuses === null || query.statuses.includes(row.status))
            .filter((row) => canView(scope, row))
            .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id.localeCompare(b.id))
            .map((row) => parsedRow('leaves', row))
        })
      }),
  }
}

/** A leave's events, oldest first. An invisible leave answers `not_found` (D-046). */
export function createLeaveEventRepository(dependencies: LocalDependencies): DataRepositories['leave_events'] {
  const { database } = dependencies
  return {
    list: (raw) =>
      asResult(() => {
        const query = parseInput(LeaveThreadQuery, raw)
        return database.transaction('r', READ_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          await visibleLeave(database, scope, query.leave_id)
          const rows = await tableOf(database, 'leave_events').where('leave_id').equals(query.leave_id).toArray()
          return rows
            .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
            .map((row) => parsedRow('leave_events', row))
        })
      }),
  }
}

