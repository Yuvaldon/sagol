import { REMOTE } from '@config'
import type { AuthIdentity } from '@contracts'
import { describe, expect, it, vi } from 'vitest'
import type { GatewayResponse } from './gateway'
import { createCommandHandler } from './http'
import { AuthServerUnavailable } from './supabaseIdentity'

const APP = 'https://app.example'
const identity = {
  auth_user_id: '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d',
  provider: 'google',
  email: 'dana@example.com',
  email_verified: true,
  display_name: null,
} as AuthIdentity
const answer: GatewayResponse = { result: { ok: true, value: 1 }, changes: [] }

function setup(verify: (token: string) => Promise<AuthIdentity | null> = async () => identity) {
  const gateway = vi.fn(async (): Promise<GatewayResponse> => answer)
  const log = vi.fn()
  return { gateway, log, serve: createCommandHandler({ gateway, verify, origins: [APP], log }) }
}

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request('https://functions.example/commands', { method: 'POST', body, headers: { origin: APP, ...headers } })

describe('createCommandHandler', () => {
  it('runs a call as the identity of the token, with CORS for the app', async () => {
    const { gateway, serve } = setup()
    const response = await serve(post('{"kind":"session"}', { authorization: 'Bearer abc' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(answer)
    expect(gateway).toHaveBeenCalledWith(identity, { kind: 'session' }, null)
    expect(response.headers.get('access-control-allow-origin')).toBe(APP)
  })

  it('runs a call without a token signed out, and hands an unreadable body on as such', async () => {
    const { gateway, serve } = setup()
    await serve(post('not json'))
    expect(gateway).toHaveBeenCalledWith(null, undefined, null)
  })

  it("hands on the adapter's origin id for the live announcement, and drops a malformed one (D-347)", async () => {
    const { gateway, serve } = setup()
    const origin = crypto.randomUUID()
    await serve(post('{}', { [REMOTE.originHeader]: origin }))
    expect(gateway).toHaveBeenLastCalledWith(null, {}, origin)
    await serve(post('{}', { [REMOTE.originHeader]: 'not-a-uuid' }))
    expect(gateway).toHaveBeenLastCalledWith(null, {}, null)
    const preflight = await serve(new Request('https://functions.example/commands', { method: 'OPTIONS', headers: { origin: APP } }))
    expect(preflight.headers.get('access-control-allow-headers')).toContain(REMOTE.originHeader)
  })

  it('refuses a token that names no one, a malformed header, and an unreachable auth server', async () => {
    const refused = setup(async () => null)
    expect((await refused.serve(post('{}', { authorization: 'Bearer abc' }))).status).toBe(401)
    expect((await refused.serve(post('{}', { authorization: 'Basic abc' }))).status).toBe(401)
    expect(refused.gateway).not.toHaveBeenCalled()
    const down = setup(async () => {
      throw new AuthServerUnavailable()
    })
    expect((await down.serve(post('{}', { authorization: 'Bearer abc' }))).status).toBe(503)
  })

  it('answers a preflight, refuses other methods, and gives other origins no CORS headers', async () => {
    const { serve } = setup()
    const preflight = await serve(new Request('https://functions.example/commands', { method: 'OPTIONS', headers: { origin: APP } }))
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-headers')).toContain('authorization')
    expect((await serve(new Request('https://functions.example/commands', { method: 'GET' }))).status).toBe(405)
    const foreign = await serve(post('{}', { origin: 'https://evil.example' }))
    expect(foreign.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('admits a preview origin by pattern, inside one DNS label only (D-209)', async () => {
    const serve = createCommandHandler({
      gateway: vi.fn(),
      verify: () => Promise.resolve(null),
      origins: ['https://sagol-*-team.vercel.app'],
      log: vi.fn(),
    })
    const corsOf = async (origin: string) =>
      (await serve(new Request('https://functions.example/commands', { method: 'OPTIONS', headers: { origin } }))).headers.get('access-control-allow-origin')
    expect(await corsOf('https://sagol-git-8-4-team.vercel.app')).toBe('https://sagol-git-8-4-team.vercel.app')
    expect(await corsOf('https://sagol--team.vercel.app')).toBeNull()
    expect(await corsOf('https://sagol-x.evil.example-team.vercel.app')).toBeNull()
    expect(await corsOf('https://sagol-a-team.vercel.app.evil.example')).toBeNull()
    expect(await corsOf('https://sagolX-a-teamXvercel.app')).toBeNull()
  })

  it('logs each call by name and answer code, with no argument or caller (D-335)', async () => {
    const { gateway, log, serve } = setup()
    gateway.mockResolvedValueOnce({ result: { ok: false, error: { code: 'forbidden' } }, changes: [] })
    const call = { kind: 'repositories', group: 'units', method: 'list', args: [{ include_archived: false }] }
    await serve(post(JSON.stringify(call), { authorization: 'Bearer abc' }))
    await serve(post('not json'))
    expect(log.mock.calls).toEqual([
      [JSON.stringify({ call: 'repositories.units.list', code: 'forbidden' })],
      [JSON.stringify({ call: null, code: 'ok' })],
    ])
  })

  it('logs the table and issue paths of a row the contracts rejected, and never sends them (D-346)', async () => {
    const { gateway, log, serve } = setup()
    const rejection = { table: 'units', paths: ['id', 'name'] } as const
    gateway.mockResolvedValueOnce({ result: { ok: false, error: { code: 'internal' } }, changes: [], rejection })
    const call = { kind: 'repositories', group: 'units', method: 'list', args: [] }
    const response = await serve(post(JSON.stringify(call)))
    expect(await response.json()).toEqual({ result: { ok: false, error: { code: 'internal' } }, changes: [] })
    expect(log.mock.calls).toEqual([
      [JSON.stringify({ call: 'repositories.units.list', code: 'internal', table: 'units', paths: ['id', 'name'] })],
    ])
  })

  it('refuses an oversized body before parsing it', async () => {
    const { gateway, serve } = setup()
    expect((await serve(post('x'.repeat(1_000_001)))).status).toBe(413)
    expect(gateway).not.toHaveBeenCalled()
  })
})
