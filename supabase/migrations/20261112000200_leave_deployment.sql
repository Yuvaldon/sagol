-- =============================================================================
-- Every leave belongs to a rotation (D-216).
--
-- A leave references the deployment it is asked in. Its soldier is a member of that deployment, and
-- its dates fall within the member's dates, a NULL side meaning the deployment's own. The command
-- gateway checks it before every write; the constraint triggers below are the database's own
-- guarantee, checked at commit, so one statement may write a leave and its membership together
-- (load_organization_export does).
--
-- Non-destructive: the column is added, filled where exactly one rotation fits, and only then set
-- NOT NULL. A leave no rotation fits stops the migration, which rolls back whole: count them first
-- (the query at the end of this header) and give their soldiers a membership, or a rotation.
--
--   SELECT count(*) FROM "leaves" l WHERE (
--     SELECT count(*) FROM "deployment_members" m JOIN "deployments" d ON d."id" = m."deployment_id"
--     WHERE m."soldier_id" = l."soldier_id" AND d."organization_id" = l."organization_id"
--       AND d."archived_at" IS NULL
--       AND l."start_date" >= COALESCE(m."start_date", d."start_date")
--       AND l."end_date" <= COALESCE(m."end_date", d."end_date", l."end_date")
--   ) <> 1;
-- =============================================================================

ALTER TABLE "leaves" ADD COLUMN IF NOT EXISTS "deployment_id" UUID REFERENCES "deployments"("id");

UPDATE "leaves" l SET "deployment_id" = fit."deployment_id"
FROM (
  SELECT l2."id" AS leave_id, min(m."deployment_id"::text)::uuid AS deployment_id
  FROM "leaves" l2
  JOIN "deployment_members" m ON m."soldier_id" = l2."soldier_id"
  JOIN "deployments" d ON d."id" = m."deployment_id"
  WHERE d."organization_id" = l2."organization_id"
    AND d."archived_at" IS NULL
    AND l2."start_date" >= COALESCE(m."start_date", d."start_date")
    AND l2."end_date" <= COALESCE(m."end_date", d."end_date", l2."end_date")
  GROUP BY l2."id"
  HAVING count(*) = 1
) fit
WHERE l."id" = fit.leave_id AND l."deployment_id" IS NULL;

ALTER TABLE "leaves" ALTER COLUMN "deployment_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_leaves_deployment" ON "leaves"("deployment_id", "soldier_id");

-- -----------------------------------------------------------------------------
-- The live leaves (pending, approved) of one soldier in one deployment fit their membership.
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
      m."soldier_id" IS NULL
      OR d."organization_id" <> l."organization_id"
      OR l."start_date" < COALESCE(m."start_date", d."start_date")
      OR l."end_date" > COALESCE(m."end_date", d."end_date", l."end_date")
    )
  LIMIT 1;
  IF stray IS NOT NULL THEN
    RAISE EXCEPTION 'leave % falls outside its rotation', stray USING ERRCODE = '23514';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION "leaves_within_rotation"() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  pair record;
BEGIN
  IF TG_TABLE_NAME = 'leaves' THEN
    PERFORM "leaves_check_rotation"(NEW."deployment_id", NEW."soldier_id");
  ELSIF TG_TABLE_NAME = 'deployment_members' THEN
    PERFORM "leaves_check_rotation"(OLD."deployment_id", OLD."soldier_id");
  ELSE
    FOR pair IN SELECT DISTINCT l."soldier_id" FROM "leaves" l WHERE l."deployment_id" = NEW."id" LOOP
      PERFORM "leaves_check_rotation"(NEW."id", pair."soldier_id");
    END LOOP;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS "leaves_within_rotation" ON "leaves";
CREATE CONSTRAINT TRIGGER "leaves_within_rotation"
  AFTER INSERT OR UPDATE ON "leaves" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "leaves_within_rotation"();
DROP TRIGGER IF EXISTS "leaves_within_rotation" ON "deployment_members";
CREATE CONSTRAINT TRIGGER "leaves_within_rotation"
  AFTER UPDATE OR DELETE ON "deployment_members" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "leaves_within_rotation"();
DROP TRIGGER IF EXISTS "leaves_within_rotation" ON "deployments";
CREATE CONSTRAINT TRIGGER "leaves_within_rotation"
  AFTER UPDATE OF "start_date", "end_date" ON "deployments" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "leaves_within_rotation"();

-- Internal to the triggers: no API role calls them (D-203).
REVOKE ALL ON FUNCTION "leaves_check_rotation"(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "leaves_within_rotation"() FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- load_organization_export reads format 2, whose leaves carry their rotation.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "load_organization_export"("payload" jsonb) RETURNS uuid
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  -- EXPORT_FORMAT_VERSION in src/contracts; load.dbtest.ts holds the two equal.
  accepted_version CONSTANT integer := 2;
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
