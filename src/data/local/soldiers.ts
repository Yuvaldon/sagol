import type { Store } from './store'
import {
  ArchiveSoldierInput,
  ChangeMembershipInput,
  CreateSoldierInput,
  IssueCode,
  MembershipQuery,
  MembershipType,
  SetSoldierTagsInput,
  Soldier,
  SoldierScopedQuery,
  UpdateSoldierInput,
  UpdateSoldierPrivateInput,
  type ChangeSeq,
  type DataCommands,
  type DataRepositories,
  type Issue,
  type SoldierId,
  type SoldierPrivate,
  type TableName,
  type UnitId,
  type UnitMembership,
  type UnitMembershipId,
  SoldierTagId,
} from '@contracts'
import {
  can,
  canUnconstrained,
  membershipChangeIssues,
  membershipOverlapIssues,
  normalizePersonalId,
  placementTarget,
  planMembershipChange,
  soldierTarget,
  spansOverlap,
  unitTarget,
  withOptionalText,
} from '@domain'
import { holds, loadActorScope, requirePermission, type ActorScope } from './actor'
import { propertiesIssues } from './checks'
import { tableOf } from './store'
import { createdBy, updatedBy, type LocalDependencies } from './dependencies'
import { asResult, fail, failValidation, parseInput, parsedRow } from './failure'
import {
  createReferenceCommands,
  createReferenceRepository,
  parsedCandidate,
  permissionOf,
  requireWritable,
  tablesOf,
  visibleRow,
  withSpecOptionalText,
  type ReferenceSpec,
  type RowCheck,
} from './reference'
import { rolePairs, requireHeld } from './permissions'
import { POLICY_TABLES, loadPolicySnapshot, requireAccessManager } from './snapshot'
import { SOLDIER_TAG_TABLES, soldierTagIssues, tagScopeIssues } from './tags'
import { membershipsHoldLeaves } from './leaveRotation'
import { counterChange, nextChangeSeq } from './changeCounters'
import { deleteSubscriptionsOf } from './notifications'

// The roster: `soldiers`, `soldier_private` (its own permission resource, D-018) and `unit_memberships`
// (time-bounded rows, D-010). The permissions are D-096 and the membership rules are D-097. A soldier's tags
// are a set written with `soldiers:update` (D-130).

export const MEMBERSHIPS_UPDATE = { resource: 'memberships', action: 'update' } as const
const MEMBERSHIPS_VIEW = { resource: 'memberships', action: 'view' } as const
const PRIVATE_VIEW = { resource: 'soldier_private', action: 'view' } as const
const PRIVATE_UPDATE = { resource: 'soldier_private', action: 'update' } as const

/** A new rank must exist, be visible and be live. An unchanged one is left alone (D-095). */
async function rankIssues({ database, scope, row, before }: RowCheck<Soldier>): Promise<Issue[]> {
  if (row.command_rank_id === null || row.command_rank_id === before?.command_rank_id) return []
  const rank = await tableOf(database, 'command_ranks').get(row.command_rank_id)
  const visible =
    rank !== undefined &&
    rank.organization_id === scope.organization_id &&
    holds(scope, permissionOf('command_ranks', 'view'), { kind: 'organization' })
  if (!visible) return [{ path: ['command_rank_id'], code: IssueCode.enum.reference_not_found }]
  if (rank.archived_at !== null) return [{ path: ['command_rank_id'], code: IssueCode.enum.reference_archived }]
  // D-156: a rank gives the pairs of every live role bound to it.
  const bindings = await tableOf(database, 'rank_role_bindings').where('command_rank_id').equals(rank.id).toArray()
  const roleIds = new Set(bindings.filter((binding) => binding.archived_at === null).map((binding) => binding.role_id))
  const pairs = []
  for (const roleId of roleIds) {
    const role = await tableOf(database, 'roles').get(roleId)
    if (role !== undefined && role.archived_at === null) pairs.push(...(await rolePairs(database, roleId)))
  }
  requireHeld(scope, pairs)
  return []
}

