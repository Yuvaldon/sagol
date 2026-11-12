// Fails when the migrated database and `docs/schema.sql` disagree on a table, column, constraint
// or index (D-201): the schema document stays the model, the migrations stay its executable form.
// It builds a scratch database from the document next to the migrated one and compares their
// catalogs. Server-side objects (functions, triggers, policies) live in the migrations only.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

const SCHEMA = join(import.meta.dirname, '..', 'docs', 'schema.sql')
const LOCAL_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '::1']

const url = process.env.DATABASE_URL
if (url === undefined || url === '' || !LOCAL_HOSTS.includes(new URL(url).hostname.replace(/^\[|\]$/g, ''))) {
  console.error('✖ db-schema-drift: set DATABASE_URL to a local database built by db-reset')
  process.exit(1)
}

const CATALOG = `
  SELECT 'column ' || c.table_name || '.' || c.column_name || ' ' || c.data_type || ' '
    || c.udt_name || ' nullable=' || c.is_nullable || ' default=' || coalesce(c.column_default, '') AS entry
  FROM information_schema.columns c WHERE c.table_schema = 'public'
  UNION ALL
  SELECT 'constraint ' || r.relname || ' ' || x.conname || ' ' || pg_get_constraintdef(x.oid)
  FROM pg_constraint x JOIN pg_class r ON r.oid = x.conrelid
  JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND x.contype <> 't'
  UNION ALL
  SELECT 'index ' || indexdef FROM pg_indexes WHERE schemaname = 'public'`

async function entries(target: string): Promise<Set<string>> {
  const sql = postgres(target, { max: 1, onnotice: () => undefined })
  try {
    return new Set((await sql.unsafe(CATALOG)).map((row) => String(row.entry)))
  } finally {
    await sql.end()
  }
}

const reference = new URL(url)
const scratch = `${reference.pathname.slice(1)}_reference`
reference.pathname = `/${scratch}`
const admin = postgres(url, { max: 1, onnotice: () => undefined })
try {
  await admin.unsafe(`DROP DATABASE IF EXISTS "${scratch}"`)
  await admin.unsafe(`CREATE DATABASE "${scratch}"`)
} finally {
  await admin.end()
}
const builder = postgres(reference.toString(), { max: 1, onnotice: () => undefined })
try {
  await builder.unsafe(readFileSync(SCHEMA, 'utf8'))
} finally {
  await builder.end()
}

const migrated = await entries(url)
const documented = await entries(reference.toString())
const missing = [...documented].filter((entry) => !migrated.has(entry)).sort()
const extra = [...migrated].filter((entry) => !documented.has(entry)).sort()
for (const entry of missing) console.error(`✖ in docs/schema.sql, not migrated: ${entry}`)
for (const entry of extra) console.error(`✖ migrated, not in docs/schema.sql: ${entry}`)
if (missing.length + extra.length > 0) process.exit(1)
console.log(`✔ migrations match docs/schema.sql (${migrated.size} catalog entries)`)
