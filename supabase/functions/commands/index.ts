// The `commands` server function (D-201): the data layer's command gateway, served over HTTP on
// Supabase Edge Functions. This file only wires the environment in: the database connection, the
// auth server and the app's origins. Every rule runs in the data layer it imports.
import {
  CATALOG_QUERY,
  catalogOf,
  createCommandGateway,
  createCommandHandler,
  createPushDispatch,
  onceRetrying,
  supabaseTokenVerifier,
  type CommittedCall,
  type SqlClient,
  type StoreCatalog,
} from '@data/server'
import postgres from 'postgres'

function required(name: string): string {
  const value = Deno.env.get(name)
  if (value === undefined || value === '') throw new Error(`commands: ${name} is not set`)
  return value
}

// Supabase provides the first three; APP_ORIGINS lists the app's deployments, comma-separated, an
// entry with `*` admitting preview deployments (D-209);
// BOOTSTRAP_OWNER_EMAIL names the one identity that may claim the empty organization (D-005).
const sql = postgres(required('SUPABASE_DB_URL'), { max: 2, prepare: false, onnotice: () => undefined, connection: { TimeZone: 'UTC' } })
const bootstrapOwnerEmail = required('BOOTSTRAP_OWNER_EMAIL')
const origins = required('APP_ORIGINS').split(',').map((origin) => origin.trim()).filter((origin) => origin !== '')

const clientOf = (connection: postgres.Sql | postgres.TransactionSql): SqlClient => ({
  query: (text, params) => connection.unsafe(text, params),
})

/** One SERIALIZABLE transaction per request; the result travels boxed, as `begin` unwraps arrays. */
async function transact<T>(work: (client: SqlClient) => Promise<T>): Promise<T> {
  const { value } = await sql.begin('isolation level serializable', async (tx) => ({ value: await work(clientOf(tx)) }))
  return value
}

// Loaded on first use; a failed load is tried again on the next request (OI-352).
const catalogOnce: () => Promise<StoreCatalog> = onceRetrying(() => sql.unsafe(CATALOG_QUERY).then(catalogOf))

const log = (line: string) => {
  console.info(line)
}
const time = { now: () => new Date().toISOString() }

// Pushes (D-354) need both VAPID secrets. Without them no push is sent, and the app, built without
// VITE_PUSH_PUBLIC_KEY, offers none (D-076).
const vapidPrivateKey = Deno.env.get('PUSH_VAPID_PRIVATE_KEY') ?? ''
const vapidSubject = Deno.env.get('PUSH_VAPID_SUBJECT') ?? ''
const pushEnabled = vapidPrivateKey !== '' && vapidSubject !== ''
if (!pushEnabled) log(JSON.stringify({ push: { code: 'push_not_configured' } }))
const dispatchOnce: () => Promise<(call: CommittedCall) => Promise<void>> = onceRetrying(() =>
  Promise.all([catalogOnce(), createWebPushSender({ privateJwk: vapidPrivateKey, subject: vapidSubject, fetch, time })]).then(([loaded, sender]) =>
    createPushDispatch({ transact, catalog: loaded, time, sender, log }),
  ),
)

/** The push runs after the answer is sent; the runtime keeps the worker alive until it settles. */
const runtime: { waitUntil(work: Promise<unknown>): void } | undefined = Reflect.get(globalThis, 'EdgeRuntime')
const afterCommit = (call: CommittedCall) => {
  const work = dispatchOnce()
    .then((run) => run(call))
    .catch(() => {
      log(JSON.stringify({ push: { code: 'dispatch_failed' } }))
    })
  runtime?.waitUntil(work)
}

const serve = createCommandHandler({
  verify: supabaseTokenVerifier({ url: required('SUPABASE_URL'), apiKey: required('SUPABASE_ANON_KEY'), fetch }),
  origins,
  log,
  gateway: async (identity, body) =>
    createCommandGateway({
      transact,
      catalog: await catalogOnce(),
      time,
      bootstrapOwnerEmail,
      ...(pushEnabled ? { afterCommit } : {}),
    })(identity, body),
})

Deno.serve(serve)
