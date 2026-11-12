import type { Store } from './store'
import {
  CreateLeaveInput,
  IssueCode,
  LeaveEventId,
  TABLE_SCHEMAS,
  TransitionLeaveInput,
  UpdateLeaveInput,
  type AvailabilityRuleId,
  type CommentDraft,
  type DataChange,
  type DataCommands,
  type Issue,
  type Leave,
  type LeaveEvent,
  type SoldierId,
} from '@contracts'
import {
  COMMENT_PERMISSIONS,
  LEAVE_PERMISSIONS,
  archivedSoldierIssues,
  isMaterialLeaveUpdate,
  issuesFromSchema,
  leaveEditKind,
  leaveChangeViolations,
  leaveReasonIssues,
  optionalText,
  planLeaveCreation,
  planLeaveEdit,
  planLeaveTransition,
  ruleGate,
  soldierTarget,
  withPathPrefix,
  type LeaveReviewState,
  type LeaveWorkflowEvent,
} from '@domain'
import { holds, loadActorScope, requirePermission, type ActorScope } from './actor'
import { propertiesIssues } from './checks'
import { tableOf } from './store'
import { createdBy, updatedBy, type LocalDependencies } from './dependencies'
import { asResult, fail, failValidation, parseInput, parsedRow } from './failure'
import { LEAVE_TABLES, leaveTypeOf, ruleData, visibleLeave, visibleSoldier } from './leaves'

// The leave commands (D-063, D-064, D-114, D-117, D-123, D-124). Each plans its step with the state machine, checks
// every permission the plan names on the leave's soldier, and passes the availability rules' gate (D-047, D-073), all
// in one transaction that also writes the event and the comment.

/** Create, edit and transition. Creating together (a batch, a duplicate) is in `leaveCreation.ts`. */
export type LocalLeaveCommands = Pick<DataCommands['leaves'], 'create' | 'update' | 'transition'>

/** A leave of an archived soldier can only be cancelled (D-124): the state step, after the version. */
async function requireOpenSoldier(database: Store, leave: Leave, issues: (soldier: { archived_at: string | null }) => Issue[]) {
  const soldier = await tableOf(database, 'soldiers').get(leave.soldier_id)
  const found = soldier === undefined ? [] : issues(soldier)
  if (found.length > 0) failValidation(found)
}

/** A comment written with a leave command needs the pair of its visibility over the soldier. */
function requireCommentPermission(scope: ActorScope, comment: CommentDraft | null, soldierId: SoldierId): void {
  if (comment !== null) requirePermission(scope, COMMENT_PERMISSIONS[comment.visibility].create, soldierTarget(soldierId))
}

async function commentIdIssues(database: Store, comment: CommentDraft | null): Promise<Issue[]> {
  if (comment === null || (await tableOf(database, 'leave_comments').get(comment.id)) === undefined) return []
  return [{ path: ['comment', 'id'], code: IssueCode.enum.already_exists }]
}

/** Only what this change makes worse counts (D-073). Hard rules refuse; soft ones need an acknowledgment. */
export async function passRuleGate(
  database: Store,
  scope: ActorScope,
  leaves: readonly Leave[],
  acknowledged: readonly AvailabilityRuleId[],
): Promise<AvailabilityRuleId[]> {
  const { data, rules } = await ruleData(database, scope.organization_id)
  const gate = ruleGate(leaveChangeViolations(data, rules, leaves), acknowledged)
  return gate.ok ? gate.value : fail(gate.error)
}

export interface LeaveWrite {
  readonly leave: Leave
  /** NULL when the leave is new. */
  readonly before: Leave | null
  readonly event: LeaveWorkflowEvent
  readonly changes: LeaveEvent['changes']
  readonly acknowledged: readonly AvailabilityRuleId[]
  readonly comment: CommentDraft | null
}

