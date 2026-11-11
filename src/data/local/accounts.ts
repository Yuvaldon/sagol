import type Dexie from 'dexie'
import {
  AccountLinkRequestQuery,
  AccountLinkRequestStatus,
  CancelAccountLinkRequestInput,
  IssueCode,
  RequestAccountLinkInput,
  ReviewAccountLinkInput,
  RevokeAccountLinkInput,
  SoldierScopedQuery,
  SoldierStatus,
  UpdateMyPreferencesInput,
  type AccountLinkRequest,
  type AuthIdentity,
  type DataChange,
  type DataCommands,
  type DataRepositories,
  type LinkCandidate,
  type OrganizationId,
  type SoldierAccount,
  type SoldierId,
  type TableName,
} from '@contracts'
import {
  ACCOUNT_REVIEW_PERMISSION,
  autoLinkSoldier,
  canLinkSoldier,
  canReviewLinkRequest,
  canRevokeAccount,
  linkCandidates,
  linkEnrichment,
  linkRequestTransitionIssues,
  linkTargetIssues,
  normalizePersonalId,
  placementTarget,
  soldierTarget,
  type LinkMatchData,
} from '@domain'
import { holds, loadActorScope, requirePermission, type ActorScope } from './actor'
import { tableOf } from './database'
import { updatedBy, type LocalDependencies } from './dependencies'
import { asResult, fail, failValidation, parseInput, parsedRow } from './failure'
import { requireLinked, resolveSession } from './session'
import { POLICY_TABLES, requireAccessManager } from './snapshot'
import { SOLDIER_CREATE_TABLES, insertSoldier } from './soldiers'

// Accounts: the soldier's own preferences (D-041, D-121) and account linking (D-005, D-030, D-066, D-156).
// The requester is the identity, never an input (D-008). The answer to a request never says whether a soldier
// matched; candidates reach reviewers only, and only those the reviewer may link.

const PREFERENCE_TABLES: readonly TableName[] = ['soldier_accounts', 'soldier_preferences']

const LINK_TABLES: readonly TableName[] = [
  ...new Set<TableName>([...SOLDIER_CREATE_TABLES, ...POLICY_TABLES, 'soldier_private', 'account_link_requests']),
]

const ACCOUNTS_VIEW = { resource: 'accounts', action: 'view' } as const
const SOLDIERS_CREATE = { resource: 'soldiers', action: 'create' } as const
const MEMBERSHIPS_UPDATE = { resource: 'memberships', action: 'update' } as const
const SOLDIERS_VIEW = { resource: 'soldiers', action: 'view' } as const
const PRIVATE_UPDATE = { resource: 'soldier_private', action: 'update' } as const

function requireIdentity(identity: AuthIdentity | null): AuthIdentity {
  return identity ?? fail({ code: 'unauthenticated' })
}

/** What candidate matching reads, for one organization. */
async function loadMatchData(database: Dexie, organizationId: OrganizationId): Promise<LinkMatchData> {
  const rowsOf = <T extends 'soldiers' | 'soldier_private' | 'soldier_accounts'>(table: T) =>
    tableOf(database, table).where('organization_id').equals(organizationId).toArray()
  const [soldiers, soldier_private, soldier_accounts] = await Promise.all([
    rowsOf('soldiers'),
    rowsOf('soldier_private'),
    rowsOf('soldier_accounts'),
  ])
  return { soldiers, soldier_private, soldier_accounts }
}

/** The identity's account in the organization that is not revoked, if any (`uq_soldier_accounts_auth_user`). */
async function liveAccountOf(database: Dexie, organizationId: OrganizationId, authUserId: string) {
  const rows = await tableOf(database, 'soldier_accounts').where('auth_user_id').equals(authUserId).toArray()
  return rows.find((row) => row.organization_id === organizationId && row.revoked_at === null)
}

/** Candidates of a pending request; a resolved request has none. */
function candidatesOf(request: AccountLinkRequest, data: LinkMatchData): LinkCandidate[] {
  return request.status === AccountLinkRequestStatus.enum.pending ? linkCandidates(request, data) : []
}

