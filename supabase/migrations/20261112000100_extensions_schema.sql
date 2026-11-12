-- Moves btree_gist out of `public` into `extensions` (D-188, OI-123). Non-destructive: the exclusion
-- constraints keep their operator classes by reference, so no table, constraint or row changes.
-- A database built from the schema migration already has it there, so the move runs only when needed.
CREATE SCHEMA IF NOT EXISTS "extensions";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'btree_gist' AND n.nspname <> 'extensions'
  ) THEN
    ALTER EXTENSION "btree_gist" SET SCHEMA "extensions";
  END IF;
END
$$;