/** D-157: a rank write passes the permission check on the soldier as stored after the write too. */
async function requireAfterRankWrite(database: Store, scope: ActorScope, action: 'create' | 'update', soldierId: SoldierId) {
  const { context } = await loadPolicySnapshot(database, scope.organization_id, scope.now)
  const permission = permissionOf('soldiers', action)
  const target = soldierTarget(soldierId)
  if (!can(context, scope.soldier_id, permission, target)) fail({ code: 'forbidden' })
  // One's own rank changes only through an unconstrained source: a higher rank widens what the constrained ones reach.
  if (soldierId === scope.soldier_id && !canUnconstrained(context, scope.soldier_id, permission, target)) fail({ code: 'forbidden' })
}

const SPEC: ReferenceSpec<Soldier> = {
  table: 'soldiers',
  resource: 'soldiers',
  schema: Soldier,
  checkTables: ['property_definitions', 'push_subscriptions'],
  optionalText: ['nickname'],
  targetOf: (row) => soldierTarget(row.id),
  rowIssues: async (check) => [
    ...(await rankIssues(check)),
    ...(await propertiesIssues(check.database, check.scope, 'soldier', check.before?.properties ?? null, check.row.properties)),
  ],
}

/** A placement takes a change number (D-373). */
export const ROSTER_TABLES: readonly TableName[] = [...tablesOf(SPEC), 'soldier_private', 'change_counters']
/** A membership change reads the soldier's requests and their rotations (D-221). */
const MEMBERSHIP_TABLES: readonly TableName[] = [
  ...new Set<TableName>([...ROSTER_TABLES, 'leaves', 'deployments', 'deployment_members', 'units']),
]

/** Optional private text: blank is stored as NULL (D-101). The personal id has its own normalization (D-066). */
const PRIVATE_OPTIONAL_TEXT = ['invite_email', 'phone'] as const

/**
 * The private fields of a raw input with blanks as NULL, before the input is parsed: a blank email would otherwise
 * fail its format, while D-101 says blank means "no value". The parse that follows still decides the rest.
 */
function blankPrivateText<Raw>(raw: Raw, key: 'private' | 'changes'): Raw {
  if (typeof raw !== 'object' || raw === null || !(key in raw)) return raw
  const fields: unknown = (raw as Record<string, unknown>)[key]
  if (typeof fields !== 'object' || fields === null) return raw
  return { ...raw, [key]: withOptionalText(fields as Record<string, unknown>, PRIVATE_OPTIONAL_TEXT) }
}

/** A unit a soldier is placed in must exist, be visible and be live. */
async function placementIssues(database: Store, scope: ActorScope, unitId: UnitId, path: readonly string[]): Promise<Issue[]> {
  const unit = await tableOf(database, 'units').get(unitId)
  const visible =
    unit !== undefined &&
    unit.organization_id === scope.organization_id &&
    holds(scope, permissionOf('units', 'view'), unitTarget(unit))
  if (!visible) return [{ path: [...path], code: IssueCode.enum.reference_not_found }]
  if (unit.archived_at !== null) return [{ path: [...path], code: IssueCode.enum.reference_archived }]
  return []
}

/** `uq_soldier_private_personal_id`: archived soldiers keep their number too (D-098). */
export async function personalIdIssues(
  database: Store,
  scope: ActorScope,
  soldierId: SoldierId,
  personalId: string | null,
  path: readonly string[],
): Promise<Issue[]> {
  if (personalId === null) return []
  const holder = await tableOf(database, 'soldier_private')
    .where('[organization_id+personal_id]')
    .equals([scope.organization_id, personalId])
    .first()
  return holder === undefined || holder.soldier_id === soldierId
    ? []
    : [{ path: [...path], code: IssueCode.enum.already_exists }]
}

/** A personal id is stored normalized, so the unique index sees one value per person (D-066). */
function normalizedPersonalId(value: string | null): string | null {
  return value === null ? null : normalizePersonalId(value)
}

export function placedRow(
  scope: ActorScope,
  id: UnitMembership['id'],
  soldierId: SoldierId,
  unitId: UnitId,
  validFrom: UnitMembership['valid_from'],
  changeSeq: ChangeSeq,
): UnitMembership {
  return parsedRow('unit_memberships', {
    id,
    organization_id: scope.organization_id,
    soldier_id: soldierId,
    unit_id: unitId,
    membership_type: MembershipType.enum.primary,
    valid_from: validFrom,
    valid_to: null,
    change_seq: changeSeq,
    ...createdBy(scope.soldier_id, scope.now),
  })
}

