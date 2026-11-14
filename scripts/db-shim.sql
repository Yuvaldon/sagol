-- What a Supabase stack provides and a plain Postgres lacks, for a disposable test database (D-201, D-348, D-436):
-- run by `scripts/db-reset.ts` before the migrations, and by `history.dbtest.ts` on its own database.
--
-- 1. The API roles the RLS migration revokes from (D-203), with Supabase's default grants on `public`, which the RLS
--    migration must undo.
-- 2. The parts of Supabase's `auth` and `realtime` schemas the migrations rely on: the caller's user id from the
--    request's claims, and Realtime's broadcast table with its `send` and `topic` functions. Each is created only
--    where it is missing, so a Supabase stack keeps its own.

DO $roles$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', api_role);
    END IF;
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', api_role);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO %I', api_role);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO %I', api_role);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO %I', api_role);
  END LOOP;
END $roles$;

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
