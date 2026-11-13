import { AuthUserId, TABLE_SCHEMAS, type AuthIdentity, type Unsubscribe } from '@contracts'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CONTRACT_NOW, CONTRACT_OWNER_EMAIL, bootstrapInput, describeAdapterContract, type ContractAdapter, type ContractHarness } from '../contract-tests/suite'
import { createRemoteDataAdapter } from './adapter'
import { createCommandGateway } from '../server/gateway'
import { createCommandHandler } from '../server/http'
import { CATALOG_QUERY, catalogOf, createPostgresStore, primaryKeyOf, type SqlClient, type StoreCatalog } from '../server/postgresStore'

// The remote adapter against the shared contract suite (D-201, D-204): every call goes through the
// adapter's HTTP transport into the function's own handler and gateway, over the migrated schema.
// It runs under `npm run test:db`, which rebuilds a local database from `supabase/migrations` first.

const url = import.meta.env.DATABASE_URL as string | undefined
if (url === undefined || url === '') throw new Error('test:db needs DATABASE_URL')

const sql = postgres(url, { max: 4, onnotice: () => undefined, connection: { TimeZone: 'UTC' } })
let catalog: StoreCatalog

function clientOf(connection: postgres.Sql | postgres.TransactionSql): SqlClient {
  return { query: (text, params) => connection.unsafe(text, params) }
}

beforeAll(async () => {
  catalog = catalogOf(await sql.unsafe(CATALOG_QUERY))
})

afterAll(async () => {
  await sql.end()
})

/** The fetch of a browser, answered in process by the function's own HTTP handler. */
function handlerFetch(): { fetch: typeof fetch; tokenOf(identity: AuthIdentity): string } {
  const tokens = new Map<string, AuthIdentity>()
  const serve = createCommandHandler({
    gateway: createCommandGateway({
      transact: (work) => sql.begin('isolation level serializable', (tx) => work(clientOf(tx))) as never,
      catalog,
      time: { now: () => CONTRACT_NOW },
      bootstrapOwnerEmail: CONTRACT_OWNER_EMAIL,
    }),
    verify: (token) => Promise.resolve(tokens.get(token) ?? null),
    origins: [],
    log: () => undefined,
  })
  return {
    fetch: (input, init) => serve(new Request(input, init)),
    tokenOf(identity) {
      const token = `token-${identity.auth_user_id}`
      tokens.set(token, identity)
      return token
    },
  }
}

let harnesses = 0

async function createHarness(): Promise<ContractHarness> {
  await sql.unsafe(`TRUNCATE ${Object.keys(TABLE_SCHEMAS).map((table) => `"${table}"`).join(', ')}, unit_closure CASCADE`)
  let identity: AuthIdentity | null = null
  const listeners = new Set<(identity: AuthIdentity | null) => void>()
  const transport = handlerFetch()
  harnesses += 1
  const adapter: ContractAdapter = createRemoteDataAdapter(
    {
      url: 'https://backend.test',
      apiKey: 'publishable-test-key',
      identity: {
        current: () => identity,
        subscribe(listener): Unsubscribe {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        },
      },
      accessToken: () => Promise.resolve(identity === null ? null : transport.tokenOf(identity)),
      fetch: transport.fetch,
    },
    `contract-remote-${String(harnesses)}`,
  )
  const store = createPostgresStore(clientOf(sql), catalog)
  return {
    adapter,
    signIn(next) {
      identity = next
      for (const listener of [...listeners]) listener(next)
    },
    // A seed writes a state no command makes, often by rewriting a row in place at its version,
    // which the version guard refuses to any writer. Only these test writes run with the
    // triggers off (`replica`), and only for rows that exist: a new row still fires them all.
    seed: (table, rows) =>
      sql.begin(async (tx) => {
        const target = createPostgresStore(clientOf(tx), catalog).table(table)
        const key = (row: object) => primaryKeyOf(table).map((column) => (row as Record<string, unknown>)[column])
        const present = (row: object) => {
          const value = key(row)
          return target.get((value.length === 1 ? value[0] : value) as never)
        }
        const existing = await Promise.all(rows.map(async (row) => (await present(row)) !== undefined))
        await target.bulkPut(rows.filter((_row, index) => !existing[index]))
        const rewrites = rows.filter((_row, index) => existing[index])
        if (rewrites.length === 0) return
        await tx.unsafe('SET LOCAL session_replication_role = replica')
        await target.bulkPut(rewrites)
      }) as Promise<void>,
    rows: (table) => store.table(table).toArray() as never,
    async dispose() {},
  }
}

describeAdapterContract('remote adapter over the gateway', createHarness)

describe('remote adapter: the bootstrap claimant (D-005)', () => {
  it('lets no one but BOOTSTRAP_OWNER_EMAIL claim the empty organization', async () => {
    const harness = await createHarness()
    const stranger: AuthIdentity = {
      auth_user_id: AuthUserId.parse(crypto.randomUUID()),
      provider: 'google',
      email: 'someone-else@example.test',
      email_verified: true,
      display_name: null,
    }
    harness.signIn(stranger)
    const onboarding = await harness.adapter.session.onboardingState()
    expect(onboarding.ok && onboarding.value.bootstrap_available).toBe(false)
    const result = await harness.adapter.commands.organizations.bootstrapOwner(bootstrapInput())
    expect(result.ok ? null : result.error.code).toBe('bootstrap_not_allowed')
    expect(await harness.rows('organizations')).toEqual([])
    await harness.dispose()
  })

  it('matches the owner email without regard to case', async () => {
    const harness = await createHarness()
    harness.signIn({
      auth_user_id: AuthUserId.parse(crypto.randomUUID()),
      provider: 'google',
      email: CONTRACT_OWNER_EMAIL.toUpperCase(),
      email_verified: true,
      display_name: null,
    })
    const onboarding = await harness.adapter.session.onboardingState()
    expect(onboarding.ok && onboarding.value.bootstrap_available).toBe(true)
    await harness.dispose()
  })
})
