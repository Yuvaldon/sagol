import type Dexie from 'dexie'
import {
  CreateLeaveInput,
  IssueCode,
  LeaveEventId,
  LeaveQuery,
  LeaveThreadQuery,
  type DataCommands,
  type DataRepositories,
  type Issue,
  type Leave,
  type OrganizationId,
  type Soldier,
  type SoldierId,
  type TableName,
} from '@contracts'
import {
  COMMENT_PERMISSIONS,
  LEAVE_PERMISSIONS,
  leaveChangeViolations,
  leaveReasonIssues,
  optionalText,
  planLeaveCreation,
  ruleGate,
  soldierTarget,
  type RuleData,
} from '@domain'
import { holds, loadActorScope, requirePermission, type ActorScope } from './actor'
import { propertiesIssues } from './checks'
import { tableOf } from './database'
import { createdBy, type LocalDependencies } from './dependencies'
import { asResult, fail, failValidation, parseInput, parsedRow } from './failure'
import { permissionOf } from './reference'
import { POLICY_TABLES } from './snapshot'

// Leaves (D-012, D-063, D-114). A leave is visible with `leaves:view` over its soldier, and so are its events.
// Creating one plans its status with the state machine, checks every permission the plan names on the
// soldier, and passes the availability rules' gate (D-047, D-073), all in one transaction.

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

const LEAVE_TABLES: readonly TableName[] = [
  ...new Set<TableName>([...POLICY_TABLES, ...RULE_TABLES, 'leave_events', 'leave_comments']),
]

const READ_TABLES: readonly TableName[] = [...POLICY_TABLES, 'leaves', 'leave_events']

function canView(scope: ActorScope, leave: Pick<Leave, 'soldier_id'>): boolean {
  return holds(scope, LEAVE_PERMISSIONS.view, soldierTarget(leave.soldier_id))
}

/** The leave, or `not_found` when it is missing or invisible to the actor (D-046). */
async function visibleLeave(database: Dexie, scope: ActorScope, id: string): Promise<Leave> {
  const stored = await tableOf(database, 'leaves').get(id)
  if (stored === undefined || stored.organization_id !== scope.organization_id || !canView(scope, stored)) {
    return fail({ code: 'not_found' })
  }
  return parsedRow('leaves', stored)
}

/** The leave's soldier, or `not_found` when the actor cannot see them through `soldiers:view` (D-096, D-114). */
async function visibleSoldier(database: Dexie, scope: ActorScope, id: SoldierId): Promise<Soldier> {
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
 * (OI-027). Nothing of it reaches the actor but the violations, which name no soldier.
 */
async function ruleData(database: Dexie, organizationId: OrganizationId) {
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
async function leaveTypeOf(database: Dexie, scope: ActorScope, id: Leave['leave_type_id']) {
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
        const { start_date, end_date } = query.window
        return database.transaction('r', READ_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const rows = await tableOf(database, 'leaves').where('organization_id').equals(scope.organization_id).toArray()
          return rows
            .filter((row) => row.start_date <= end_date && row.end_date >= start_date)
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

// ------------------------------------------------------------------ commands

/** What the local adapter builds of `commands.leaves` so far. The rest lands in V5 and V15 (D-076). */
export type LocalLeaveCommands = Pick<DataCommands['leaves'], 'create'>

export function createLeaveCommands(dependencies: LocalDependencies): LocalLeaveCommands {
  const { database, changes } = dependencies
  return {
    create: (raw) =>
      asResult(async () => {
        const input = parseInput(CreateLeaveInput, raw)
        const { comment } = input
        const written = await database.transaction('rw', LEAVE_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          // The order of D-090 and D-114: the soldier is visible, then every permission, then the state.
          const soldier = await visibleSoldier(database, scope, input.soldier_id)
          const target = soldierTarget(soldier.id)
          const plan = planLeaveCreation('create', input.as_approved, scope.soldier_id, scope.now)
          for (const permission of plan.permissions) requirePermission(scope, permission, target)
          if (comment !== null) requirePermission(scope, COMMENT_PERMISSIONS[comment.visibility].create, target)
          if (soldier.archived_at !== null) return failValidation([{ path: ['soldier_id'], code: IssueCode.enum.archived }])

          if ((await tableOf(database, 'leaves').get(input.id)) !== undefined) {
            return failValidation([{ path: ['id'], code: IssueCode.enum.already_exists }])
          }
          const reason = optionalText(input.reason)
          const { type, issues: typeIssues } = await leaveTypeOf(database, scope, input.leave_type_id)
          const issues: Issue[] = [
            ...typeIssues,
            ...(type === null ? [] : leaveReasonIssues(type, reason)),
            ...(await propertiesIssues(database, scope, 'leave', null, input.properties)),
          ]
          if (comment !== null && (await tableOf(database, 'leave_comments').get(comment.id)) !== undefined) {
            issues.push({ path: ['comment', 'id'], code: IssueCode.enum.already_exists })
          }
          if (issues.length > 0) return failValidation(issues)

          const audit = createdBy(scope.soldier_id, scope.now)
          const leave = parsedRow('leaves', {
            id: input.id,
            organization_id: scope.organization_id,
            soldier_id: soldier.id,
            leave_type_id: input.leave_type_id,
            batch_id: null,
            start_date: input.start_date,
            end_date: input.end_date,
            ...plan.next,
            availability_effect_override: input.availability_effect_override,
            reason,
            properties: input.properties,
            created_at: audit.created_at,
            created_by: audit.created_by,
            updated_at: audit.updated_at,
            updated_by: audit.updated_by,
            version: audit.version,
          })

          // Only what this leave makes worse counts (D-073). Hard rules refuse; soft ones need an acknowledgment.
          const { data, rules } = await ruleData(database, scope.organization_id)
          const gate = ruleGate(leaveChangeViolations(data, rules, [leave]), input.acknowledged_rule_ids)
          if (!gate.ok) return fail(gate.error)

          const eventId = LeaveEventId.parse(crypto.randomUUID())
          await tableOf(database, 'leaves').add(leave)
          await tableOf(database, 'leave_events').add(
            parsedRow('leave_events', {
              id: eventId,
              organization_id: scope.organization_id,
              leave_id: leave.id,
              actor_id: scope.soldier_id,
              ...plan.event,
              changes: {},
              acknowledged_rule_ids: gate.value,
              created_at: scope.now,
            }),
          )
          if (comment !== null) {
            await tableOf(database, 'leave_comments').add(
              parsedRow('leave_comments', {
                id: comment.id,
                organization_id: scope.organization_id,
                leave_id: leave.id,
                author_id: scope.soldier_id,
                body: comment.body,
                visibility: comment.visibility,
                created_at: scope.now,
                edited_at: null,
                archived_at: null,
              }),
            )
          }
          return { leave, eventId }
        })
        changes.publish([
          { table: 'leaves', ids: [written.leave.id] },
          { table: 'leave_events', ids: [written.eventId] },
          ...(comment === null ? [] : [{ table: 'leave_comments' as const, ids: [comment.id] }]),
        ])
        return written.leave
      }),
  }
}