/** What a new soldier is made of: the row, its first placement and its private fields (D-094). */
export interface NewSoldier {
  readonly content: Omit<CreateSoldierInput, 'private' | 'membership'>
  readonly membership: CreateSoldierInput['membership']
  readonly private: CreateSoldierInput['private']
}

/** Ids are the caller's (D-044): one already taken is `already_exists`, not a failed write (OI-050). */
async function requireFreeMembershipId(database: Store, id: UnitMembershipId, path: readonly (string | number)[]): Promise<void> {
  if ((await tableOf(database, 'unit_memberships').get(id)) !== undefined) {
    failValidation([{ path: [...path], code: IssueCode.enum.already_exists }])
  }
}

/**
 * The checks and the writes of a new soldier, once the caller has checked the permissions it needs. `prefix` says where
 * the input sits in the caller's input, so a refusal names the caller's field. A new soldier from a link review (D-149)
 * and `soldiers.create` write it one way.
 */
export async function insertSoldier(
  database: Store,
  scope: ActorScope,
  input: NewSoldier,
  prefix: readonly string[],
): Promise<{ soldier: Soldier; hasPrivate: boolean }> {
  const { content, membership, private: privateFields } = input
  const soldier = parsedCandidate(
    SPEC,
    withSpecOptionalText(SPEC, {
      ...content,
      organization_id: scope.organization_id,
      ...createdBy(scope.soldier_id, scope.now),
    }),
    [...prefix],
  )
  if ((await tableOf(database, 'soldiers').get(content.id)) !== undefined) {
    return failValidation([{ path: [...prefix, 'id'], code: IssueCode.enum.already_exists }])
  }
  const personalId = normalizedPersonalId(privateFields?.personal_id ?? null)
  const issues = [
    ...(await SPEC.rowIssues({ database, scope, row: soldier, before: null })),
    ...(membership === null ? [] : await placementIssues(database, scope, membership.unit_id, [...prefix, 'membership', 'unit_id'])),
    ...(await personalIdIssues(database, scope, soldier.id, personalId, [...prefix, 'private', 'personal_id'])),
  ]
  if (issues.length > 0) return failValidation(issues)
  if (membership !== null) await requireFreeMembershipId(database, membership.id, [...prefix, 'membership', 'id'])

  await tableOf(database, 'soldiers').add(soldier)
  if (membership !== null) {
    const changeSeq = await nextChangeSeq(database, scope.organization_id)
    await tableOf(database, 'unit_memberships').add(
      placedRow(scope, membership.id, soldier.id, membership.unit_id, membership.valid_from, changeSeq),
    )
  }
  const hasPrivate = privateFields !== null && (personalId !== null || privateFields.invite_email !== null || privateFields.phone !== null)
  if (hasPrivate) {
    await tableOf(database, 'soldier_private').add(
      parsedRow('soldier_private', {
        ...privateFields,
        personal_id: personalId,
        soldier_id: soldier.id,
        organization_id: scope.organization_id,
        ...updatedBy(scope.soldier_id, scope.now, 0),
      }),
    )
  }
  // D-157, for every way a soldier is created (the roster and a link request alike).
  if (soldier.command_rank_id !== null) await requireAfterRankWrite(database, scope, 'create', soldier.id)
  return { soldier, hasPrivate }
}

// --------------------------------------------------------------------- reads

export function createSoldierRepository(dependencies: LocalDependencies): DataRepositories['soldiers'] {
  // The order for people is `logic`'s, in Hebrew (D-094). The id only keeps this answer stable.
  return createReferenceRepository(dependencies, SPEC, (a, b) => a.id.localeCompare(b.id))
}

