import type { Store } from './store'
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
  type AccountLinkOutcome,
  type AccountLinkRequest,
  type AccountLinkRequestId,
  type AuthIdentity,
  type DataChange,
  type DataCommands,
  type DataRepositories,
  type LinkCandidate,
  type OrganizationId,
  type SoldierId,
  type TableName,
  type TableRow,
} from '@contracts'
import {
  ACCOUNT_REVIEW_PERMISSION,
  autoLinkSoldier,
  canReviewLinkRequest,
  linkCandidates,
  linkEnrichment,
  linkRequestTransitionIssues,
  normalizePersonalId,
  placementTarget,
  reviewableCandidates,
  soldierTarget,
  type LinkMatchData,
} from '@domain'
import { holds, loadActorScope, requirePermission, type ActorScope } from './actor'
import { tableOf } from './store'
import { updatedBy, type LocalDependencies } from './dependencies'
import { asResult, fail, failValidation, parseInput, parsedRow } from './failure'
import { deleteSubscriptionsOf } from './notifications'
import { permissionOf } from './reference'
import { requireLinked, resolveSession } from './session'
import { POLICY_TABLES, requireAccessManager } from './snapshot'
import { MEMBERSHIPS_UPDATE, ROSTER_TABLES, insertSoldier, personalIdIssues } from './soldiers'

// Account linking (D-005, D-030, D-066, D-148, D-149) and the signed-in soldier's own preferences (D-041, D-121).
// A request is asked by an identity that has no account, so asking and withdrawing read the identity and no
// session; reviewing is a linked soldier's command, and the actor is never an input (D-008).

const PREFERENCE_TABLES: readonly TableName[] = ['soldier_accounts', 'soldier_preferences']

/** What the link commands read and write: the policy, the roster a new soldier joins, and the requests. */
const LINK_TABLES: readonly TableName[] = [
  ...new Set<TableName>([...ROSTER_TABLES, 'organizations', 'soldier_accounts', 'account_link_requests']),
]

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

// ------------------------------------------------------------------- the requests

/** What matching reads: the organization's soldiers, their private rows and every account row (D-066). */
async function matchDataOf(database: Store, organizationId: OrganizationId): Promise<LinkMatchData> {
  const [soldiers, soldier_private, soldier_accounts] = await Promise.all([
    tableOf(database, 'soldiers').where('organization_id').equals(organizationId).toArray(),
    tableOf(database, 'soldier_private').where('organization_id').equals(organizationId).toArray(),
    tableOf(database, 'soldier_accounts').where('organization_id').equals(organizationId).toArray(),
  ])
  return { soldiers, soldier_private, soldier_accounts }
}

interface ReadableRequest {
  readonly request: AccountLinkRequest
  /** Only the candidates the reviewer holds `accounts:approve` over (D-149). */
  readonly candidates: LinkCandidate[]
}

/** The request as the actor may read it, or NULL: not theirs to review answers as if it did not exist (D-046). */
function readableRequest(
  scope: ActorScope,
  data: LinkMatchData,
  stored: TableRow<'account_link_requests'> | undefined,
): ReadableRequest | null {
  if (stored === undefined || stored.organization_id !== scope.organization_id) return null
  const request = parsedRow('account_link_requests', stored)
  const candidates = linkCandidates(request, data)
  if (!canReviewLinkRequest(scope.context, scope.soldier_id, candidates)) return null
  return { request, candidates: reviewableCandidates(scope.context, scope.soldier_id, candidates) }
}

export function createAccountLinkRequestRepository(
  dependencies: LocalDependencies,
): DataRepositories['account_link_requests'] {
  const { database } = dependencies

  async function readOne(id: AccountLinkRequestId): Promise<ReadableRequest> {
    const scope = await loadActorScope(dependencies)
    const data = await matchDataOf(database, scope.organization_id)
    const found = readableRequest(scope, data, await tableOf(database, 'account_link_requests').get(id))
    return found ?? fail({ code: 'not_found' })
  }

  return {
    get: (id) => asResult(() => database.transaction('r', LINK_TABLES, async () => (await readOne(id)).request)),

    candidates: (id) => asResult(() => database.transaction('r', LINK_TABLES, async () => (await readOne(id)).candidates)),

    list: (raw) =>
      asResult(() => {
        const query = parseInput(AccountLinkRequestQuery, raw)
        return database.transaction('r', LINK_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const data = await matchDataOf(database, scope.organization_id)
          const rows = await tableOf(database, 'account_link_requests')
            .where('organization_id')
            .equals(scope.organization_id)
            .toArray()
          return rows
            .filter((row) => query.statuses === null || query.statuses.includes(row.status))
            .flatMap((row) => readableRequest(scope, data, row)?.request ?? [])
            .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
        })
      }),
  }
}

