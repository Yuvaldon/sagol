import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// The public Data API (PostgREST) refuses the API roles every table (D-203): with a publishable
// key, which acts as `anon`, and with a signed-in session's token, which acts as `authenticated`.
// `npm run test:rest` runs it after `test:db`, against a PostgREST in front of the migrated database.

function required(name: string): string {
  const value = import.meta.env[name] as string | undefined
  if (value === undefined || value === '') throw new Error(`test:rest needs ${name}`)
  return value
}

const sql = postgres(required('DATABASE_URL'), { max: 1, onnotice: () => undefined })
const api = required('POSTGREST_URL')
const secret = required('POSTGREST_JWT_SECRET')

const INSUFFICIENT_PRIVILEGE = '42501'
const TABLE_NOT_IN_CACHE = 'PGRST205'
const RELOAD_TRIES = 50
const RELOAD_WAIT_MS = 200

const encoder = new TextEncoder()
const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
const encoded = (value: unknown) => base64url(encoder.encode(JSON.stringify(value)))

/** A token as Supabase signs one: the role decides what PostgREST runs the request as. */
async function token(claims: Record<string, unknown>): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  const head = `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded(claims)}`
  return `${head}.${base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(head))))}`
}

const exp = Math.floor(Date.now() / 1000) + 3600
const CALLERS = [
  { role: 'anon', bearer: await token({ role: 'anon', exp }) },
  { role: 'authenticated', bearer: await token({ role: 'authenticated', sub: crypto.randomUUID(), exp }) },
] as const

let tables: string[] = []

async function ask(path: string, bearer: string, init: RequestInit = {}) {
  const response = await fetch(new URL(path, api), {
    ...init,
    headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
  })
  const body = (await response.json().catch(() => null)) as { code?: unknown } | null
  return { status: response.status, code: String(body?.code) }
}

beforeAll(async () => {
  const rows = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  tables = rows.map((row) => String(row.tablename))
  // PostgREST read its schema before the migrations ran; it reloads on this notice.
  await sql`NOTIFY pgrst, 'reload schema'`
  for (let attempt = 0; attempt < RELOAD_TRIES; attempt += 1) {
    const { code } = await ask(`/${tables[0] ?? ''}`, CALLERS[0].bearer)
    if (code !== TABLE_NOT_IN_CACHE) return
    await new Promise((resolve) => setTimeout(resolve, RELOAD_WAIT_MS))
  }
  throw new Error('PostgREST did not load the migrated schema')
})

afterAll(async () => {
  await sql.end()
})

describe('the Data API (D-203)', () => {
  it('serves the migrated tables', () => {
    expect(tables.length).toBeGreaterThan(0)
  })

  it.each(CALLERS)('refuses $role a read, a write and a delete of every table', async ({ role, bearer }) => {
    const refused = role === 'anon' ? 401 : 403
    const denied = { status: refused, code: INSUFFICIENT_PRIVILEGE }
    for (const table of tables) {
      expect([table, await ask(`/${table}?select=*&limit=1`, bearer)]).toEqual([table, denied])
      expect([table, await ask(`/${table}`, bearer, { method: 'POST', body: '{}' })]).toEqual([table, denied])
      expect([table, await ask(`/${table}`, bearer, { method: 'DELETE' })]).toEqual([table, denied])
    }
  })
})