export function createSoldierPrivateRepository(dependencies: LocalDependencies): DataRepositories['soldier_private'] {
  const { database } = dependencies
  const tables: TableName[] = [...POLICY_TABLES, 'soldier_private']
  return {
    get: (soldierId) =>
      asResult(() =>
        database.transaction('r', tables, async () => {
          const scope = await loadActorScope(dependencies)
          const stored = await tableOf(database, 'soldier_private').get(soldierId)
          const visible =
            stored !== undefined &&
            stored.organization_id === scope.organization_id &&
            holds(scope, PRIVATE_VIEW, soldierTarget(soldierId))
          if (!visible) return fail({ code: 'not_found' })
          return parsedRow('soldier_private', stored)
        }),
      ),
    list: (raw) =>
      asResult(() => {
        const query = parseInput(SoldierScopedQuery, raw)
        return database.transaction('r', tables, async () => {
          const scope = await loadActorScope(dependencies)
          const rows = await tableOf(database, 'soldier_private').where('organization_id').equals(scope.organization_id).toArray()
          return rows
            .filter((row) => query.soldier_ids === null || query.soldier_ids.includes(row.soldier_id))
            .filter((row) => holds(scope, PRIVATE_VIEW, soldierTarget(row.soldier_id)))
            .map((row) => parsedRow('soldier_private', row))
        })
      }),
  }
}

export function createMembershipRepository(dependencies: LocalDependencies): DataRepositories['unit_memberships'] {
  const { database } = dependencies
  return {
    get: (id) =>
      asResult(() =>
        database.transaction('r', POLICY_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const stored = await tableOf(database, 'unit_memberships').get(id)
          const visible =
            stored !== undefined &&
            stored.organization_id === scope.organization_id &&
            holds(scope, MEMBERSHIPS_VIEW, soldierTarget(stored.soldier_id))
          if (!visible) return fail({ code: 'not_found' })
          return parsedRow('unit_memberships', stored)
        }),
      ),
    list: (raw) =>
      asResult(() => {
        const query = parseInput(MembershipQuery, raw)
        const window =
          query.window === null ? null : { valid_from: query.window.start_date, valid_to: query.window.end_date }
        return database.transaction('r', POLICY_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const rows = await tableOf(database, 'unit_memberships').where('organization_id').equals(scope.organization_id).toArray()
          return rows
            .filter((row) => query.soldier_ids === null || query.soldier_ids.includes(row.soldier_id))
            .filter((row) => query.unit_ids === null || query.unit_ids.includes(row.unit_id))
            .filter((row) => window === null || spansOverlap(row, window))
            .filter((row) => holds(scope, MEMBERSHIPS_VIEW, soldierTarget(row.soldier_id)))
            .sort((a, b) => a.valid_from.localeCompare(b.valid_from) || a.id.localeCompare(b.id))
            .map((row) => parsedRow('unit_memberships', row))
        })
      }),
  }
}

// ------------------------------------------------------------------ commands

