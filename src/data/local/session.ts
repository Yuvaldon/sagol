import type Dexie from 'dexie'
import type {
  AuthIdentity,
  ChangeFeed,
  IdentitySource,
  OnboardingState,
  OrganizationId,
  Session,
  SessionService,
  SoldierId,
} from '@contracts'
import { compareInstants } from '@domain'
import { tableOf } from './database'
import { asResult, fail, parsedRow } from './failure'

// The session is derived from the identity on every call, never accepted from a caller (D-008).

const ACCOUNT_TABLES = ['organizations', 'soldier_accounts', 'account_link_requests'] as const

export async function resolveSession(database: Dexie, identity: AuthIdentity | null): Promise<Session> {
  if (identity === null) return { status: 'signed_out' }
  const accounts = await tableOf(database, 'soldier_accounts')
    .where('auth_user_id')
    .equals(identity.auth_user_id)
    .toArray()
  const account = accounts.find((row) => row.revoked_at === null)
  if (account === undefined) return { status: 'unlinked', identity }
  return {
    status: 'linked',
    identity,
    soldier_id: account.soldier_id,
    organization_id: account.organization_id,
  }
}

/** The actor of a read or command: `unauthenticated` or `account_not_linked` otherwise. */
export function requireLinked(session: Session): {
  soldier_id: SoldierId
  organization_id: OrganizationId
} {
  if (session.status === 'signed_out') return fail({ code: 'unauthenticated' })
  if (session.status === 'unlinked') return fail({ code: 'account_not_linked' })
  return session
}

/** Local bootstrap rule (D-005, D-006, D-086): a verified identity, no organization, no account. */
export async function bootstrapAllowed(database: Dexie, identity: AuthIdentity): Promise<boolean> {
  if (!identity.email_verified) return false
  const [organizations, accounts] = await Promise.all([
    tableOf(database, 'organizations').count(),
    tableOf(database, 'soldier_accounts').count(),
  ])
  return organizations === 0 && accounts === 0
}

export function createSessionService(
  database: Dexie,
  identity: IdentitySource,
  changes: ChangeFeed,
): SessionService {
  return {
    current: () => asResult(() => resolveSession(database, identity.current())),

    onboardingState: () =>
      asResult((): Promise<OnboardingState> => {
        const current = identity.current()
        if (current === null) return fail({ code: 'unauthenticated' })
        return database.transaction('r', ACCOUNT_TABLES, async () => {
          const session = await resolveSession(database, current)
          if (session.status === 'linked') return fail({ code: 'forbidden' })
          const requests = await tableOf(database, 'account_link_requests')
            .where('auth_user_id')
            .equals(current.auth_user_id)
            .toArray()
          const own = requests.map((row) => parsedRow('account_link_requests', row))
          const open = own.find((row) => row.status === 'pending') ?? null
          // The latest request alone answers (D-168): a rejection followed by a withdrawn request is not told.
          const latest = own.toSorted((a, b) => compareInstants(b.created_at, a.created_at) || b.id.localeCompare(a.id))[0]
          const rejected = open === null && latest?.status === 'rejected' ? latest : null
          return {
            bootstrap_available: await bootstrapAllowed(database, current),
            open_request: open,
            last_rejected_at: rejected === null ? null : (rejected.reviewed_at ?? rejected.created_at),
          }
        })
      }),

    subscribe(listener) {
      let latest = 0
      const emit = () => {
        latest += 1
        const mine = latest
        void asResult(() => resolveSession(database, identity.current())).then((result) => {
          if (mine === latest && result.ok) listener(result.value)
        })
      }
      const stopIdentity = identity.subscribe(emit)
      const stopChanges = changes.subscribe((rows) => {
        if (rows.some((change) => change.table === 'soldier_accounts')) emit()
      })
      return () => {
        latest += 1
        stopIdentity()
        stopChanges()
      }
    },
  }
}
