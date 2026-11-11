import { REMOTE } from '@config'
import { AuthUserId, type AuthIdentity, type DataChange, type Unsubscribe } from '@contracts'
import { describe, expect, it } from 'vitest'
import { createRemoteDataAdapter } from './adapter'

// The transport of the remote adapter (D-204). The contract suite runs it end to end against the
// gateway (`remote.contract.dbtest.ts`); this file covers what the gateway never answers.

const BACKEND = 'https://backend.test'
const KEY = 'publishable-test-key'

interface Sent {
  readonly url: string
  readonly headers: Headers
  readonly body: unknown
}

let channels = 0
const nextChannel = () => {
  channels += 1
  return `remote-test-${String(channels)}`
}

function adapterWith(answer: (sent: Sent) => Promise<Response>, token: string | null = 'token-1') {
  const sent: Sent[] = []
  const adapter = createRemoteDataAdapter(
    {
      url: BACKEND,
      apiKey: KEY,
      identity: { current: () => null, subscribe: (): Unsubscribe => () => undefined },
      accessToken: () => Promise.resolve(token),
      fetch: async (input, init) => {
        const request = new Request(input, init)
        const call = { url: request.url, headers: request.headers, body: (await request.json()) as unknown }
        sent.push(call)
        return answer(call)
      },
    },
    nextChannel(),
  )
  return { adapter, sent }
}

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))

const currentOrganization = (answer: () => Promise<Response>) =>
  adapterWith(answer).adapter.repositories.organizations.current()

describe('remote adapter transport (D-204)', () => {
  it('posts the call to the gateway with the key and the bearer token', async () => {
    const { adapter, sent } = adapterWith(() => json({ result: { ok: true, value: [] }, changes: [] }))
    expect(await adapter.repositories.units.list({ include_archived: false })).toEqual({ ok: true, value: [] })
    expect(sent).toHaveLength(1)
    expect(sent[0]?.url).toBe(new URL(REMOTE.commandsPath, BACKEND).href)
    expect(sent[0]?.headers.get('apikey')).toBe(KEY)
    expect(sent[0]?.headers.get('authorization')).toBe('Bearer token-1')
    expect(sent[0]?.body).toEqual({
      kind: 'repositories',
      group: 'units',
      method: 'list',
      args: [{ include_archived: false }],
    })
  })

  it('sends no authorization header when no one is signed in', async () => {
    const signedOut = { result: { ok: true, value: { status: 'signed_out' } }, changes: [] }
    const { adapter, sent } = adapterWith(() => json(signedOut), null)
    expect(await adapter.session.current()).toEqual({ ok: true, value: { status: 'signed_out' } })
    expect(sent[0]?.headers.has('authorization')).toBe(false)
    expect(sent[0]?.body).toEqual({ kind: 'session', group: 'session', method: 'current', args: [] })
  })

  it('answers a refused token as unauthenticated, and a failure to answer as unavailable', async () => {
    expect(await currentOrganization(() => json(null, 401))).toEqual({ ok: false, error: { code: 'unauthenticated' } })
    expect(await currentOrganization(() => json(null, 503))).toEqual({ ok: false, error: { code: 'unavailable' } })
    expect(await currentOrganization(() => Promise.reject(new TypeError('offline')))).toEqual({
      ok: false,
      error: { code: 'unavailable' },
    })
    expect(await currentOrganization(() => Promise.resolve(new Response('not json')))).toEqual({
      ok: false,
      error: { code: 'unavailable' },
    })
  })

  it('refuses a rejected request and an answer of the wrong shape as internal', async () => {
    expect(await currentOrganization(() => json(null, 400))).toEqual({ ok: false, error: { code: 'internal' } })
    const nonsense = { result: { ok: false, error: { code: 'nonsense' } }, changes: [] }
    expect(await currentOrganization(() => json(nonsense))).toEqual({ ok: false, error: { code: 'internal' } })
  })

  it('publishes what the answer changed to the change feed', async () => {
    const changes: DataChange[] = [{ table: 'units', ids: ['u-1'] }]
    const { adapter } = adapterWith(() => json({ result: { ok: true, value: {} }, changes }))
    const heard = new Promise<readonly DataChange[]>((resolve) => {
      const stop = adapter.changes.subscribe((rows) => {
        stop()
        resolve(rows)
      })
    })
    await adapter.commands.units.archive({ id: 'u-1', expected_version: 1 } as never)
    expect(await heard).toEqual(changes)
  })

  it('reads the session again when the identity changes', async () => {
    const identity: AuthIdentity = {
      auth_user_id: AuthUserId.parse(crypto.randomUUID()),
      provider: 'google',
      email: 'dana@example.com',
      email_verified: true,
      display_name: null,
    }
    const listeners = new Set<(identity: AuthIdentity | null) => void>()
    const unlinked = { result: { ok: true, value: { status: 'unlinked', identity } }, changes: [] }
    const adapter = createRemoteDataAdapter(
      {
        url: BACKEND,
        apiKey: KEY,
        identity: {
          current: () => identity,
          subscribe(listener) {
            listeners.add(listener)
            return () => listeners.delete(listener)
          },
        },
        accessToken: () => Promise.resolve('token-1'),
        fetch: () => json(unlinked),
      },
      nextChannel(),
    )
    const session = new Promise((resolve) => adapter.session.subscribe(resolve))
    for (const listener of [...listeners]) listener(identity)
    expect(await session).toEqual({ status: 'unlinked', identity })
  })
})
