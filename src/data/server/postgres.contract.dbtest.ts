import { TABLE_SCHEMAS, type AuthIdentity, type DataChange, type Result, type Session, type Unsubscribe } from '@contracts'
import postgres from 'postgres'
import { afterAll, beforeAll } from 'vitest'
import { CONTRACT_NOW, describeAdapterContract, type ContractAdapter, type ContractHarness } from '../contract-tests/suite'
import { createCommandGateway, type GatewayResponse } from './gateway'
import { CATALOG_QUERY, catalogOf, createPostgresStore, primaryKeyOf, type SqlClient, type StoreCatalog } from './postgresStore'

// The command gateway over the migrated schema, against the shared contract suite (D-201). It
// runs under `npm run test:db`, which rebuilds a local database from `supabase/migrations`
// first. Every call crosses a JSON boundary, as it does over HTTP, so nothing passes by reference.

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

const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/** A caller of the gateway with the shape of the adapter: what the remote adapter of row 8.3 does over HTTP. */
function gatewayClient(identity: () => AuthIdentity | null): ContractAdapter {
  const gateway = createCommandGateway({
    transact: (work) => sql.begin('isolation level serializable', (tx) => work(clientOf(tx))) as never,
    catalog,
    time: { now: () => CONTRACT_NOW },
  })
  const listeners = new Set<(changes: readonly DataChange[]) => void>()

  async function call(kind: string, group: string, method: string, args: unknown[]): Promise<Result<unknown>> {
    const response = roundTrip<GatewayResponse>(await gateway(identity(), roundTrip({ kind, group, method, args })))
    if (response.changes.length > 0) for (const listener of [...listeners]) listener(response.changes)
    return response.result
  }

  const groups = (kind: string) =>
    new Proxy(
      {},
      {
        get: (_target, group) =>
          new Proxy(
            {},
            { get: (_inner, method) => (...args: unknown[]) => call(kind, String(group), String(method), args) },
          ),
      },
    )

  const changes = {
    subscribe(listener: (changes: readonly DataChange[]) => void): Unsubscribe {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
  const sessionListeners = new Set<(session: Session) => void>()

  return {
    session: {
      current: () => call('session', 'session', 'current', []),
      onboardingState: () => call('session', 'session', 'onboardingState', []),
      can: (...args: unknown[]) => call('session', 'session', 'can', args),
      subscribe(listener: (session: Session) => void): Unsubscribe {
        sessionListeners.add(listener)
        return () => {
          sessionListeners.delete(listener)
        }
      },
      /** The harness calls this when the identity or a soldier account changes. */
      async refresh() {
        const result = await call('session', 'session', 'current', [])
        if (result.ok) for (const listener of [...sessionListeners]) listener(result.value as Session)
      },
    },
    transfer: {
      importBatch: (...args: unknown[]) => call('transfer', 'transfer', 'importBatch', args),
      exportOrganization: () => call('transfer', 'transfer', 'exportOrganization', []),
    },
    repositories: groups('repositories'),
    commands: groups('commands'),
    changes,
  } as unknown as ContractAdapter
}

async function createHarness(): Promise<ContractHarness> {
  await sql.unsafe(`TRUNCATE ${Object.keys(TABLE_SCHEMAS).map((table) => `"${table}"`).join(', ')}, unit_closure CASCADE`)
  let identity: AuthIdentity | null = null
  const adapter = gatewayClient(() => identity)
  const refresh = () => void (adapter.session as unknown as { refresh(): Promise<void> }).refresh()
  adapter.changes.subscribe((changes) => {
    if (changes.some((change) => change.table === 'soldier_accounts')) refresh()
  })
  const store = createPostgresStore(clientOf(sql), catalog)
  return {
    adapter,
    signIn(next) {
      identity = next
      refresh()
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

describeAdapterContract('postgres gateway', createHarness)
