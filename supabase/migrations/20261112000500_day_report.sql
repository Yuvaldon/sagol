-- =============================================================================
-- The daily report workflow (D-269, D-293).
--
-- 1. role_permissions takes the resource `day_reports` and the action `confirm`.
-- 2. report_confirmations: one row per unit and date, moved by a new confirmation, never deleted.
-- 3. deployments.report_owner_id: who reads the rotation's consolidated report; NULL = none named.
-- 4. Every role that approves leaves may confirm a unit's report, as the commanders who approve do.
-- 5. load_organization_export reads format 4, whose rotations name a report owner and which holds the
--    confirmations.
--
-- Non-destructive.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The permission vocabulary (D-040).
-- -----------------------------------------------------------------------------
ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_resource_check";
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_resource_check" CHECK ("resource" IN (
  'organization', 'unit_levels', 'units', 'command_ranks', 'seniority_overrides', 'soldiers', 'soldier_private',
  'memberships', 'tags', 'leave_types', 'leaves', 'leave_comments', 'internal_comments',
  'deployments', 'availability_rules', 'properties', 'roles', 'access_grants',
  'accounts', 'data_transfer', 'day_reports'
));
ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_action_check";
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_action_check" CHECK ("action" IN (
  'view', 'create', 'update', 'delete', 'duplicate', 'approve', 'export', 'import', 'confirm'
));

-- -----------------------------------------------------------------------------
-- 2. The confirmations.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "report_confirmations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "unit_id" UUID NOT NULL REFERENCES "units"("id"),
  "report_date" DATE NOT NULL,
  "confirmed_by" UUID NOT NULL REFERENCES "soldiers"("id"),
  "confirmed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY("id"),
  CONSTRAINT "report_confirmations_unit_date_key" UNIQUE ("unit_id", "report_date")
);
CREATE INDEX IF NOT EXISTS "idx_report_confirmations_date" ON "report_confirmations"("organization_id", "report_date");

-- No client reaches it directly: row level security on with no policy, no privilege (D-203).
ALTER TABLE "report_confirmations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "report_confirmations" FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. The rotation's report owner.
-- -----------------------------------------------------------------------------
ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "report_owner_id" UUID REFERENCES "soldiers"("id");

-- -----------------------------------------------------------------------------
-- 4. Who approves leaves confirms the report (D-293).
-- -----------------------------------------------------------------------------
INSERT INTO "role_permissions" ("role_id", "organization_id", "resource", "action")
SELECT "role_id", "organization_id", 'day_reports', 'confirm'
FROM "role_permissions"
WHERE "resource" = 'leaves' AND "action" = 'approve'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. load_organization_export reads format 4: rotations name a report owner, and the confirmations travel.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "load_organization_export"("payload" jsonb) RETURNS uuid
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  -- EXPORT_FORMAT_VERSION in src/contracts; load.dbtest.ts holds the two equal.
  accepted_version CONSTANT integer := 4;
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
