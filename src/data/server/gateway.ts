import { AuthIdentity, type DataChange, type Result, type TimeSource, type Unsubscribe } from '@contracts'
import { z } from 'zod'
import { createAdapterCore, type LocalDataAdapter } from '../local/core'
import { ownerEmailClaimant } from '../local/dependencies'
import { rowRejectionOf, type RowRejection } from '../local/failure'
import type { LocalChangeFeed } from '../local/changes'
import { announceChanges } from './live'
import { createPostgresStore, type SqlClient, type StoreCatalog } from './postgresStore'

// The command gateway (D-201): the one server function. A request names one adapter method and
// its arguments; the gateway runs the adapter's own code (validation, policy, state checks, write)
// over the request's Postgres transaction, as the identity the caller's verified token names. The
// caller never chooses the actor, and every check runs on the server, so no path skips one.

const GROUP_KINDS = ['session', 'transfer', 'repositories', 'commands'] as const

/**
 * The methods of the adapter's single services a client may call; the session's `subscribe` stays on the client,
 * over the change feed.
 */
const SERVICE_METHODS = {
  session: ['current', 'onboardingState', 'can'],
  transfer: ['importBatch', 'exportOrganization'],
} as const satisfies { readonly [K in 'session' | 'transfer']: readonly (keyof LocalDataAdapter[K])[] }

export const GatewayRequest = z.strictObject({
  kind: z.enum(GROUP_KINDS),
  group: z.string().regex(/^[a-z_]+$/),
  method: z.string().regex(/^[a-zA-Z]+$/),
  args: z.array(z.unknown()).max(4),
})
export type GatewayRequest = z.infer<typeof GatewayRequest>

/** What a call answers: the method's result, and what it changed, for the caller's change feed. */
export interface GatewayResponse {
  readonly result: Result<unknown>
  readonly changes: readonly DataChange[]
  /** For the server's log only, never sent (D-346): the stored row the contracts rejected, behind an `internal`. */
  readonly rejection?: RowRejection
}

/** Runs `work` in one SERIALIZABLE transaction; a throw rolls it back. */
export type Transact = <T>(work: (client: SqlClient) => Promise<T>) => Promise<T>

export interface GatewayDependencies {
  readonly transact: Transact
  readonly catalog: StoreCatalog
  readonly time: TimeSource
  /** The server secret `BOOTSTRAP_OWNER_EMAIL`: the one identity that may claim an empty organization (D-005). */
  readonly bootstrapOwnerEmail: string
  /**
   * Runs after a call that answered ok has committed, outside the retry loop, with who made it and what it changed
   * (D-352). The function hands it to `waitUntil`; it must not throw, and nothing it does reaches the answer.
   */
  readonly afterCommit?: (call: { readonly identity: AuthIdentity; readonly changes: readonly DataChange[] }) => void
}

/** Tries of one request that keeps losing serialization races before it answers `unavailable`. */
const MAX_TRIES = 4

class RetryRequest extends Error {}

function collectingFeed(): LocalChangeFeed & { collected: DataChange[] } {
  const collected: DataChange[] = []
  return {
    collected,
    publish(changes) {
      collected.push(...changes)
    },
    subscribe: (): Unsubscribe => () => undefined,
  }
}

type Method = (...args: unknown[]) => Promise<Result<unknown>>

function methodOf(adapter: LocalDataAdapter, request: GatewayRequest): Method | null {
  if (request.kind === 'session' || request.kind === 'transfer') {
    const methods: readonly string[] = SERVICE_METHODS[request.kind]
    if (request.group !== request.kind || !methods.includes(request.method)) return null
    const service = adapter[request.kind] as unknown as Record<string, unknown>
    return service[request.method] as Method
  }
  const groups: Record<string, unknown> = adapter[request.kind]
  if (!Object.hasOwn(groups, request.group)) return null
  const group = groups[request.group] as Record<string, unknown>
  if (!Object.hasOwn(group, request.method)) return null
  const method = group[request.method]
  return typeof method === 'function' ? (method as Method) : null
}

export function createCommandGateway({ transact, catalog, time, bootstrapOwnerEmail, afterCommit }: GatewayDependencies) {
  const claimant = ownerEmailClaimant(bootstrapOwnerEmail)
  /**
   * `identity` comes from the verified token, never from the request body. `origin` names the calling adapter
   * in the announcement of what the call changed (D-348), so that adapter can skip its own write.
   */
  return async function handle(identity: AuthIdentity | null, body: unknown, origin: string | null = null): Promise<GatewayResponse> {
    const request = GatewayRequest.safeParse(body)
    if (!request.success) {
      return { result: { ok: false, error: { code: 'validation_failed', issues: [{ path: [], code: 'invalid_type' }] } }, changes: [] }
    }
    const verified = identity === null ? null : AuthIdentity.safeParse(identity)
    if (verified !== null && !verified.success) return { result: { ok: false, error: { code: 'internal' } }, changes: [] }
    const actor = verified === null ? null : verified.data
    const source = { current: () => actor, subscribe: (): Unsubscribe => () => undefined }
    for (let attempt = 1; attempt <= MAX_TRIES; attempt += 1) {
      let response: GatewayResponse
      try {
        response = await transact(async (client): Promise<GatewayResponse> => {
          const store = createPostgresStore(client, catalog)
          const changes = collectingFeed()
          const adapter = createAdapterCore({ database: store, identity: source, time, changes, claimant })
          const method = methodOf(adapter, request.data)
          if (method === null) return { result: { ok: false, error: { code: 'not_found' } }, changes: [] }
          const result = await method(...request.data.args)
          // The method answered `unavailable` for a lost race: run the whole request again.
          if (store.mustRetry()) throw new RetryRequest()
          if (!result.ok) {
            const rejection = rowRejectionOf(result.error)
            return rejection === undefined ? { result, changes: [] } : { result, changes: [], rejection }
          }
          await announceChanges(client, store.writtenOrganizations(), changes.collected, origin)
          return { result, changes: changes.collected }
        })
      } catch (error) {
        if (!(error instanceof RetryRequest) && !isSerializationFailure(error)) {
          return { result: { ok: false, error: { code: 'unavailable' } }, changes: [] }
        }
        continue
      }
      // Committed: a push about it never delays or changes the answer (D-352).
      if (afterCommit !== undefined && actor !== null && response.result.ok && response.changes.length > 0) {
        try {
          afterCommit({ identity: actor, changes: response.changes })
        } catch {
          // Best effort only.
        }
      }
      return response
    }
    return { result: { ok: false, error: { code: 'unavailable' } }, changes: [] }
  }
}

function isSerializationFailure(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  return code === '40001' || code === '40P01'
}