/** The leave, its event and its comment, inside the caller's transaction. Returns what the feed is told. */
export async function writeLeave(database: Store, scope: ActorScope, write: LeaveWrite): Promise<DataChange[]> {
  const { leave, comment } = write
  const eventId = LeaveEventId.parse(crypto.randomUUID())
  if (write.before === null) await tableOf(database, 'leaves').add(leave)
  else await tableOf(database, 'leaves').put(leave)
  await tableOf(database, 'leave_events').add(
    parsedRow('leave_events', {
      id: eventId,
      organization_id: scope.organization_id,
      leave_id: leave.id,
      actor_id: scope.soldier_id,
      ...write.event,
      changes: write.changes,
      acknowledged_rule_ids: write.acknowledged,
      created_at: scope.now,
    }),
  )
  const written: DataChange[] = [
    { table: 'leaves', ids: [leave.id] },
    { table: 'leave_events', ids: [eventId] },
  ]
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
    written.push({ table: 'leave_comments', ids: [comment.id] })
  }
  return written
}

/** The columns `update` sets (D-123). */
const EDITED_COLUMNS = [
  'leave_type_id',
  'availability_effect_override',
  'reason',
  'properties',
  'start_date',
  'end_date',
] as const satisfies readonly (keyof Leave)[]

type LeaveEditColumns = Partial<Pick<Leave, (typeof EDITED_COLUMNS)[number]>>

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Only the review columns of a plan: the state machine may hand back the whole row it was given. */
function reviewOf({ status, reviewed_by, reviewed_at }: LeaveReviewState): LeaveReviewState {
  return { status, reviewed_by, reviewed_at }
}

/** Before and after of every edited column that differs, as the event stores it (D-117). */
function changedColumns(before: Leave, after: Leave): LeaveEvent['changes'] {
  return Object.fromEntries(
    EDITED_COLUMNS.filter((column) => !sameValue(before[column], after[column])).map((column) => [
      column,
      { before: before[column], after: after[column] },
    ]),
  )
}

/** The stored leave with an edit merged in, parsed as a row; or its issues, relative to the row. */
function editedLeave(scope: ActorScope, before: Leave, columns: LeaveEditColumns, review: LeaveReviewState): Leave | Issue[] {
  const candidate = { ...before, ...columns, ...reviewOf(review), ...updatedBy(scope.soldier_id, scope.now, before.version) }
  const parsed = TABLE_SCHEMAS.leaves.safeParse(candidate)
  return parsed.success ? parsed.data : issuesFromSchema(parsed.error.issues, candidate)
}

