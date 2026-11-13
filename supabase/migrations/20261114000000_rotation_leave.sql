-- =============================================================================
-- The built-in "סבב יציאות" leave-type group (D-345, D-347).
--
-- 1. leave_type_groups gains is_rotation_leave, false for every existing group, and at most one
--    group per organization holds it.
-- 2. Every organization without one gets the group, first in order, and its one type "סבב יציאה":
--    an absence with no reason, in a calm color. The names are user data: the owner may rename them.
-- 3. load_organization_export reads format 5, whose groups carry is_rotation_leave.
--
-- Additive and idempotent: a second run finds every organization with its group. Row-level
-- security is unchanged. Production gets it only through the manual production workflow.
-- =============================================================================

ALTER TABLE "leave_type_groups" ADD COLUMN IF NOT EXISTS "is_rotation_leave" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_leave_type_groups_rotation_leave"
  ON "leave_type_groups"("organization_id") WHERE "is_rotation_leave";

DO $$
DECLARE
  organization RECORD;
  rotation UUID;
BEGIN
  FOR organization IN
    SELECT o."id" FROM "organizations" o
    WHERE NOT EXISTS (
      SELECT 1 FROM "leave_type_groups" g WHERE g."organization_id" = o."id" AND g."is_rotation_leave"
    )
  LOOP
    -- The built-in group comes first: the groups from before move down one place.
    UPDATE "leave_type_groups"
    SET "sort_order" = "sort_order" + 1, "updated_at" = now(), "version" = "version" + 1
    WHERE "organization_id" = organization."id";
    INSERT INTO "leave_type_groups" ("organization_id", "name", "is_rotation_leave", "sort_order")
    VALUES (organization."id", 'סבב יציאות', true, 0)
    RETURNING "id" INTO rotation;
    INSERT INTO "leave_types"
      ("organization_id", "group_id", "name", "color_key", "icon_key", "availability_effect", "requires_reason", "sort_order")
    VALUES (organization."id", rotation, 'סבב יציאה', 'blue', NULL, 'unavailable', false, 0);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 3. load_organization_export reads format 5: the groups carry is_rotation_leave, and the built-in group travels.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "load_organization_export"("payload" jsonb) RETURNS uuid
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  -- EXPORT_FORMAT_VERSION in src/contracts; load.dbtest.ts holds the two equal.
  accepted_version CONSTANT integer := 5;
  derived CONSTANT text[] := ARRAY['unit_closure'];
  tables jsonb := "payload"->'tables';
  organization uuid;
  listed text;
  writes text[] := '{}';
BEGIN
  IF jsonb_typeof("payload"->'format_version') IS DISTINCT FROM 'number'
     OR ("payload"->>'format_version')::integer <> accepted_version THEN
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

  EXECUTE 'WITH ' || array_to_string(writes, ', ') || ' SELECT 1' USING tables;
  RETURN organization;
END $$;

-- The database owner only: never the Data API's roles (D-203).
REVOKE ALL ON FUNCTION "load_organization_export"(jsonb) FROM PUBLIC, anon, authenticated;