/**
 * Who sees a request: whoever may review it (D-066), and whoever may link the soldier it was resolved to, so a
 * reviewer keeps sight of what they approved.
 */
function canSeeRequest(scope: ActorScope, request: AccountLinkRequest, data: LinkMatchData): boolean {
  const reviewable = canReviewLinkRequest(scope.context, scope.soldier_id, candidatesOf(request, data))
  const resolved = request.resolved_soldier_id
  return reviewable || (resolved !== null && canLinkSoldier(scope.context, scope.soldier_id, resolved))
}

async function visibleRequest(
  database: Dexie,
  scope: ActorScope,
  id: AccountLinkRequest['id'],
): Promise<{ request: AccountLinkRequest; data: LinkMatchData }> {
  const stored = await tableOf(database, 'account_link_requests').get(id)
  if (stored === undefined || stored.organization_id !== scope.organization_id) return fail({ code: 'not_found' })
  const request = parsedRow('account_link_requests', stored)
  const data = await loadMatchData(database, scope.organization_id)
  if (!canSeeRequest(scope, request, data)) return fail({ code: 'not_found' })
  return { request, data }
}

/** The claimed personal id as stored (D-066): normalized, and NULL when nothing is left. */
function storedPersonalId(value: string | null): string | null {
  return value === null ? null : normalizePersonalId(value)
}

/** True when no soldier but `soldierId` holds the personal id (`uq_soldier_private_personal_id`). */
async function personalIdFree(
  database: Dexie,
  organizationId: OrganizationId,
  personalId: string,
  soldierId: SoldierId,
): Promise<boolean> {
  const holder = await tableOf(database, 'soldier_private')
    .where('[organization_id+personal_id]')
    .equals([organizationId, personalId])
    .first()
  return holder === undefined || holder.soldier_id === soldierId
}

// --------------------------------------------------------------------- reads

export function createSoldierPreferencesRepository({
  database,
  identity,
}: LocalDependencies): DataRepositories['soldier_preferences'] {
  return {
    mine: () =>
      asResult(() =>
        database.transaction('r', PREFERENCE_TABLES, async () => {
          const actor = requireLinked(await resolveSession(database, identity.current()))
          const stored = await tableOf(database, 'soldier_preferences').get(actor.soldier_id)
          return stored === undefined ? null : parsedRow('soldier_preferences', stored)
        }),
      ),
  }
}

/** Accounts, with `accounts:view` over their soldier (D-156). */
export function createSoldierAccountRepository(dependencies: LocalDependencies): DataRepositories['soldier_accounts'] {
  const { database } = dependencies
  return {
    get: (id) =>
      asResult(() =>
        database.transaction('r', POLICY_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const stored = await tableOf(database, 'soldier_accounts').get(id)
          const visible =
            stored !== undefined &&
            stored.organization_id === scope.organization_id &&
            holds(scope, ACCOUNTS_VIEW, soldierTarget(stored.soldier_id))
          if (!visible) return fail({ code: 'not_found' })
          return parsedRow('soldier_accounts', stored)
        }),
      ),
    list: (raw) =>
      asResult(() => {
        const query = parseInput(SoldierScopedQuery, raw)
        return database.transaction('r', POLICY_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const rows = await tableOf(database, 'soldier_accounts').where('organization_id').equals(scope.organization_id).toArray()
          return rows
            .filter((row) => query.soldier_ids === null || query.soldier_ids.includes(row.soldier_id))
            .filter((row) => holds(scope, ACCOUNTS_VIEW, soldierTarget(row.soldier_id)))
            .sort((a, b) => a.linked_at.localeCompare(b.linked_at) || a.id.localeCompare(b.id))
            .map((row) => parsedRow('soldier_accounts', row))
        })
      }),
  }
}