/** A link is read with `accounts:view` on its soldier (D-163). */
function accountVisible(scope: ActorScope, row: TableRow<'soldier_accounts'>): boolean {
  return row.organization_id === scope.organization_id && holds(scope, ACCOUNT_VIEW, soldierTarget(row.soldier_id))
}

const ACCOUNT_VIEW = { resource: 'accounts', action: 'view' } as const

export function createSoldierAccountRepository(dependencies: LocalDependencies): DataRepositories['soldier_accounts'] {
  const { database } = dependencies
  return {
    get: (id) =>
      asResult(() =>
        database.transaction('r', POLICY_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const stored = await tableOf(database, 'soldier_accounts').get(id)
          if (stored === undefined || !accountVisible(scope, stored)) return fail({ code: 'not_found' })
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
            .filter((row) => accountVisible(scope, row))
            .sort((a, b) => a.linked_at.localeCompare(b.linked_at) || a.id.localeCompare(b.id))
            .map((row) => parsedRow('soldier_accounts', row))
        })
      }),
  }
}

// --------------------------------------------------------------------- commands

/** What the local adapter builds of `commands.accounts`. */
export type LocalAccountCommands = DataCommands['accounts']

function alreadyExists(path: readonly string[]): never {
  return failValidation([{ path: [...path], code: IssueCode.enum.already_exists }])
}

function requireIdentity({ identity }: LocalDependencies): AuthIdentity {
  return identity.current() ?? fail({ code: 'unauthenticated' })
}

/** The identity's live link: links are unique among those not revoked (D-163). */
async function holdsLiveLink(database: Store, organizationId: OrganizationId, authUserId: AuthIdentity['auth_user_id']) {
  const rows = await tableOf(database, 'soldier_accounts').where('auth_user_id').equals(authUserId).toArray()
  return rows.some((row) => row.organization_id === organizationId && row.revoked_at === null)
}

/** The soldier's live link (D-163). */
async function soldierLinked(database: Store, soldierId: SoldierId) {
  const rows = await tableOf(database, 'soldier_accounts').where('soldier_id').equals(soldierId).toArray()
  return rows.some((row) => row.revoked_at === null)
}

function accountRow(
  { account_id, soldier_id }: { account_id: TableRow<'soldier_accounts'>['id']; soldier_id: SoldierId },
  request: Pick<AccountLinkRequest, 'organization_id' | 'auth_user_id' | 'email'>,
  provider: AuthIdentity['provider'],
  linkedAt: string,
  linkedBy: SoldierId | null,
) {
  return parsedRow('soldier_accounts', {
    id: account_id,
    organization_id: request.organization_id,
    auth_user_id: request.auth_user_id,
    soldier_id,
    provider,
    email: request.email,
    linked_at: linkedAt,
    linked_by: linkedBy,
    revoked_at: null,
    revoked_by: null,
  })
}

/** Approval fills a missing personal number of the soldier from the request; one another soldier holds is skipped (D-149). */
async function enrichSoldier(
  database: Store,
  scope: ActorScope,
  request: AccountLinkRequest,
  soldierId: SoldierId,
): Promise<boolean> {
  const stored = await tableOf(database, 'soldier_private').get(soldierId)
  const fill = linkEnrichment(request, stored ?? null)
  if (fill === null) return false
  if ((await personalIdIssues(database, scope, soldierId, fill.personal_id, [])).length > 0) return false
  await tableOf(database, 'soldier_private').put(
    parsedRow('soldier_private', {
      soldier_id: soldierId,
      organization_id: scope.organization_id,
      personal_id: fill.personal_id,
      invite_email: stored?.invite_email ?? null,
      phone: stored?.phone ?? null,
      ...updatedBy(scope.soldier_id, scope.now, stored?.version ?? 0),
    }),
  )
  return true
}

