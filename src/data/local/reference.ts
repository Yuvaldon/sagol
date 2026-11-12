import type { Store } from './store'
import {
  IssueCode,
  ReferenceQuery,
  type Issue,
  type OrganizationId,
  type Permission,
  type PolicyTarget,
  type TableName,
  type Timestamp,
} from '@contracts'
import { issuesFromSchema, withOptionalText, withPathPrefix } from '@domain'
import type { z } from 'zod'
import { holds, loadActorScope, requirePermission, type ActorScope } from './actor'
import { createdBy, updatedBy, type LocalDependencies } from './dependencies'
import { asResult, fail, failValidation, parseInput } from './failure'
import { POLICY_TABLES } from './snapshot'

// Generic create, update, archive and reorder of a reference table, and its filtered reads. One
// order of checks for all of them (D-090): schema → the row is visible → policy → the row's state →
// references and uniques → write, in one transaction. Later slices add a spec per table.

/** The columns generic commands read. Every reference row has them (D-017). */
export interface ReferenceRow {
  readonly id: string
  readonly organization_id: OrganizationId
  readonly version: number
  readonly archived_at: Timestamp | null
}

export type SortableRow = ReferenceRow & { readonly sort_order: number }

/** Resources written through these commands. It grows with each slice. */
export type ReferenceResource =
  | 'unit_levels'
  | 'units'
  | 'command_ranks'
  | 'soldiers'
  | 'leave_types'
  | 'tags'
  | 'availability_rules'
  | 'properties'
  | 'roles'
  | 'deployments'

type ReferenceAction = 'view' | 'create' | 'update' | 'delete'

/** Each reference resource with each of its actions: a member of `Permission`, which the next line proves (D-040). */
type ReferencePermission = { [R in ReferenceResource]: { resource: R; action: ReferenceAction } }[ReferenceResource]
const REFERENCE_PAIRS_ARE_PERMISSIONS: ReferencePermission extends Permission ? true : never = true

export function permissionOf(resource: ReferenceResource, action: ReferenceAction): Permission {
  // TypeScript compares a pair of unions only up to 25 combinations; the type above proves the pair valid.
  return REFERENCE_PAIRS_ARE_PERMISSIONS && ({ resource, action } as ReferencePermission)
}

/** What the row checks of a table get. `before` is NULL when the row is being created. */
export interface RowCheck<Row> {
  readonly database: Store
  readonly scope: ActorScope
  readonly row: Row
  readonly before: Row | null
}

export interface ReferenceSpec<Row extends ReferenceRow> {
  readonly table: TableName
  readonly resource: ReferenceResource
  readonly schema: z.ZodType<Row>
  /** Tables the row checks read, beyond this one and the policy tables. */
  readonly checkTables: readonly TableName[]
  /** Optional text columns: blank is stored as NULL (D-101). */
  readonly optionalText: readonly (keyof Row)[]
  /** What the row's permissions are checked against. */
  readonly targetOf: (row: Row) => PolicyTarget
  /** References and uniques. Paths are relative to the row (D-065). */
  readonly rowIssues: (check: RowCheck<Row>) => Promise<Issue[]>
  /** Who reads the row beyond `view` of its resource on its target. Absent: nobody else. */
  readonly alsoReadableBy?: (scope: ActorScope, row: Row) => boolean
}

function tableFor<Row extends ReferenceRow>(database: Store, spec: ReferenceSpec<Row>) {
  return database.table<Row>(spec.table)
}

export function tablesOf<Row extends ReferenceRow>(spec: ReferenceSpec<Row>): TableName[] {
  return [...new Set<TableName>([...POLICY_TABLES, spec.table, ...spec.checkTables])]
}

/** Live and archived rows of the organization. */
function rowsOf<Row extends ReferenceRow>(database: Store, spec: ReferenceSpec<Row>, organizationId: OrganizationId) {
  return tableFor(database, spec).where('organization_id').equals(organizationId).toArray()
}

/** The stored row, or `not_found` when it is missing or invisible to the actor (D-046). */
export async function visibleRow<Row extends ReferenceRow>(
  database: Store,
  spec: ReferenceSpec<Row>,
  scope: ActorScope,
  id: string,
): Promise<Row> {
  const stored = await tableFor(database, spec).get(id)
  const visible = stored !== undefined && stored.organization_id === scope.organization_id && readable(spec, scope, stored)
  if (!visible) return fail({ code: 'not_found' })
  return spec.schema.parse(stored)
}

/** `view` of the row's resource on its target, or the spec's own readers (D-186). */
function readable<Row extends ReferenceRow>(spec: ReferenceSpec<Row>, scope: ActorScope, row: Row): boolean {
  return holds(scope, permissionOf(spec.resource, 'view'), spec.targetOf(row)) || (spec.alsoReadableBy?.(scope, row) ?? false)
}