export function createLeaveCommands(dependencies: LocalDependencies): LocalLeaveCommands {
  const { database, changes } = dependencies

  /**
   * One edit in one transaction, in the order of D-117 (D-123): the dates and the details are judged together, so
   * everything is saved or nothing is. Issues point at the fields under `changes`.
   */
  function edit(input: UpdateLeaveInput, columns: LeaveEditColumns) {
    const prefix = ['changes']
    return database.transaction('rw', LEAVE_TABLES, async () => {
      const scope = await loadActorScope(dependencies)
      const before = await visibleLeave(database, scope, input.id)
      const target = soldierTarget(before.soldier_id)
      requirePermission(scope, LEAVE_PERMISSIONS.update, target)
      if (before.version !== input.expected_version) return fail({ code: 'stale_version' })

      const requested = EDITED_COLUMNS.filter((column) => column in columns && !sameValue(before[column], columns[column]))
      const kind = leaveEditKind(requested)
      const material = isMaterialLeaveUpdate(before, columns)
      const plan = planLeaveEdit(
        before,
        {
          kind,
          material,
          policy: scope.organization.settings.reschedule_policy,
          actor_can_approve: holds(scope, LEAVE_PERMISSIONS.approve, target),
        },
        scope.soldier_id,
        scope.now,
      )
      if (!plan.allowed) return failValidation(plan.issues)
      await requireOpenSoldier(database, before, (soldier) => archivedSoldierIssues(soldier, 'update', []))

      const after = editedLeave(scope, before, columns, plan.next)
      if (Array.isArray(after)) return failValidation(withPathPrefix(prefix, after))

      const typeChanged = after.leave_type_id !== before.leave_type_id
      const issues: Issue[] = []
      // A new type must be one a new leave could take. The type the leave already has is left alone (D-113).
      if (typeChanged) issues.push(...(await leaveTypeOf(database, scope, after.leave_type_id)).issues)
      if (issues.length === 0 && (typeChanged || after.reason !== before.reason)) {
        const type = await tableOf(database, 'leave_types').get(after.leave_type_id)
        if (type !== undefined) issues.push(...leaveReasonIssues(type, after.reason))
      }
      if (!sameValue(after.properties, before.properties)) {
        issues.push(...(await propertiesIssues(database, scope, 'leave', before.properties, after.properties)))
      }
      if (issues.length > 0) return failValidation(withPathPrefix(prefix, issues))

      const changed = changedColumns(before, after)
      if (Object.keys(changed).length === 0) return failValidation([{ path: prefix, code: IssueCode.enum.no_changes }])

      const acknowledged = await passRuleGate(database, scope, [after], input.acknowledged_rule_ids)
      const written = await writeLeave(database, scope, {
        leave: after,
        before,
        event: plan.event,
        changes: changed,
        acknowledged,
        comment: null,
      })
      return { leave: after, written }
    })
  }

  return {
    create: (raw) =>
      asResult(async () => {
        const input = parseInput(CreateLeaveInput, raw)
        const { comment } = input
        const { leave, written } = await database.transaction('rw', LEAVE_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          // The order of D-090 and D-114: the soldier is visible, then every permission, then the state.
          const soldier = await visibleSoldier(database, scope, input.soldier_id)
          const target = soldierTarget(soldier.id)
          const plan = planLeaveCreation('create', input.as_approved, scope.soldier_id, scope.now)
          for (const permission of plan.permissions) requirePermission(scope, permission, target)
          requireCommentPermission(scope, comment, soldier.id)
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
            ...(await commentIdIssues(database, comment)),
          ]
          if (issues.length > 0) return failValidation(issues)

          const audit = createdBy(scope.soldier_id, scope.now)
          const created = parsedRow('leaves', {
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

          const acknowledged = await passRuleGate(database, scope, [created], input.acknowledged_rule_ids)
          const write = { leave: created, before: null, event: plan.event, changes: {}, acknowledged, comment }
          return { leave: created, written: await writeLeave(database, scope, write) }
        })
        changes.publish(written)
        return leave
      }),

    update: (raw) =>
      asResult(async () => {
        const input = parseInput(UpdateLeaveInput, raw)
        const { start_date, end_date, leave_type_id, availability_effect_override, reason, properties } = input.changes
        // Keys the caller left out are not changes (D-045), and a blank reason is no reason (D-101).
        const columns: LeaveEditColumns = {
          ...(start_date === undefined ? {} : { start_date }),
          ...(end_date === undefined ? {} : { end_date }),
          ...(leave_type_id === undefined ? {} : { leave_type_id }),
          ...(availability_effect_override === undefined ? {} : { availability_effect_override }),
          ...(reason === undefined ? {} : { reason: optionalText(reason) }),
          ...(properties === undefined ? {} : { properties }),
        }
        const { leave, written } = await edit(input, columns)
        changes.publish(written)
        return leave
      }),

    transition: (raw) =>
      asResult(async () => {
        const input = parseInput(TransitionLeaveInput, raw)
        const { comment } = input
        const { leave, written } = await database.transaction('rw', LEAVE_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const before = await visibleLeave(database, scope, input.id)
          const plan = planLeaveTransition(before, input.transition, scope.soldier_id, scope.now)
          // A step the status does not allow names no permission, so it goes straight to the state (D-117).
          if (plan.allowed) {
            for (const permission of plan.permissions) requirePermission(scope, permission, soldierTarget(before.soldier_id))
            requireCommentPermission(scope, comment, before.soldier_id)
          }
          if (before.version !== input.expected_version) return fail({ code: 'stale_version' })
          if (!plan.allowed) return failValidation(plan.issues)
          await requireOpenSoldier(database, before, (soldier) => archivedSoldierIssues(soldier, input.transition, ['transition']))
          const issues = await commentIdIssues(database, comment)
          if (issues.length > 0) return failValidation(issues)

          const after = parsedRow('leaves', {
            ...before,
            ...reviewOf(plan.next),
            ...updatedBy(scope.soldier_id, scope.now, before.version),
          })
          const acknowledged = await passRuleGate(database, scope, [after], input.acknowledged_rule_ids)
          const write = { leave: after, before, event: plan.event, changes: {}, acknowledged, comment }
          return { leave: after, written: await writeLeave(database, scope, write) }
        })
        changes.publish(written)
        return leave
      }),
  }
}