export function createAccountCommands(dependencies: LocalDependencies): LocalAccountCommands {
  const { database, time, changes } = dependencies

  return {
    updateMyPreferences: (raw) =>
      asResult(async () => {
        const input = parseInput(UpdateMyPreferencesInput, raw)
        const written = await database.transaction('rw', PREFERENCE_TABLES, async () => {
          const actor = requireLinked(await resolveSession(database, dependencies.identity.current()))
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

    // D-148: asked by an identity with no account. Both outcomes answer the same shape.
    requestLink: (raw) =>
      asResult(async () => {
        const identity = requireIdentity(dependencies)
        const input = parseInput(RequestAccountLinkInput, raw)
        const written = await database.transaction('rw', LINK_TABLES, async () => {
          const session = await resolveSession(database, identity)
          if (session.status === 'linked') return fail({ code: 'forbidden' })
          const [organization] = await tableOf(database, 'organizations').toArray()
          if (organization === undefined) return fail({ code: 'not_found' })

          const requests = tableOf(database, 'account_link_requests')
          const mine = await requests.where('auth_user_id').equals(identity.auth_user_id).toArray()
          if (mine.some((row) => row.status === AccountLinkRequestStatus.enum.pending)) return alreadyExists(['id'])
          if ((await requests.get(input.id)) !== undefined) return alreadyExists(['id'])
          if ((await tableOf(database, 'soldier_accounts').get(input.account_id)) !== undefined) {
            return alreadyExists(['account_id'])
          }
          // A revoked identity may ask again (D-163); a live link answered `forbidden` above.

          const claimedId = input.claimed_personal_id === null ? null : normalizePersonalId(input.claimed_personal_id)
          const data = await matchDataOf(database, organization.id)
          // Only an email the provider verified links without a person (D-005).
          const soldierId = identity.email_verified
            ? autoLinkSoldier({ personal_id: claimedId, verified_email: identity.email }, data)
            : null
          const now = time.now()
          const base = {
            id: input.id,
            organization_id: organization.id,
            auth_user_id: identity.auth_user_id,
            email: identity.email,
            claimed_personal_id: claimedId,
            first_name: input.first_name,
            last_name: input.last_name,
            created_at: now,
            reviewed_by: null,
          }
          if (soldierId === null) {
            const request = parsedRow('account_link_requests', {
              ...base,
              status: AccountLinkRequestStatus.enum.pending,
              resolved_soldier_id: null,
              reviewed_at: null,
            })
            await requests.add(request)
            return { outcome: 'pending_review' as AccountLinkOutcome, soldierId: null }
          }
          // The claim stays on record, approved by no one: the account's `linked_by` is NULL too (D-148).
          const request = parsedRow('account_link_requests', {
            ...base,
            status: AccountLinkRequestStatus.enum.approved,
            resolved_soldier_id: soldierId,
            reviewed_at: now,
          })
          await requests.add(request)
          await tableOf(database, 'soldier_accounts').add(
            accountRow({ account_id: input.account_id, soldier_id: soldierId }, request, identity.provider, now, null),
          )
          return { outcome: 'linked' as AccountLinkOutcome, soldierId }
        })
        changes.publish([
          { table: 'account_link_requests', ids: [input.id] },
          ...(written.soldierId === null ? [] : [{ table: 'soldier_accounts' as const, ids: [input.account_id] }]),
        ])
        return { outcome: written.outcome }
      }),

    // D-148: the requester withdraws their own pending request.
    cancelLinkRequest: (raw) =>
      asResult(async () => {
        const identity = requireIdentity(dependencies)
        const input = parseInput(CancelAccountLinkRequestInput, raw)
        const written = await database.transaction('rw', ['account_link_requests'], async () => {
          const requests = tableOf(database, 'account_link_requests')
          const stored = await requests.get(input.id)
          // Another identity's request does not exist for this one (D-046).
          if (stored === undefined || stored.auth_user_id !== identity.auth_user_id) return fail({ code: 'not_found' })
          const issues = linkRequestTransitionIssues(stored.status)
          if (issues.length > 0) return failValidation(issues)
          const row = parsedRow('account_link_requests', { ...stored, status: AccountLinkRequestStatus.enum.cancelled })
          await requests.put(row)
          return row
        })
        changes.publish([{ table: 'account_link_requests', ids: [written.id] }])
        return written
      }),

    // D-149: link to a candidate, create a soldier, or reject.
    reviewLink: (raw) =>
      asResult(async () => {
        const input = parseInput(ReviewAccountLinkInput, raw)
        // The provider of a build is the same for every identity of it, the reviewer's included (D-148).
        const provider = requireIdentity(dependencies).provider
        const result = await database.transaction('rw', LINK_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const data = await matchDataOf(database, scope.organization_id)
          const readable = readableRequest(scope, data, await tableOf(database, 'account_link_requests').get(input.id))
          if (readable === null) return fail({ code: 'not_found' })
          const { request } = readable
          const transition = linkRequestTransitionIssues(request.status)
          if (transition.length > 0) return failValidation(transition)

          const touched: DataChange[] = []
          const { resolution } = input
          let status: AccountLinkRequest['status'] = AccountLinkRequestStatus.enum.rejected
          let resolved: SoldierId | null = null

          // Who and what the reviewer may name is checked before any unique, so a refusal never tells whether a
          // soldier outside the reviewer's scope is linked (D-090, D-046).
          if (resolution.kind === 'link') {
            // Only a candidate the reviewer holds `accounts:approve` over may be named (OI-034).
            if (!readable.candidates.some((candidate) => candidate.soldier_id === resolution.soldier_id)) {
              return failValidation([{ path: ['resolution', 'soldier_id'], code: IssueCode.enum.reference_not_found }])
            }
          }
          if (resolution.kind === 'create_soldier') {
            const membership = resolution.membership
            const placement = placementTarget(membership?.unit_id ?? null)
            requirePermission(scope, permissionOf('soldiers', 'create'), placement)
            requirePermission(scope, ACCOUNT_REVIEW_PERMISSION, placement)
            if (membership !== null) requirePermission(scope, MEMBERSHIPS_UPDATE, { kind: 'unit', unit_id: membership.unit_id })
          }

          if (resolution.kind !== 'reject') {
            if (await holdsLiveLink(database, scope.organization_id, request.auth_user_id)) return alreadyExists(['id'])
            if (resolution.kind === 'link' && (await soldierLinked(database, resolution.soldier_id))) {
              return failValidation([{ path: ['resolution', 'soldier_id'], code: IssueCode.enum.already_linked }])
            }
            if ((await tableOf(database, 'soldier_accounts').get(resolution.account_id)) !== undefined) {
              return alreadyExists(['resolution', 'account_id'])
            }
            status = AccountLinkRequestStatus.enum.approved
            resolved = resolution.soldier_id
          }

          if (resolution.kind === 'link') {
            if (await enrichSoldier(database, scope, request, resolution.soldier_id)) {
              touched.push({ table: 'soldier_private', ids: [resolution.soldier_id] })
            }
          }

          if (resolution.kind === 'create_soldier') {
            const membership = resolution.membership
            // A number another soldier holds is skipped, not refused (D-149).
            const claimed = request.claimed_personal_id === null ? null : normalizePersonalId(request.claimed_personal_id)
            const taken = claimed === null || (await personalIdIssues(database, scope, resolution.soldier_id, claimed, [])).length > 0
            const created = await insertSoldier(
              database,
              scope,
              {
                content: {
                  id: resolution.soldier_id,
                  first_name: request.first_name,
                  last_name: request.last_name,
                  nickname: null,
                  command_rank_id: resolution.command_rank_id,
                  status: SoldierStatus.enum.active,
                  properties: {},
                },
                membership,
                private: taken ? null : { personal_id: claimed, invite_email: null, phone: null },
              },
              ['resolution'],
            )
            touched.push(
              { table: 'soldiers', ids: [created.soldier.id] },
              ...(membership === null ? [] : [{ table: 'unit_memberships' as const, ids: [membership.id] }]),
              ...(created.hasPrivate ? [{ table: 'soldier_private' as const, ids: [created.soldier.id] }] : []),
            )
          }

          if (resolution.kind !== 'reject' && resolved !== null) {
            await tableOf(database, 'soldier_accounts').add(
              accountRow({ account_id: resolution.account_id, soldier_id: resolved }, request, provider, scope.now, scope.soldier_id),
            )
            touched.push({ table: 'soldier_accounts', ids: [resolution.account_id] })
          }

          const row = parsedRow('account_link_requests', {
            ...request,
            status,
            resolved_soldier_id: resolved,
            reviewed_by: scope.soldier_id,
            reviewed_at: scope.now,
          })
          await tableOf(database, 'account_link_requests').put(row)
          return { row, touched: [{ table: 'account_link_requests' as const, ids: [row.id] }, ...touched] }
        })
        changes.publish(result.touched)
        return result.row
      }),

    // D-163: ends a link; the soldier and the identity can be linked again.
    revokeLink: (raw) =>
      asResult(async () => {
        const input = parseInput(RevokeAccountLinkInput, raw)
        const row = await database.transaction('rw', [...POLICY_TABLES, 'push_subscriptions'], async () => {
          const scope = await loadActorScope(dependencies)
          const accounts = tableOf(database, 'soldier_accounts')
          const stored = await accounts.get(input.id)
          // A link the actor may not read answers as if it did not exist (D-046).
          if (stored === undefined || !accountVisible(scope, stored)) return fail({ code: 'not_found' })
          requirePermission(scope, ACCOUNT_REVIEW_PERMISSION, soldierTarget(stored.soldier_id))
          if (stored.soldier_id === scope.soldier_id) return fail({ code: 'forbidden' })
          if (stored.revoked_at !== null) return failValidation([{ path: ['id'], code: IssueCode.enum.archived }])
          const revoked = parsedRow('soldier_accounts', { ...stored, revoked_at: scope.now, revoked_by: scope.soldier_id })
          await accounts.put(revoked)
          // The soldier's devices stop getting pushes with the link (D-349).
          await deleteSubscriptionsOf(database, stored.soldier_id)
          await requireAccessManager(database, scope.organization_id, scope.now)
          return revoked
        })
        changes.publish([{ table: 'soldier_accounts', ids: [row.id] }])
        return row
      }),
  }
}
