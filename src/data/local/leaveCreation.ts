import type { Store } from './store'
import {
  CreateLeaveBatchInput,
  CreateLeavesInput,
  DuplicateLeaveInput,
  EmptyQuery,
  IssueCode,
  type AvailabilityRuleId,
  type DataChange,
  type DataCommands,
  type DataRepositories,
  type DeploymentId,
  type Issue,
  type JsonValue,
  type Leave,
  type LeaveBatch,
  type LeaveBatchId,
  type SoldierId,
  type TableName,
} from '@contracts'
import {
  duplicatedLeaveColumns,
  leaveReasonIssues,
  optionalText,
  planLeaveCreation,
  soldierTarget,
  withPathPrefix,
  type LeaveCreationSource,
} from '@domain'
import { loadActorScope, requirePermission, type ActorScope } from './actor'
import { propertiesIssues } from './checks'
import { leaveRotationCheck } from './leaveRotation'
import { tableOf } from './store'
import { createdBy, type LocalDependencies } from './dependencies'
import { asResult, fail, failValidation, parseInput, parsedRow } from './failure'
import { passRuleGate, writeLeave } from './leaveCommands'
import { LEAVE_TABLES, canView, leaveTypeOf, visibleLeave, visibleSoldier } from './leaves'
import { POLICY_TABLES } from './snapshot'

// Leaves created together (D-012, D-049, D-179, D-275): a batch for several soldiers, several leaves of one soldier,
// and copies of a leave. Each new leave is
// checked as `leaves.create` checks one, on its own path, and the rules judge them all at once (D-073), so the command
// saves every leave or none. Each leave gets its own `created` event with the acknowledged rules.

/** The columns of one new leave, before the plan's review state. */
interface LeaveDraft {
  readonly id: Leave['id']
  readonly soldier_id: SoldierId
  readonly deployment_id: DeploymentId
  readonly start_date: Leave['start_date']
  readonly end_date: Leave['end_date']
  readonly leave_type_id: Leave['leave_type_id']
  readonly availability_effect_override: Leave['availability_effect_override']
  readonly reason: string | null
  readonly properties: Readonly<Record<string, JsonValue>>
}

interface Creation {
  readonly source: LeaveCreationSource
  readonly as_approved: boolean
  readonly acknowledged_rule_ids: readonly AvailabilityRuleId[]
  readonly batch_id: LeaveBatchId | null
  readonly drafts: readonly LeaveDraft[]
  /** Where each draft's issues go: `['leaves', i]` or `['copies', i]`. */
  readonly pathOf: (index: number) => (string | number)[]
  /** Issues of the command's own rows, checked with the leaves' ids. */
  readonly ownIssues: () => Promise<Issue[]>
  /** Rows the leaves reference, written before them. */
  readonly writeFirst: () => Promise<void>
}

/** The type, the reason and the properties of a draft (D-113, D-016). Paths are relative to the draft. */
async function detailIssues(database: Store, scope: ActorScope, draft: LeaveDraft): Promise<Issue[]> {
  const { type, issues } = await leaveTypeOf(database, scope, draft.leave_type_id)
  return [
    ...issues,
    ...(type === null ? [] : leaveReasonIssues(type, draft.reason)),
    ...(await propertiesIssues(database, scope, 'leave', null, draft.properties)),
  ]
}

/**
 * The order of D-090 and D-114 over every draft: each soldier is visible and every permission holds, then the state
 * (an archived soldier), then the ids and the references. Returns the new leaves and what the feed is told.
 */
async function createLeaves(
  database: Store,
  scope: ActorScope,
  creation: Creation,
  details: (draft: LeaveDraft) => Promise<Issue[]>,
): Promise<{ leaves: Leave[]; written: DataChange[] }> {
  const plan = planLeaveCreation(creation.source, creation.as_approved, scope.soldier_id, scope.now)
  const soldiers = []
  for (const draft of creation.drafts) {
    const soldier = await visibleSoldier(database, scope, draft.soldier_id)
    for (const permission of plan.permissions) requirePermission(scope, permission, soldierTarget(soldier.id))
    soldiers.push(soldier)
  }
  const archived = soldiers.flatMap((soldier, index) =>
    soldier.archived_at === null ? [] : [{ path: [...creation.pathOf(index), 'soldier_id'], code: IssueCode.enum.archived }],
  )
  if (archived.length > 0) return failValidation(archived)

  const issues: Issue[] = await creation.ownIssues()
  for (const [index, draft] of creation.drafts.entries()) {
    const taken = (await tableOf(database, 'leaves').get(draft.id)) !== undefined
    const found = [
      ...(taken ? [{ path: ['id'], code: IssueCode.enum.already_exists }] : []),
      ...(await details(draft)),
      ...(await leaveRotationCheck(database, scope, draft, true)),
    ]
    issues.push(...withPathPrefix(creation.pathOf(index), found))
  }
  if (issues.length > 0) return failValidation(issues)

  const audit = createdBy(scope.soldier_id, scope.now)
  const leaves = creation.drafts.map((draft) =>
    parsedRow('leaves', {
      ...draft,
      organization_id: scope.organization_id,
      batch_id: creation.batch_id,
      ...plan.next,
      created_at: audit.created_at,
      created_by: audit.created_by,
      updated_at: audit.updated_at,
      updated_by: audit.updated_by,
      version: audit.version,
    }),
  )
  const acknowledged = await passRuleGate(database, scope, leaves, creation.acknowledged_rule_ids)
  await creation.writeFirst()
  const written: DataChange[] = []
  for (const leave of leaves) {
    const write = { leave, before: null, event: plan.event, changes: {}, acknowledged, comment: null }
    written.push(...(await writeLeave(database, scope, write)))
  }
  return { leaves, written }
}