/** Link requests, for their reviewers only (D-066); the requester reads their own through onboarding. */
export function createAccountLinkRequestRepository(
  dependencies: LocalDependencies,
): DataRepositories['account_link_requests'] {
  const { database } = dependencies
  return {
    get: (id) =>
      asResult(() =>
        database.transaction('r', LINK_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          return (await visibleRequest(database, scope, id)).request
        }),
      ),
    list: (raw) =>
      asResult(() => {
        const query = parseInput(AccountLinkRequestQuery, raw)
        return database.transaction('r', LINK_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const data = await loadMatchData(database, scope.organization_id)
          const rows = await tableOf(database, 'account_link_requests')
            .where('organization_id')
            .equals(scope.organization_id)
            .toArray()
          return rows
            .map((row) => parsedRow('account_link_requests', row))
            .filter((row) => query.statuses === null || query.statuses.includes(row.status))
            .filter((row) => canSeeRequest(scope, row, data))
            .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
        })
      }),
    // Only the candidates the reviewer may see and link: the others' existence is not theirs to learn (D-156, D-157).
    candidates: (id) =>
      asResult(() =>
        database.transaction('r', LINK_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const { request, data } = await visibleRequest(database, scope, id)
          return candidatesOf(request, data).filter(
            (candidate) =>
              holds(scope, SOLDIERS_VIEW, soldierTarget(candidate.soldier_id)) &&
              canLinkSoldier(scope.context, scope.soldier_id, candidate.soldier_id),
          )
        }),
      ),
  }
}

// ------------------------------------------------------------------ commands

