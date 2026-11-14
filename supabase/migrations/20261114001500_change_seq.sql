-- =============================================================================
-- "Changed since" by a commit-ordered change number (D-373, OI-254, OI-255).
--
-- 1. change_counters: one row per organization, the last change number handed out. Every leave
--    event and membership write reads and writes it in its own SERIALIZABLE transaction, so the
--    numbers follow commit order.
-- 2. leave_events.change_seq, unit_memberships.change_seq and report_confirmations.seen_seq.
-- 3. The existing rows: events numbered per organization by (created_at, id) from 1, the append-only
--    trigger (D-202) set aside for that one update (events carry no version, so D-012 does not
--    apply); memberships stay at 0 with no write; a confirmation holds from the largest number
--    created at or before its confirmed_at; the counter starts at the largest number.
-- 4. load_organization_export reads format 6, and format 5, numbered as here.
--
-- Additive and idempotent: a second run numbers nothing again and moves no counter back. Row-level
-- security is unchanged for the old tables; the new one is closed to the API roles (D-203).
-- Production gets it only through the manual production workflow.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The counter.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "change_counters" (
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "last_seq" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY("organization_id"),
  CONSTRAINT "change_counters_last_seq_check" CHECK ("last_seq" >= 0)
);

-- No client reaches it directly: row level security on with no policy, no privilege (D-203).
ALTER TABLE "change_counters" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "change_counters" FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. The numbers.
-- -----------------------------------------------------------------------------
ALTER TABLE "leave_events" ADD COLUMN IF NOT EXISTS "change_seq" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "unit_memberships" ADD COLUMN IF NOT EXISTS "change_seq" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "report_confirmations" ADD COLUMN IF NOT EXISTS "seen_seq" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "report_confirmations" DROP CONSTRAINT IF EXISTS "report_confirmations_seen_seq_check";
ALTER TABLE "report_confirmations" ADD CONSTRAINT "report_confirmations_seen_seq_check" CHECK ("seen_seq" >= 0);
CREATE INDEX IF NOT EXISTS "idx_leave_events_seq" ON "leave_events"("organization_id", "change_seq");

-- -----------------------------------------------------------------------------
-- 3. The existing rows. Only events still at 0 are numbered, after the organization's largest number.
-- -----------------------------------------------------------------------------
ALTER TABLE "leave_events" DISABLE TRIGGER "leave_events_append_only";
UPDATE "leave_events" e
SET "change_seq" = numbered.seq
FROM (
  SELECT u."id", COALESCE(done.last, 0) + row_number() OVER (PARTITION BY u."organization_id" ORDER BY u."created_at", u."id") AS seq
  FROM "leave_events" u
  LEFT JOIN (
    SELECT "organization_id", max("change_seq") AS last FROM "leave_events" GROUP BY "organization_id"
  ) done ON done."organization_id" = u."organization_id"
  WHERE u."change_seq" = 0
) numbered
WHERE e."id" = numbered."id";
ALTER TABLE "leave_events" ENABLE TRIGGER "leave_events_append_only";

-- report_confirmations carries no version: the row is the confirmation itself.
UPDATE "report_confirmations" c
SET "seen_seq" = held.seq
FROM (
  SELECT r."id", max(e."change_seq") AS seq
  FROM "report_confirmations" r
  JOIN "leave_events" e ON e."organization_id" = r."organization_id" AND e."created_at" <= r."confirmed_at"
  WHERE r."seen_seq" = 0
  GROUP BY r."id"
) held
WHERE c."id" = held."id" AND held.seq > 0;

INSERT INTO "change_counters" ("organization_id", "last_seq")
SELECT o."id", GREATEST(
  (SELECT COALESCE(max(e."change_seq"), 0) FROM "leave_events" e WHERE e."organization_id" = o."id"),
  (SELECT COALESCE(max(m."change_seq"), 0) FROM "unit_memberships" m WHERE m."organization_id" = o."id")
)
FROM "organizations" o
ON CONFLICT ("organization_id") DO UPDATE SET "last_seq" = GREATEST("change_counters"."last_seq", EXCLUDED."last_seq");

-- -----------------------------------------------------------------------------
-- 4. load_organization_export reads format 6, and format 5 numbered as above.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "load_organization_export"("payload" jsonb) RETURNS uuid
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  -- EXPORT_FORMAT_VERSION in src/contracts; load.dbtest.ts holds the two equal. Format 5 is read too.
  accepted_version CONSTANT integer := 6;
  -- The closure is derived (D-039); the change counter is set here, never exported (D-373).
  derived CONSTANT text[] := ARRAY['unit_closure', 'change_counters'];
  tables jsonb := "payload"->'tables';
  organization uuid;
  listed text;
  writes text[] := '{}';