export function createSoldierCommands(dependencies: LocalDependencies): DataCommands['soldiers'] {
  const { database, changes } = dependencies
  const { update, archive } = createReferenceCommands(dependencies, SPEC, {
    create: CreateSoldierInput,
    update: UpdateSoldierInput,
    archive: ArchiveSoldierInput,
    placementOf: (input) => placementTarget(input.membership?.unit_id ?? null),
    // What can take permissions away is checked on the state after the write (D-059, D-096).
    afterWrite: async ({ database: store, scope, row, before }) => {
      const changed =
        before === null ||
        row.status !== before.status ||
        row.command_rank_id !== before.command_rank_id ||
        row.archived_at !== before.archived_at
      if (changed) await requireAccessManager(store, scope.organization_id, scope.now)
      if (row.command_rank_id !== before?.command_rank_id) await requireAfterRankWrite(store, scope, 'update', row.id)
      // An archived soldier's devices stop getting pushes (D-351).
      if (before !== null && before.archived_at === null && row.archived_at !== null) await deleteSubscriptionsOf(store, row.id)
    },
  })

  return {
    update,
    archive,

    // D-130: the whole set, guarded by the soldier's version, which it bumps (D-045).
    setTags: (raw) =>
      asResult(async () => {
        const input = parseInput(SetSoldierTagsInput, raw)
        const rows = await database.transaction('rw', [...ROSTER_TABLES, ...SOLDIER_TAG_TABLES], async () => {
          const scope = await loadActorScope(dependencies)
          const soldier = await visibleRow(database, SPEC, scope, input.soldier_id)
          requirePermission(scope, permissionOf('soldiers', 'update'), soldierTarget(soldier.id))
          requireWritable(soldier, input.expected_version)

          const scopeIssues = await tagScopeIssues(database, scope, input.deployment_id)
          if (scopeIssues.length > 0) return failValidation(scopeIssues)

          const table = tableOf(database, 'soldier_tags')
          // One scope at a time (D-221): the persistent set, or one rotation's.
          const held = (await table.where('soldier_id').equals(soldier.id).toArray()).filter(
            (row) => row.deployment_id === input.deployment_id,
          )
          const issues = await soldierTagIssues(database, scope, held.map((row) => row.tag_id), input.tag_ids)
          if (issues.length > 0) return failValidation(issues)

          const next = new Set(input.tag_ids)
          const heldById = new Map(held.map((row) => [row.tag_id, row]))
          await table.bulkDelete(held.filter((row) => !next.has(row.tag_id)).map((row) => row.id))
          const answer = input.tag_ids.map(
            (tagId) =>
              heldById.get(tagId) ??
              parsedRow('soldier_tags', {
                id: SoldierTagId.parse(crypto.randomUUID()),
                soldier_id: soldier.id,
                tag_id: tagId,
                deployment_id: input.deployment_id,
                organization_id: scope.organization_id,
                created_at: scope.now,
                created_by: scope.soldier_id,
              }),
          )
          await table.bulkAdd(answer.filter((row) => !heldById.has(row.tag_id)))
          await tableOf(database, 'soldiers').put(
            SPEC.schema.parse({ ...soldier, ...updatedBy(scope.soldier_id, scope.now, soldier.version) }),
          )
          return answer.map((row) => parsedRow('soldier_tags', row))
        })
        changes.publish([
          { table: 'soldier_tags', ids: [input.soldier_id] },
          { table: 'soldiers', ids: [input.soldier_id] },
        ])
        return rows
      }),

    create: (raw) =>
      asResult(async () => {
        const input = parseInput(CreateSoldierInput, blankPrivateText(raw, 'private'))
        const { private: privateFields, membership, ...content } = input
        const written = await database.transaction('rw', ROSTER_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const placement = placementTarget(membership?.unit_id ?? null)
          requirePermission(scope, permissionOf('soldiers', 'create'), placement)
          if (membership !== null) requirePermission(scope, MEMBERSHIPS_UPDATE, { kind: 'unit', unit_id: membership.unit_id })
          if (privateFields !== null) requirePermission(scope, PRIVATE_UPDATE, placement)
          return insertSoldier(database, scope, { content, membership, private: privateFields }, [])
        })
        changes.publish([
          { table: 'soldiers', ids: [written.soldier.id] },
          ...(membership === null
            ? []
            : [
                { table: 'unit_memberships' as const, ids: [membership.id] },
                counterChange(written.soldier.organization_id),
              ]),
          ...(written.hasPrivate ? [{ table: 'soldier_private' as const, ids: [written.soldier.id] }] : []),
        ])
        return written.soldier
      }),

    updatePrivate: (raw) =>
      asResult(async () => {
        const input = parseInput(UpdateSoldierPrivateInput, blankPrivateText(raw, 'changes'))
        const row = await database.transaction('rw', ROSTER_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const soldier = await visibleRow(database, SPEC, scope, input.soldier_id)
          const target = soldierTarget(soldier.id)
          // The answer holds the values, so writing them needs reading them (D-096).
          requirePermission(scope, PRIVATE_VIEW, target)
          requirePermission(scope, PRIVATE_UPDATE, target)
          if (soldier.archived_at !== null) return failValidation([{ path: [], code: IssueCode.enum.archived }])

          const stored = await tableOf(database, 'soldier_private').get(soldier.id)
          if ((stored?.version ?? null) !== input.expected_version) return fail({ code: 'stale_version' })

          const defined = Object.fromEntries(Object.entries(input.changes).filter(([, value]) => value !== undefined))
          const merged: Omit<SoldierPrivate, 'updated_at' | 'updated_by' | 'version'> = {
            soldier_id: soldier.id,
            organization_id: scope.organization_id,
            personal_id: stored?.personal_id ?? null,
            invite_email: stored?.invite_email ?? null,
            phone: stored?.phone ?? null,
            ...defined,
          }
          const personalId = normalizedPersonalId(merged.personal_id)
          const issues = await personalIdIssues(database, scope, soldier.id, personalId, ['changes', 'personal_id'])
          if (issues.length > 0) return failValidation(issues)

          const next = parsedRow('soldier_private', {
            ...merged,
            personal_id: personalId,
            ...updatedBy(scope.soldier_id, scope.now, stored?.version ?? 0),
          })
          await tableOf(database, 'soldier_private').put(next)
          return next
        })
        changes.publish([{ table: 'soldier_private', ids: [row.soldier_id] }])
        return row
      }),

    changeMembership: (raw) =>
      asResult(async () => {
        const input = parseInput(ChangeMembershipInput, raw)
        const newUnitId = input.new_membership?.unit_id ?? null
        const written = await database.transaction('rw', MEMBERSHIP_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const soldier = await visibleRow(database, SPEC, scope, input.soldier_id)
          requirePermission(scope, MEMBERSHIPS_UPDATE, soldierTarget(soldier.id))
          if (newUnitId !== null) requirePermission(scope, MEMBERSHIPS_UPDATE, { kind: 'unit', unit_id: newUnitId })
          if (soldier.archived_at !== null) return failValidation([{ path: [], code: IssueCode.enum.archived }])

          const rows = await tableOf(database, 'unit_memberships').where('soldier_id').equals(soldier.id).toArray()
          const named = input.current_membership
          const current = named === null ? null : (rows.find((row) => row.id === named.id) ?? null)
          if (named !== null) {
            if (current === null) {
              return failValidation([{ path: ['current_membership', 'id'], code: IssueCode.enum.reference_not_found }])
            }
            if (current.valid_to !== null || current.version !== named.expected_version) {
              return fail({ code: 'stale_version' })
            }
          }

          const issues = [
            ...(newUnitId === null ? [] : await placementIssues(database, scope, newUnitId, ['new_membership', 'unit_id'])),
            ...membershipChangeIssues(current, input.effective_date, newUnitId),
          ]
          if (issues.length > 0) return failValidation(issues)

          const table = tableOf(database, 'unit_memberships')
          const answer: UnitMembership[] = []
          const plan = planMembershipChange(current, input.effective_date, newUnitId)
          if (plan.kind === 'correct') {
            if (current === null) return fail({ code: 'internal' })
            const corrected = parsedRow('unit_memberships', {
              ...current,
              unit_id: plan.unit_id,
              change_seq: await nextChangeSeq(database, scope.organization_id),
              ...updatedBy(scope.soldier_id, scope.now, current.version),
            })
            await table.put(corrected)
            answer.push(corrected)
          } else {
            if (current !== null && plan.close_on !== null) {
              const closed = parsedRow('unit_memberships', {
                ...current,
                valid_to: plan.close_on,
                change_seq: await nextChangeSeq(database, scope.organization_id),
                ...updatedBy(scope.soldier_id, scope.now, current.version),
              })
              await table.put(closed)
              answer.push(closed)
            }
            if (plan.open_unit_id !== null && input.new_membership !== null) {
              const changeSeq = await nextChangeSeq(database, scope.organization_id)
              const opened = placedRow(
                scope,
                input.new_membership.id,
                soldier.id,
                plan.open_unit_id,
                input.effective_date,
                changeSeq,
              )
              const others = [...rows.filter((row) => row.id !== current?.id), ...answer]
              const overlap = membershipOverlapIssues(others, opened)
              if (overlap.length > 0) {
                return failValidation(overlap.map((issue) => ({ ...issue, path: ['effective_date'] })))
              }
              await requireFreeMembershipId(database, opened.id, ['new_membership', 'id'])
              await table.add(opened)
              answer.push(opened)
            }
          }

          // A move or an end may not strand a live request of a whole-unit rotation (D-216, D-221).
          if (!(await membershipsHoldLeaves(database, scope.organization_id, soldier.id))) {
            return failValidation([{ path: ['effective_date'], code: IssueCode.enum.leaves_outside_rotation }])
          }
          await requireAccessManager(database, scope.organization_id, scope.now)
          return answer
        })
        changes.publish([
          { table: 'unit_memberships', ids: written.map((row) => row.id) },
          ...written.slice(0, 1).map((row) => counterChange(row.organization_id)),
        ])
        return written
      }),
  }
}
