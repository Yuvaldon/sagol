// The `commands` server function (D-201): the data layer's command gateway, served over HTTP on
// Supabase Edge Functions. This file only wires the environment in: the database connection, the
// auth server and the app's origins. Every rule runs in the data layer it imports.
import { CATALOG_QUERY, catalogOf, createCommandGateway, createCommandHandler, supabaseTokenVerifier, type SqlClient, type StoreCatalog } from '@data/server'
import postgres from 'postgres'

function required(name: string): string {
  const value = Deno.env.get(name)
  if (value === undefined || value === '') throw new Error(`commands: ${name} is not set`)
  return value
}

// Supabase provides the first three; APP_ORIGINS lists the app's deployments, comma-separated.
const sql = postgres(required('SUPABASE_DB_URL'), { max: 2, prepare: false, onnotice: () => undefined, connection: { TimeZone: 'UTC' } })
const origins = required('APP_ORIGINS').split(',').map((origin) => origin.trim()).filter((origin) => origin !== '')

const clientOf = (connection: postgres.Sql | postgres.TransactionSql): SqlClient => ({
  query: (text, params) => connection.unsafe(text, params),
})

/** One SERIALIZABLE transaction per request; the result travels boxed, as `begin` unwraps arrays. */
async function transact<T>(work: (client: SqlClient) => Promise<T>): Promise<T> {
  const { value } = await sql.begin('isolation level serializable', async (tx) => ({ value: await work(clientOf(tx)) }))
  return value
}

let catalog: Promise<StoreCatalog> | undefined
const catalogOnce = () => (catalog ??= sql.unsafe(CATALOG_QUERY).then(catalogOf))

const serve = createCommandHandler({
  verify: supabaseTokenVerifier({ url: required('SUPABASE_URL'), apiKey: required('SUPABASE_ANON_KEY'), fetch }),
  origins,
  gateway: async (identity, body) =>
    createCommandGateway({
      transact,
      catalog: await catalogOnce(),
      time: { now: () => new Date().toISOString() },
    })(identity, body),
})

Deno.serve(serve)
