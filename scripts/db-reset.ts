// Rebuilds a disposable Postgres database from the migrations (D-201), for `npm run test:db`
// and the CI `db` job. It drops the `public` schema first, so it refuses any URL that is not
// on this machine: a hosted database is migrated by the Supabase CLI, never by this script.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

const MIGRATIONS = join(import.meta.dirname, '..', 'supabase', 'migrations')
const API_ROLES: readonly string[] = ['anon', 'authenticated']
const LOCAL_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '::1']

// The parts of Supabase's `auth` and `realtime` schemas the migrations rely on (D-347), for a plain
// Postgres: the caller's user id from the request's claims, and Realtime's broadcast table with its
// `send` and `topic` functions. Each is created only where it is missing, so a Supabase stack keeps its own.
const SUPABASE_SHIM = `
DO $shim$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$
      SELECT nullif(coalesce(current_setting('request.jwt.claim.sub', true),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid
    $f$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'realtime') THEN
    CREATE SCHEMA realtime;
    CREATE TABLE realtime.messages (
      id bigserial PRIMARY KEY, topic text NOT NULL, extension text NOT NULL, event text,
      payload jsonb, private boolean DEFAULT false, inserted_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE AS $f$
      SELECT nullif(current_setting('realtime.topic', true), '')
    $f$;
    CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true)
    RETURNS void LANGUAGE sql AS $f$
      INSERT INTO realtime.messages (topic, extension, event, payload, private)
      VALUES (topic, 'broadcast', event, payload, private)
    $f$;
    GRANT USAGE ON SCHEMA realtime TO anon, authenticated;
    GRANT SELECT ON realtime.messages TO authenticated;
  END IF;
END $shim$;
`

const url = process.env.DATABASE_URL
if (url === undefined || url === '') {
  console.error('✖ db-reset: set DATABASE_URL to a local, disposable database')
  process.exit(1)
}
if (!LOCAL_HOSTS.includes(new URL(url).hostname.replace(/^\[|\]$/g, ''))) {
  console.error('✖ db-reset: DATABASE_URL must point at this machine')
  process.exit(1)
}

const sql = postgres(url, { max: 1, onnotice: () => undefined })
try {
  await sql.unsafe('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;')
  // The API roles Supabase provides, which the RLS migration revokes from (D-203).
  for (const role of API_ROLES) {
    await sql.unsafe(`DO $$ BEGIN CREATE ROLE ${role} NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$`)
    await sql.unsafe(`GRANT USAGE ON SCHEMA public TO ${role}`)
    // Supabase grants the API roles everything in `public` by default; the RLS migration must undo it.
    for (const objects of ['TABLES', 'SEQUENCES', 'FUNCTIONS']) {
      await sql.unsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ${objects} TO ${role}`)
    }
  }
  await sql.unsafe(SUPABASE_SHIM)
  const files = readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith('.sql'))
    .sort()
  for (const file of files) {
    await sql.unsafe(readFileSync(join(MIGRATIONS, file), 'utf8'))
    console.log(`✔ ${file}`)
  }
} finally {
  await sql.end()
}
