import type { AuthIdentity } from '@contracts'
import { REMOTE } from '@config'
import { GatewayRequest, type GatewayResponse } from './gateway'
import { LiveOrigin } from './live'
import { AuthServerUnavailable } from './supabaseIdentity'

// The gateway over HTTP (D-201): one POST per adapter call. The caller's identity comes from the
// bearer token alone; a request without one runs signed out, and a token that names no one is
// refused outright, so a stale session never acts as anyone. Browsers reach it cross-origin, so
// only the app's own origins get CORS headers.

export interface CommandHandlerDependencies {
  readonly gateway: (identity: AuthIdentity | null, body: unknown, origin: string | null) => Promise<GatewayResponse>
  readonly verify: (token: string) => Promise<AuthIdentity | null>
  /**
   * Origins of the app's deployments (environment), e.g. `https://sagol.vercel.app`. An entry may
   * hold `*`, which stands for one or more of `a-z`, `0-9` and `-`, for preview deployments (D-209).
   */
  readonly origins: readonly string[]
  /** Where each call's line goes: the function's log (D-335). */
  readonly log: (line: string) => void
}

/** One origin entry as a matcher: literal text, with each `*` matching inside one DNS label only. */
function originMatcher(entry: string): (origin: string) => boolean {
  if (!entry.includes('*')) return (origin) => origin === entry
  const escaped = entry.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`^${escaped.join('[a-z0-9-]+')}$`)
  return (origin) => pattern.test(origin)
}

/** A request body above this many characters is refused before parsing (four arguments fit well under it). */
const MAX_BODY = 1_000_000
const ALLOWED_HEADERS = `authorization, content-type, apikey, x-client-info, ${REMOTE.originHeader}`

/**
 * A call's log line (D-335): which method was called and what it answered, never its arguments or caller. When a
 * stored row failed the contracts, also its table and the issue paths, never the values (D-346).
 */
function callLine(body: unknown, { result, rejection }: GatewayResponse): string {
  const request = GatewayRequest.safeParse(body)
  const call = request.success ? `${request.data.kind}.${request.data.group}.${request.data.method}` : null
  const code = result.ok ? 'ok' : result.error.code
  return JSON.stringify(rejection === undefined ? { call, code } : { call, code, table: rejection.table, paths: rejection.paths })
}

export function createCommandHandler({ gateway, verify, origins, log }: CommandHandlerDependencies) {
  const matchers = origins.map(originMatcher)
  return async function serve(request: Request): Promise<Response> {
    const origin = request.headers.get('origin')
    const cors: Record<string, string> =
      origin !== null && matchers.some((matches) => matches(origin))
        ? {
            'access-control-allow-origin': origin,
            'access-control-allow-methods': 'POST, OPTIONS',
            'access-control-allow-headers': ALLOWED_HEADERS,
            vary: 'Origin',
          }
        : { vary: 'Origin' }
    const reply = (status: number, body?: unknown) =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: body === undefined ? cors : { ...cors, 'content-type': 'application/json' },
      })

    if (request.method === 'OPTIONS') return reply(204)
    if (request.method !== 'POST') return reply(405)

    let identity: AuthIdentity | null = null
    const authorization = request.headers.get('authorization')
    if (authorization !== null) {
      const token = /^Bearer (\S+)$/.exec(authorization)?.[1]
      if (token === undefined) return reply(401)
      try {
        identity = await verify(token)
      } catch (error) {
        if (error instanceof AuthServerUnavailable) return reply(503)
        throw error
      }
      if (identity === null) return reply(401)
    }

    const text = await request.text()
    if (text.length > MAX_BODY) return reply(413)
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      body = undefined
    }
    // The adapter's origin id only labels the call's announcement (D-347); a malformed one is dropped, not refused.
    const writer = LiveOrigin.safeParse(request.headers.get(REMOTE.originHeader))
    const answer = await gateway(identity, body, writer.success ? writer.data : null)
    log(callLine(body, answer))
    return reply(200, { result: answer.result, changes: answer.changes })
  }
}
