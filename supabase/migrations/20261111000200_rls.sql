-- =============================================================================
-- Row level security (D-203).
-- Clients never read or write tables: every call goes through the command gateway
-- (D-201), which connects as the owner and runs the policy (D-003) itself. The
-- public API roles get nothing, so a leaked publishable key or session token
-- reaches no row through the Data API. The policy lives in one place, the domain.
-- =============================================================================

-- Every table of the schema, present and future, holds RLS with no policy: deny all.
DO $$
DECLARE
  target text;
BEGIN
  FOR target IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target);
  END LOOP;
END
$$;

-- The API roles exist on Supabase; a local database (db-reset) creates them first.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