const CREATION_TABLES: readonly TableName[] = [...new Set<TableName>([...LEAVE_TABLES, 'leave_batches'])]

export function createLeaveCreationCommands(
  dependencies: LocalDependencies,
): Pick<DataCommands['leaves'], 'createBatch' | 'createMany' | 'duplicate'> {
  const { database, changes } = dependencies
  return {
    createBatch: (raw) =>
      asResult(async () => {
        const input = parseInput(CreateLeaveBatchInput, raw)
        const result = await database.transaction('rw', CREATION_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const batch = parsedRow('leave_batches', {
            id: input.batch.id,
            organization_id: scope.organization_id,
            name: input.batch.name,
            description: optionalText(input.batch.description),
            created_at: scope.now,
            created_by: scope.soldier_id,
          })
          const created = await createLeaves(
            database,
            scope,
            {
              source: 'create',
              as_approved: input.as_approved,
              acknowledged_rule_ids: input.acknowledged_rule_ids,
              batch_id: batch.id,
              drafts: input.leaves.map((leave) => ({
                ...leave,
                deployment_id: input.deployment_id,
                reason: optionalText(leave.reason),
              })),
              pathOf: (index) => ['leaves', index],
              ownIssues: async () =>
                (await tableOf(database, 'leave_batches').get(batch.id)) === undefined
                  ? []
                  : [{ path: ['batch', 'id'], code: IssueCode.enum.already_exists }],
              writeFirst: async () => {
                await tableOf(database, 'leave_batches').add(batch)
              },
            },
            (draft) => detailIssues(database, scope, draft),
          )
          return { batch, ...created }
        })
        changes.publish([...result.written, { table: 'leave_batches', ids: [result.batch.id] }])
        return { batch: result.batch, leaves: result.leaves }
      }),

    // One soldier's sheet (D-275): each leave in its own rotation, and no batch row, since none is stored (D-267).
    createMany: (raw) =>
      asResult(async () => {
        const input = parseInput(CreateLeavesInput, raw)
        const result = await database.transaction('rw', CREATION_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          return createLeaves(
            database,
            scope,
            {
              source: 'create',
              as_approved: input.as_approved,
              acknowledged_rule_ids: input.acknowledged_rule_ids,
              batch_id: null,
              drafts: input.leaves.map((leave) => ({
                ...leave,
                soldier_id: input.soldier_id,
                reason: optionalText(leave.reason),
              })),
              pathOf: (index) => ['leaves', index],
              ownIssues: () => Promise.resolve([]),
              writeFirst: () => Promise.resolve(),
            },
            (draft) => detailIssues(database, scope, draft),
          )
        })
        changes.publish(result.written)
        return result.leaves
      }),

    duplicate: (raw) =>
      asResult(async () => {
        const input = parseInput(DuplicateLeaveInput, raw)
        const result = await database.transaction('rw', CREATION_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const source = await visibleLeave(database, scope, input.leave_id)
          const copied = duplicatedLeaveColumns(source)
          const drafts = input.copies.map((copy) => ({ ...copy, ...copied }))
          // The copied details are the source's, so their issues are the source's: on `leave_id`, once.
          let checked = false
          const created = await createLeaves(
            database,
            scope,
            {
              source: 'duplicate',
              as_approved: input.as_approved,
              acknowledged_rule_ids: input.acknowledged_rule_ids,
              batch_id: null,
              drafts,
              pathOf: (index) => ['copies', index],
              ownIssues: () => Promise.resolve([]),
              writeFirst: () => Promise.resolve(),
            },
            async (draft) => {
              if (checked) return []
              checked = true
              const issues = await detailIssues(database, scope, draft)
              if (issues.length > 0) failValidation(issues.map((issue) => ({ ...issue, path: ['leave_id'] })))
              return []
            },
          )
          return created
        })
        changes.publish(result.written)
        return result.leaves
      }),
  }
}

// --------------------------------------------------------------------- reads

const BATCH_TABLES: readonly TableName[] = [...POLICY_TABLES, 'leave_batches', 'leaves']

/** A batch is visible with one of its leaves: its name says nothing the actor cannot see (D-179). */
async function visibleBatches(database: Store, scope: ActorScope): Promise<LeaveBatch[]> {
  const [batches, leaves] = await Promise.all([
    tableOf(database, 'leave_batches').where('organization_id').equals(scope.organization_id).toArray(),
    tableOf(database, 'leaves').where('organization_id').equals(scope.organization_id).toArray(),
  ])
  const seen = new Set(leaves.filter((leave) => leave.batch_id !== null && canView(scope, leave)).map((leave) => leave.batch_id))
  return batches.filter((batch) => seen.has(batch.id)).map((batch) => parsedRow('leave_batches', batch))
}

export function createLeaveBatchRepository(dependencies: LocalDependencies): DataRepositories['leave_batches'] {
  const { database } = dependencies
  return {
    get: (id) =>
      asResult(() =>
        database.transaction('r', BATCH_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const batch = (await visibleBatches(database, scope)).find((row) => row.id === id)
          return batch ?? fail({ code: 'not_found' })
        }),
      ),
    list: (raw) =>
      asResult(() => {
        parseInput(EmptyQuery, raw)
        return database.transaction('r', BATCH_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          return (await visibleBatches(database, scope)).sort(
            (a, b) => b.created_at.localeCompare(a.created_at) || a.name.localeCompare(b.name),
          )
        })
      }),
  }
}