/** The row's state, before anything is compared with it (D-090). */
export function requireWritable(row: ReferenceRow, expectedVersion: number): void {
  if (row.archived_at !== null) failValidation([{ path: [], code: IssueCode.enum.archived }])
  if (row.version !== expectedVersion) fail({ code: 'stale_version' })
}

/** A candidate row with its optional text columns blank-as-NULL (D-101), before it is parsed. */
export function withSpecOptionalText<Row extends ReferenceRow>(spec: ReferenceSpec<Row>, candidate: object): object {
  // The candidate is not parsed yet, so it is only shaped like the row; the parse decides.
  return withOptionalText(candidate as Row, spec.optionalText)
}

export function parsedCandidate<Row extends ReferenceRow>(spec: ReferenceSpec<Row>, candidate: unknown, prefix: string[]): Row {
  const parsed = spec.schema.safeParse(candidate)
  if (parsed.success) return parsed.data
  return failValidation(withPathPrefix(prefix, issuesFromSchema(parsed.error.issues, candidate)))
}

export function bySortOrder(a: SortableRow, b: SortableRow): number {
  return a.sort_order - b.sort_order || a.id.localeCompare(b.id)
}

// --------------------------------------------------------------------- reads

export function createReferenceRepository<Row extends ReferenceRow>(
  dependencies: LocalDependencies,
  spec: ReferenceSpec<Row>,
  compare: (a: Row, b: Row) => number,
) {
  const { database } = dependencies
  const tables = tablesOf(spec)
  return {
    get: (id: Row['id']) =>
      asResult(() =>
        database.transaction('r', tables, async () => {
          const scope = await loadActorScope(dependencies)
          return visibleRow(database, spec, scope, id)
        }),
      ),
    list: (raw: ReferenceQuery) =>
      asResult(() => {
        const query = parseInput(ReferenceQuery, raw)
        return database.transaction('r', tables, async () => {
          const scope = await loadActorScope(dependencies)
          const rows = await rowsOf(database, spec, scope.organization_id)
          return rows
            .filter((row) => query.include_archived || row.archived_at === null)
            .filter((row) => readable(spec, scope, row))
            .sort(compare)
            .map((row) => spec.schema.parse(row))
        })
      }),
  }
}

// ------------------------------------------------------------------ commands

export interface VersionedInput<Id> {
  readonly id: Id
  readonly expected_version: number
}

export interface UpdateInputShape<Id> extends VersionedInput<Id> {
  readonly changes: object
}

export interface ReferenceInputs<Row extends ReferenceRow, Create, Update, Archive> {
  readonly create: z.ZodType<Create>
  readonly update: z.ZodType<Update>
  readonly archive: z.ZodType<Archive>
  /** What creating this row is checked against. */
  readonly placementOf: (input: Create) => PolicyTarget
  /** Further targets an update needs `update` over, beside the stored row's (a rule moved to another unit). */
  readonly updateTargetsOf?: (input: Update, before: Row) => readonly PolicyTarget[]
  /** Why this row may not be archived, on top of the shared checks. */
  readonly archiveIssues?: (database: Store, scope: ActorScope, row: Row) => Promise<Issue[]>
  /** Invariants of the state after an update or an archive. A refusal undoes the write. */
  readonly afterWrite?: (check: RowCheck<Row>) => Promise<void>
}

/** `changes` without the keys the caller left undefined. */
function definedChanges(changes: object): object {
  return Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined))
}

export function createReferenceCommands<
  Row extends ReferenceRow,
  Create extends { readonly id: Row['id'] },
  Update extends UpdateInputShape<Row['id']>,
  Archive extends VersionedInput<Row['id']>,