BEGIN
  IF jsonb_typeof("payload"->'format_version') IS DISTINCT FROM 'number'
     OR ("payload"->>'format_version')::integer NOT IN (accepted_version - 1, accepted_version) THEN
    RAISE EXCEPTION 'export format % is not %', "payload"->'format_version', accepted_version USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(tables) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'the export has no tables' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(tables->'organizations') IS DISTINCT FROM 'array' OR jsonb_array_length(tables->'organizations') <> 1 THEN
    RAISE EXCEPTION 'an export holds exactly one organization' USING ERRCODE = '22023';
  END IF;
  organization := (tables->'organizations'->0->>'id')::uuid;
  IF EXISTS (SELECT 1 FROM "organizations" WHERE "id" = organization) THEN
    RAISE EXCEPTION 'organization % is already in the backend', organization USING ERRCODE = '23505';
  END IF;

  FOR listed IN SELECT jsonb_object_keys(tables) ORDER BY 1 LOOP
    IF listed = ANY (derived) OR NOT EXISTS (
      SELECT 1 FROM information_schema.tables t
      WHERE t."table_schema" = 'public' AND t."table_name" = listed AND t."table_type" = 'BASE TABLE'
    ) THEN
      RAISE EXCEPTION 'the export holds an unknown table %', listed USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(tables->listed) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'table % is not a list of rows', listed USING ERRCODE = '22023';
    END IF;
    IF listed <> 'organizations' AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(tables->listed) item
      WHERE item->>'organization_id' IS DISTINCT FROM organization::text
    ) THEN
      RAISE EXCEPTION 'table % holds a row of another organization', listed USING ERRCODE = '22023';
    END IF;
    writes := writes || CASE listed
      -- Parents before children: the parent check and the closure read the units written before them.
      WHEN 'units' THEN format(
        $w$%1$I AS (
          INSERT INTO "units"
          WITH RECURSIVE given AS (
            SELECT * FROM jsonb_populate_recordset(NULL::"units", $1->'units')
          ), placed AS (
            SELECT g."id", 0 AS depth FROM given g WHERE g."parent_id" IS NULL OR g."parent_id" NOT IN (SELECT "id" FROM given)
            UNION ALL
            SELECT g."id", p.depth + 1 FROM given g JOIN placed p ON g."parent_id" = p."id"
          )
          SELECT given.* FROM given JOIN placed USING ("id") ORDER BY placed.depth, given."id"
        )$w$, 'write_' || listed)
      -- One leave's events in their stored order, so the order trigger keeps their sequence.
      WHEN 'leave_events' THEN format(
        $w$%1$I AS (
          INSERT INTO "leave_events"
          SELECT e.* FROM jsonb_array_elements($1->'leave_events') WITH ORDINALITY AS given(item, position)
          CROSS JOIN LATERAL jsonb_populate_record(NULL::"leave_events", given.item) e
          ORDER BY e."leave_id", e."created_at", given.position
        )$w$, 'write_' || listed)
      ELSE format(
        '%I AS (INSERT INTO %I SELECT * FROM jsonb_populate_recordset(NULL::%I, $1->%L))',
        'write_' || listed, listed, listed, listed
      )
    END;
  END LOOP;

  -- Format 5 carries no change numbers: they are given as the migration gives them (D-373).
  IF ("payload"->>'format_version')::integer < accepted_version THEN
    IF tables ? 'leave_events' THEN
      tables := jsonb_set(tables, '{leave_events}', COALESCE((
        SELECT jsonb_agg(numbered.item ORDER BY numbered.position)
        FROM (
          SELECT given.item || jsonb_build_object('change_seq', row_number() OVER (
            ORDER BY (given.item->>'created_at')::timestamptz, (given.item->>'id')::uuid
          )) AS item, given.position
          FROM jsonb_array_elements(tables->'leave_events') WITH ORDINALITY AS given(item, position)
        ) numbered
      ), '[]'::jsonb));
    END IF;
    IF tables ? 'unit_memberships' THEN
      tables := jsonb_set(tables, '{unit_memberships}', COALESCE((
        SELECT jsonb_agg(given.item || jsonb_build_object('change_seq', 0) ORDER BY given.position)
        FROM jsonb_array_elements(tables->'unit_memberships') WITH ORDINALITY AS given(item, position)
      ), '[]'::jsonb));
    END IF;
    IF tables ? 'report_confirmations' THEN
      tables := jsonb_set(tables, '{report_confirmations}', COALESCE((
        SELECT jsonb_agg(given.item || jsonb_build_object('seen_seq', COALESCE((
          SELECT max((event->>'change_seq')::integer)
          FROM jsonb_array_elements(COALESCE(tables->'leave_events', '[]'::jsonb)) event
          WHERE (event->>'created_at')::timestamptz <= (given.item->>'confirmed_at')::timestamptz
        ), 0)) ORDER BY given.position)
        FROM jsonb_array_elements(tables->'report_confirmations') WITH ORDINALITY AS given(item, position)
      ), '[]'::jsonb));
    END IF;
  END IF;

  EXECUTE 'WITH ' || array_to_string(writes, ', ') || ' SELECT 1' USING tables;

  -- The counter continues from the largest number loaded.
  INSERT INTO "change_counters" ("organization_id", "last_seq")
  SELECT organization, GREATEST(
    (SELECT COALESCE(max("change_seq"), 0) FROM "leave_events" WHERE "organization_id" = organization),
    (SELECT COALESCE(max("change_seq"), 0) FROM "unit_memberships" WHERE "organization_id" = organization),
    (SELECT COALESCE(max("seen_seq"), 0) FROM "report_confirmations" WHERE "organization_id" = organization)
  );
  RETURN organization;
END $$;

-- The database owner only: never the Data API's roles (D-203).
REVOKE ALL ON FUNCTION "load_organization_export"(jsonb) FROM PUBLIC, anon, authenticated;
