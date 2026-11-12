-- =============================================================================
-- A rotation is a mode (D-257 … D-260, D-221).
--
-- 1. One rotation at a time per organization, by dates: an exclusion constraint over the live
--    (not archived) rotations, an open end unbounded (D-257).
-- 2. The explicit close: closed_at and closed_by; a closed rotation's own row keeps its name,
--    unit and dates until it is reopened (D-258).
-- 3. A rotation with no member rows holds its unit's soldiers for its days: the rotation check of
--    the live leaves reads the unit's memberships then (D-259).
-- 4. Tags for one rotation: soldier_tags gets an id key and deployment_id; the single-selection
--    rule holds per scope; tag_categories.default_lifetime (D-260).
-- 5. load_organization_export reads format 3.
--
-- Non-destructive. Overlapping live rotations stop the migration, which rolls back whole and names
-- them: list them first with the query below, and move, end or archive one of each pair.
--
--   SELECT a."id", a."name", b."id", b."name" FROM "deployments" a JOIN "deployments" b
--     ON a."organization_id" = b."organization_id" AND a."id" < b."id"
--   WHERE a."archived_at" IS NULL AND b."archived_at" IS NULL
--     AND daterange(a."start_date", a."end_date", '[]') && daterange(b."start_date", b."end_date", '[]');
-- =============================================================================

DO $$
DECLARE
  overlapping text;
BEGIN
  SELECT string_agg(format('%s (%s) and %s (%s)', a."name", a."id", b."name", b."id"), '; ') INTO overlapping
  FROM "deployments" a JOIN "deployments" b ON a."organization_id" = b."organization_id" AND a."id" < b."id"
  WHERE a."archived_at" IS NULL AND b."archived_at" IS NULL
    AND daterange(a."start_date", a."end_date", '[]') && daterange(b."start_date", b."end_date", '[]');
  IF overlapping IS NOT NULL THEN
    RAISE EXCEPTION 'live rotations overlap: %', overlapping USING ERRCODE = '23P01';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1, 2. deployments: one at a time, and the close.
-- -----------------------------------------------------------------------------
ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMPTZ;
ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "closed_by" UUID REFERENCES "soldiers"("id");
ALTER TABLE "deployments" DROP CONSTRAINT IF EXISTS "deployments_close_check";
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_close_check" CHECK (
  ("closed_at" IS NULL) = ("closed_by" IS NULL) AND ("closed_at" IS NULL OR "end_date" IS NOT NULL)
);
ALTER TABLE "deployments" DROP CONSTRAINT IF EXISTS "deployments_one_at_a_time";
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_one_at_a_time" EXCLUDE USING gist (
  "organization_id" WITH =,
  daterange("start_date", "end_date", '[]') WITH &&
) WHERE ("archived_at" IS NULL);

-- A closed rotation keeps its name, unit and dates; it may be reopened or archived (D-258). The
-- members, rotation tags and leaves of a closed rotation are refused by the command code (D-221).
CREATE OR REPLACE FUNCTION "deployments_closed_unchanged"() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD."closed_at" IS NOT NULL AND NEW."closed_at" IS NOT NULL
     AND (NEW."name", NEW."unit_id", NEW."start_date", NEW."end_date")
       IS DISTINCT FROM (OLD."name", OLD."unit_id", OLD."start_date", OLD."end_date") THEN
    RAISE EXCEPTION 'rotation % is closed', OLD."id" USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER "deployments_closed_unchanged"
  BEFORE UPDATE ON "deployments"
  FOR EACH ROW EXECUTE FUNCTION "deployments_closed_unchanged"();

-- -----------------------------------------------------------------------------
-- 3. The live leaves of one soldier in one rotation fit it: within the member's days when the
--    rotation has a list, else within the rotation's days and the soldier's memberships in its
--    unit's subtree (D-216, D-259).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "leaves_check_rotation"("p_deployment" uuid, "p_soldier" uuid) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  stray uuid;
BEGIN
  SELECT l."id" INTO stray
  FROM "leaves" l
  JOIN "deployments" d ON d."id" = l."deployment_id"
  LEFT JOIN "deployment_members" m ON m."deployment_id" = l."deployment_id" AND m."soldier_id" = l."soldier_id"
  WHERE l."deployment_id" = "p_deployment" AND l."soldier_id" = "p_soldier"
    AND l."status" IN ('pending', 'approved')
    AND (
      d."organization_id" <> l."organization_id"
      OR l."start_date" < COALESCE(m."start_date", d."start_date")
      OR l."end_date" > COALESCE(m."end_date", d."end_date", l."end_date")
      OR (m."soldier_id" IS NULL AND (
        EXISTS (SELECT 1 FROM "deployment_members" x WHERE x."deployment_id" = d."id")
        OR NOT (daterange(l."start_date", l."end_date", '[]') <@ COALESCE((
          SELECT range_agg(daterange(u."valid_from", u."valid_to", '[]'))
          FROM "unit_memberships" u JOIN "unit_closure" c ON c."descendant_id" = u."unit_id"
          WHERE c."ancestor_id" = d."unit_id" AND u."soldier_id" = l."soldier_id"
        ), '{}'::datemultirange))
      ))
    )
  LIMIT 1;
  IF stray IS NOT NULL THEN
    RAISE EXCEPTION 'leave % falls outside its rotation', stray USING ERRCODE = '23514';
  END IF;