>(dependencies: LocalDependencies, spec: ReferenceSpec<Row>, inputs: ReferenceInputs<Row, Create, Update, Archive>) {
  const { database, changes: feed } = dependencies
  const tables = tablesOf(spec)
  const publish = (id: string) => {
    feed.publish([{ table: spec.table, ids: [id] }])
  }

  return {
    create: (raw: Create) =>
      asResult(async () => {
        const input = parseInput(inputs.create, raw)
        const row = await database.transaction('rw', tables, async () => {
          const scope = await loadActorScope(dependencies)
          requirePermission(scope, permissionOf(spec.resource, 'create'), inputs.placementOf(input))
          const candidate = parsedCandidate(
            spec,
            withSpecOptionalText(spec, {
              ...input,
              organization_id: scope.organization_id,
              ...createdBy(scope.soldier_id, scope.now),
            }),
            [],
          )
          if ((await tableFor(database, spec).get(input.id)) !== undefined) {
            return failValidation([{ path: ['id'], code: IssueCode.enum.already_exists }])
          }
          const issues = await spec.rowIssues({ database, scope, row: candidate, before: null })
          if (issues.length > 0) return failValidation(issues)
          await tableFor(database, spec).add(candidate)
          return candidate
        })
        publish(row.id)
        return row
      }),

    update: (raw: Update) =>
      asResult(async () => {
        const input = parseInput(inputs.update, raw)
        const row = await database.transaction('rw', tables, async () => {
          const scope = await loadActorScope(dependencies)
          const before = await visibleRow(database, spec, scope, input.id)
          requirePermission(scope, permissionOf(spec.resource, 'update'), spec.targetOf(before))
          for (const target of inputs.updateTargetsOf?.(input, before) ?? []) {
            requirePermission(scope, permissionOf(spec.resource, 'update'), target)
          }
          requireWritable(before, input.expected_version)
          // D-045: the changes merge into the stored row, and the merged row is what gets parsed.
          const merged = parsedCandidate(
            spec,
            withSpecOptionalText(spec, {
              ...before,
              ...definedChanges(input.changes),
              ...updatedBy(scope.soldier_id, scope.now, before.version),
            }),
            ['changes'],
          )
          const issues = await spec.rowIssues({ database, scope, row: merged, before })
          if (issues.length > 0) return failValidation(withPathPrefix(['changes'], issues))
          await tableFor(database, spec).put(merged)
          await inputs.afterWrite?.({ database, scope, row: merged, before })
          return merged
        })
        publish(row.id)
        return row
      }),

    archive: (raw: Archive) =>
      asResult(async () => {
        const input = parseInput(inputs.archive, raw)
        const row = await database.transaction('rw', tables, async () => {
          const scope = await loadActorScope(dependencies)
          const before = await visibleRow(database, spec, scope, input.id)
          requirePermission(scope, permissionOf(spec.resource, 'delete'), spec.targetOf(before))
          requireWritable(before, input.expected_version)
          const issues = (await inputs.archiveIssues?.(database, scope, before)) ?? []
          if (issues.length > 0) return failValidation(issues)
          const archived = spec.schema.parse({
            ...before,
            archived_at: scope.now,
            ...updatedBy(scope.soldier_id, scope.now, before.version),
          })
          await tableFor(database, spec).put(archived)
          await inputs.afterWrite?.({ database, scope, row: archived, before })
          return archived
        })
        publish(row.id)
        return row
      }),
  }
}

/**
 * Reorder: the input is the full ordered list of a group of live rows, and `sort_order` follows the
 * position (D-045). The actor must be able to update every row of the group, listed or not, and that
 * is checked before the list is compared, so the answer reveals nothing about rows it cannot see
 * (D-089).
 */
export function createReorderCommand<Row extends SortableRow>(
  dependencies: LocalDependencies,
  spec: ReferenceSpec<Row>,
  input: z.ZodType<{ items: VersionedInput<Row['id']>[] }>,
  groupOf: (row: Row) => string | null,
) {
  const { database, changes: feed } = dependencies
  const tables = tablesOf(spec)
  return (raw: { items: VersionedInput<Row['id']>[] }) =>
    asResult(async () => {
      const { items } = parseInput(input, raw)
      const { rows, written } = await database.transaction('rw', tables, async () => {
        const scope = await loadActorScope(dependencies)
        const listed = await Promise.all(items.map((item) => visibleRow(database, spec, scope, item.id)))
        const [first] = listed
        if (first === undefined) return failValidation([{ path: ['items'], code: IssueCode.enum.invalid_order }])

        const group = (await rowsOf(database, spec, scope.organization_id)).filter(
          (row) => row.archived_at === null && groupOf(row) === groupOf(first),
        )
        for (const row of group) requirePermission(scope, permissionOf(spec.resource, 'update'), spec.targetOf(row))

        const members = new Set<string>(group.map((row) => row.id))
        if (group.length !== items.length || !items.every((item) => members.has(item.id))) {
          return failValidation([{ path: ['items'], code: IssueCode.enum.invalid_order }])
        }

        const changed: Row[] = []
        const ordered = listed.map((row, position) => {
          const item = items[position]
          if (item === undefined) return row
          requireWritable(row, item.expected_version)
          if (row.sort_order === position) return row
          const moved = spec.schema.parse({
            ...row,
            sort_order: position,
            ...updatedBy(scope.soldier_id, scope.now, row.version),
          })
          changed.push(moved)
          return moved
        })
        await tableFor(database, spec).bulkPut(changed)
        return { rows: ordered, written: changed.map((row) => row.id) }
      })
      if (written.length > 0) feed.publish([{ table: spec.table, ids: written }])
      return rows
    })
}
