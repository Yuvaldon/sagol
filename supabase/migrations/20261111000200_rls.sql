-- =============================================================================
-- Row level security (D-203).
-- Clients never read or write tables: every call goes through the command gateway
-- (D-201), which connects as the owner and runs the domain policy (D-003) itself.
-- Row level security is on for every table with no policy (D-202), and the public
-- API roles hold no privilege, so a publishable key or a session token reaches no
-- row, sequence or function through the Data API. The policy lives in one place.
-- =============================================================================

-- The API roles exist on Supabase; a local database (db-reset) creates them first.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- Objects a later migration creates start closed as well.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