END $$;

-- A change to a rotation or its list re-checks every soldier with leaves in it: the first member
-- row turns "the whole unit" into a list, and removing the last turns it back (D-259). A change to
-- a soldier's memberships re-checks that soldier's leaves; a new one only widens the unit's days.
CREATE OR REPLACE FUNCTION "leaves_within_rotation"() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  rotation uuid;
  pair record;
BEGIN
  IF TG_TABLE_NAME = 'leaves' THEN
    PERFORM "leaves_check_rotation"(NEW."deployment_id", NEW."soldier_id");
    RETURN NULL;
  END IF;
  IF TG_TABLE_NAME = 'unit_memberships' THEN
    -- A move or an end re-checks the soldier's requests in the rotations that hold the whole unit (D-221).
    FOR pair IN
      SELECT DISTINCT l."deployment_id", l."soldier_id" FROM "leaves" l
      WHERE l."soldier_id" IN (CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD."soldier_id" END,
                               CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW."soldier_id" END)
    LOOP
      PERFORM "leaves_check_rotation"(pair."deployment_id", pair."soldier_id");
    END LOOP;
    RETURN NULL;
  END IF;
  IF TG_TABLE_NAME = 'deployment_members' THEN
    rotation := CASE WHEN TG_OP = 'DELETE' THEN OLD."deployment_id" ELSE NEW."deployment_id" END;
  ELSE
    rotation := NEW."id";
  END IF;
  FOR pair IN SELECT DISTINCT l."soldier_id" FROM "leaves" l WHERE l."deployment_id" = rotation LOOP
    PERFORM "leaves_check_rotation"(rotation, pair."soldier_id");
  END LOOP;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS "leaves_within_rotation" ON "deployment_members";
CREATE CONSTRAINT TRIGGER "leaves_within_rotation"
  AFTER INSERT OR UPDATE OR DELETE ON "deployment_members" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "leaves_within_rotation"();
DROP TRIGGER IF EXISTS "leaves_within_rotation" ON "unit_memberships";
CREATE CONSTRAINT TRIGGER "leaves_within_rotation"
  AFTER UPDATE OR DELETE ON "unit_memberships" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "leaves_within_rotation"();
DROP TRIGGER IF EXISTS "leaves_within_rotation" ON "deployments";
CREATE CONSTRAINT TRIGGER "leaves_within_rotation"
  AFTER UPDATE OF "start_date", "end_date", "unit_id" ON "deployments" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "leaves_within_rotation"();

-- -----------------------------------------------------------------------------
-- 4. soldier_tags: an id key, persistent or for one rotation (D-260).
-- -----------------------------------------------------------------------------
ALTER TABLE "soldier_tags" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "soldier_tags" ADD COLUMN IF NOT EXISTS "deployment_id" UUID REFERENCES "deployments"("id");
ALTER TABLE "soldier_tags" DROP CONSTRAINT IF EXISTS "soldier_tags_pkey";
ALTER TABLE "soldier_tags" ADD PRIMARY KEY ("id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_soldier_tags_persistent" ON "soldier_tags"("soldier_id", "tag_id") WHERE "deployment_id" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "uq_soldier_tags_rotation" ON "soldier_tags"("soldier_id", "tag_id", "deployment_id") WHERE "deployment_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_soldier_tags_deployment" ON "soldier_tags"("deployment_id") WHERE "deployment_id" IS NOT NULL;

ALTER TABLE "tag_categories" ADD COLUMN IF NOT EXISTS "default_lifetime" VARCHAR(20) NOT NULL DEFAULT 'persistent';
ALTER TABLE "tag_categories" DROP CONSTRAINT IF EXISTS "tag_categories_lifetime_check";
ALTER TABLE "tag_categories" ADD CONSTRAINT "tag_categories_lifetime_check" CHECK ("default_lifetime" IN ('persistent', 'rotation'));

-- At most one tag per soldier in a 'single' category, in each scope: the persistent tags, and
-- each rotation's (D-221).
CREATE OR REPLACE FUNCTION "soldier_tags_single_selection"() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (
    SELECT count(*)
    FROM "soldier_tags" st
    JOIN "tags" t ON t."id" = st."tag_id"
    JOIN "tag_categories" c ON c."id" = t."category_id"
    WHERE st."soldier_id" = NEW."soldier_id"
      AND st."deployment_id" IS NOT DISTINCT FROM NEW."deployment_id"
      AND c."selection_mode" = 'single'
      AND t."category_id" = (SELECT "category_id" FROM "tags" WHERE "id" = NEW."tag_id")
  ) > 1 THEN
    RAISE EXCEPTION 'soldier % holds two tags of a single-selection category', NEW."soldier_id" USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;

-- Internal to the triggers: no API role calls them (D-203).
REVOKE ALL ON FUNCTION "deployments_closed_unchanged"() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "leaves_check_rotation"(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "leaves_within_rotation"() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "soldier_tags_single_selection"() FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. load_organization_export reads format 3, whose tags carry their lifetime.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "load_organization_export"("payload" jsonb) RETURNS uuid
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  -- EXPORT_FORMAT_VERSION in src/contracts; load.dbtest.ts holds the two equal.
  accepted_version CONSTANT integer := 3;
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