export function createAccountCommands(dependencies: LocalDependencies): DataCommands['accounts'] {
  const { database, identity, time, changes } = dependencies

  /** A new account of `requester` on `soldierId`. */
  function accountRow(
    id: SoldierAccount['id'],
    organizationId: OrganizationId,
    requester: Pick<AccountLinkRequest, 'auth_user_id' | 'email'>,
    provider: AuthIdentity['provider'],
    soldierId: SoldierId,
    linkedBy: SoldierId | null,
  ): SoldierAccount {
    return parsedRow('soldier_accounts', {
      id,
      organization_id: organizationId,
      auth_user_id: requester.auth_user_id,
      soldier_id: soldierId,
      provider,
      email: requester.email,
      linked_at: time.now(),
      linked_by: linkedBy,
      revoked_at: null,
      revoked_by: null,
    })
  }

  async function requireNewAccountId(id: SoldierAccount['id'], path: readonly string[]): Promise<void> {
    if ((await tableOf(database, 'soldier_accounts').get(id)) !== undefined) {
      failValidation([{ path: [...path], code: IssueCode.enum.already_exists }])
    }
  }

  /** Fills the soldier's missing personal id from the request (D-030), when no other soldier holds it. */
  /** Fills a missing personal id from the request, when the reviewer may write private fields (D-157). */
  async function enrich(scope: ActorScope, request: AccountLinkRequest, soldierId: SoldierId): Promise<DataChange[]> {
    if (!holds(scope, PRIVATE_UPDATE, soldierTarget(soldierId))) return []
    const stored = await tableOf(database, 'soldier_private').get(soldierId)
    const fill = linkEnrichment(request, stored ?? null)
    if (fill === null || !(await personalIdFree(database, scope.organization_id, fill.personal_id, soldierId))) return []
    await tableOf(database, 'soldier_private').put(
      parsedRow('soldier_private', {
        soldier_id: soldierId,
        organization_id: scope.organization_id,
        invite_email: stored?.invite_email ?? null,
        phone: stored?.phone ?? null,
        personal_id: fill.personal_id,
        ...updatedBy(scope.soldier_id, scope.now, stored?.version ?? 0),
      }),
    )
    return [{ table: 'soldier_private', ids: [soldierId] }]
  }

  return {
    updateMyPreferences: (raw) =>
      asResult(async () => {
        const input = parseInput(UpdateMyPreferencesInput, raw)
        const written = await database.transaction('rw', PREFERENCE_TABLES, async () => {
          const actor = requireLinked(await resolveSession(database, identity.current()))
          const stored = await tableOf(database, 'soldier_preferences').get(actor.soldier_id)
          // NULL creates the row; a number must be the stored version (D-121).
          if ((stored?.version ?? null) !== input.expected_version) return fail({ code: 'stale_version' })
          const row = parsedRow('soldier_preferences', {
            soldier_id: actor.soldier_id,
            organization_id: actor.organization_id,
            preferences: input.preferences,
            updated_at: time.now(),
            version: (stored?.version ?? 0) + 1,
          })
          await tableOf(database, 'soldier_preferences').put(row)
          return row
        })
        changes.publish([{ table: 'soldier_preferences', ids: [written.soldier_id] }])
        return written
      }),

    // The local adapter serves one organization, the one its owner bootstrapped (D-005, D-021).
    requestLink: (raw) =>
      asResult(async () => {
        const input = parseInput(RequestAccountLinkInput, raw)
        const result = await database.transaction('rw', LINK_TABLES, async () => {
          const requester = requireIdentity(identity.current())
          if ((await resolveSession(database, requester)).status === 'linked') {
            return failValidation([{ path: [], code: IssueCode.enum.already_linked }])
          }
          const organization = await tableOf(database, 'organizations').toCollection().first()
          if (organization === undefined) return fail({ code: 'not_found' })
          const requests = tableOf(database, 'account_link_requests')
          const own = await requests.where('auth_user_id').equals(requester.auth_user_id).toArray()
          const open = own.some(
            (row) => row.organization_id === organization.id && row.status === AccountLinkRequestStatus.enum.pending,
          )
          if (open) return failValidation([{ path: [], code: IssueCode.enum.already_exists }])
          if ((await requests.get(input.id)) !== undefined) {
            return failValidation([{ path: ['id'], code: IssueCode.enum.already_exists }])
          }

          const claimedPersonalId = storedPersonalId(input.claimed_personal_id)
          const data = await loadMatchData(database, organization.id)
          const soldierId = requester.email_verified
            ? autoLinkSoldier({ personal_id: claimedPersonalId, verified_email: requester.email }, data)
            : null
          if (soldierId !== null) {
            await requireNewAccountId(input.account_id, ['account_id'])
            const account = accountRow(input.account_id, organization.id, requester, requester.provider, soldierId, null)
            await tableOf(database, 'soldier_accounts').add(account)
            return { outcome: 'linked' as const, change: { table: 'soldier_accounts' as const, ids: [account.id] } }
          }
          await requests.add(
            parsedRow('account_link_requests', {
              id: input.id,
              organization_id: organization.id,
              auth_user_id: requester.auth_user_id,
              email: requester.email,
              claimed_personal_id: claimedPersonalId,
              first_name: input.first_name,
              last_name: input.last_name,
              status: AccountLinkRequestStatus.enum.pending,
              resolved_soldier_id: null,
              reviewed_by: null,
              reviewed_at: null,
              created_at: time.now(),
            }),
          )
          return { outcome: 'pending_review' as const, change: { table: 'account_link_requests' as const, ids: [input.id] } }
        })
        changes.publish([result.change])
        return { outcome: result.outcome }
      }),

    cancelLinkRequest: (raw) =>
      asResult(async () => {
        const input = parseInput(CancelAccountLinkRequestInput, raw)
        const written = await database.transaction('rw', ['account_link_requests'], async () => {
          const requester = requireIdentity(identity.current())
          const stored = await tableOf(database, 'account_link_requests').get(input.id)
          if (stored === undefined || stored.auth_user_id !== requester.auth_user_id) return fail({ code: 'not_found' })
          const issues = linkRequestTransitionIssues(stored.status)
          if (issues.length > 0) return failValidation(issues)
          const row = parsedRow('account_link_requests', { ...stored, status: AccountLinkRequestStatus.enum.cancelled })
          await tableOf(database, 'account_link_requests').put(row)
          return row
        })
        changes.publish([{ table: 'account_link_requests', ids: [written.id] }])
        return written
      }),

    reviewLink: (raw) =>
      asResult(async () => {
        const input = parseInput(ReviewAccountLinkInput, raw)
        const written = await database.transaction('rw', LINK_TABLES, async () => {
          const reviewer = requireIdentity(identity.current())
          const scope = await loadActorScope(dependencies)
          const { request, data } = await visibleRequest(database, scope, input.id)
          const transition = linkRequestTransitionIssues(request.status)
          if (transition.length > 0) return failValidation(transition)

          const { resolution } = input
          const written: DataChange[] = [{ table: 'account_link_requests', ids: [request.id] }]
          let soldierId: SoldierId | null = null
          if (resolution.kind === 'link') {
            // Authority first, so the answer tells nothing of soldiers out of reach (D-157).
            if (!canLinkSoldier(scope.context, scope.soldier_id, resolution.soldier_id)) return fail({ code: 'forbidden' })
            const issues = linkTargetIssues(linkCandidates(request, data), resolution.soldier_id)
            if (issues.length > 0) return failValidation(issues)
            soldierId = resolution.soldier_id
            written.push(...(await enrich(scope, request, soldierId)))
          } else if (resolution.kind === 'create_soldier') {
            const placement = placementTarget(resolution.membership?.unit_id ?? null)
            // The new soldier lands where the reviewer may both create soldiers and approve accounts (D-157).
            requirePermission(scope, SOLDIERS_CREATE, placement)
            requirePermission(scope, ACCOUNT_REVIEW_PERMISSION, placement)
            if (resolution.membership !== null) {
              requirePermission(scope, MEMBERSHIPS_UPDATE, { kind: 'unit', unit_id: resolution.membership.unit_id })
            }
            const personalId = request.claimed_personal_id
            const fill =
              personalId !== null &&
              holds(scope, PRIVATE_UPDATE, placement) &&
              (await personalIdFree(database, scope.organization_id, personalId, resolution.soldier_id))
            const created = await insertSoldier(
              database,
              scope,
              {
                id: resolution.soldier_id,
                first_name: request.first_name,
                last_name: request.last_name,
                nickname: null,
                command_rank_id: resolution.command_rank_id,
                status: SoldierStatus.enum.active,
                properties: {},
                private: fill ? { personal_id: personalId, invite_email: null, phone: null } : null,
                membership: resolution.membership,
              },
              ['resolution'],
            )
            soldierId = created.soldier.id
            written.push(...created.changes)
          }

          if (soldierId !== null) {
            if ((await liveAccountOf(database, scope.organization_id, request.auth_user_id)) !== undefined) {
              return failValidation([{ path: [], code: IssueCode.enum.already_linked }])
            }
            const accountId = resolution.kind === 'reject' ? null : resolution.account_id
            if (accountId === null) return fail({ code: 'internal' })
            await requireNewAccountId(accountId, ['resolution', 'account_id'])
            // One identity provider per build (D-048): the reviewer's is the requester's.
            const account = accountRow(accountId, scope.organization_id, request, reviewer.provider, soldierId, scope.soldier_id)
            await tableOf(database, 'soldier_accounts').add(account)
            written.push({ table: 'soldier_accounts', ids: [account.id] })
          }

          const row = parsedRow('account_link_requests', {
            ...request,
            status: soldierId === null ? AccountLinkRequestStatus.enum.rejected : AccountLinkRequestStatus.enum.approved,
            resolved_soldier_id: soldierId,
            reviewed_by: scope.soldier_id,
            reviewed_at: scope.now,
          })
          await tableOf(database, 'account_link_requests').put(row)
          return { row, written }
        })
        changes.publish(written.written)
        return written.row
      }),

    revokeLink: (raw) =>
      asResult(async () => {
        const input = parseInput(RevokeAccountLinkInput, raw)
        const written = await database.transaction('rw', POLICY_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const stored = await tableOf(database, 'soldier_accounts').get(input.id)
          const visible =
            stored !== undefined &&
            stored.organization_id === scope.organization_id &&
            holds(scope, ACCOUNTS_VIEW, soldierTarget(stored.soldier_id))
          if (!visible) return fail({ code: 'not_found' })
          if (stored.revoked_at !== null) return failValidation([{ path: [], code: IssueCode.enum.invalid_transition }])
          if (!canRevokeAccount(scope.context, scope.soldier_id, stored.soldier_id)) return fail({ code: 'forbidden' })
          const row = parsedRow('soldier_accounts', { ...stored, revoked_at: scope.now, revoked_by: scope.soldier_id })
          await tableOf(database, 'soldier_accounts').put(row)
          // An unlinked soldier holds no permissions, so the last access manager stays (D-059).
          await requireAccessManager(database, scope.organization_id, scope.now)
          return row
        })
        changes.publish([{ table: 'soldier_accounts', ids: [written.id] }])
        return written
      }),
  }
}
