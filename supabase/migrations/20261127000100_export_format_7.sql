-- =============================================================================
-- Export format 7 (D-479).
--
-- load_organization_export reads format 7, whose role pairs may hold `presence:view` (D-478). Formats 5 and 6 are
-- read too: 5 is numbered as before (D-373), and both give `presence:view` to every role that views leaves, as the
-- migration 20261127000000_presence_permission.sql gave it to the roles already stored.
--
-- Non-destructive.
-- =============================================================================

CREATE OR REPLACE FUNCTION "load_organization_export"("payload" jsonb) RETURNS uuid
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  -- EXPORT_FORMAT_VERSION in src/contracts; load.dbtest.ts holds the two equal. Formats 5 and 6 are read too.
  accepted_version CONSTANT integer := 7;
  -- The closure is derived (D-039); the change counter is set here, never exported (D-373).
  derived CONSTANT text[] := ARRAY['unit_closure', 'change_counters'];
  tables jsonb := "payload"->'tables';
  organization uuid;
  listed text;
  writes text[] := '{}';
BEGIN
  IF jsonb_typeof("payload"->'format_version') IS DISTINCT FROM 'number'
     OR ("payload"->>'format_version')::integer NOT IN (accepted_version - 2, accepted_version - 1, accepted_version) THEN
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
  IF ("payload"->>'format_version')::integer < accepted_version - 1 THEN
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

  -- Formats before 7 knew no presence pair: who views leaves sees who is on base with them, as the migration gives it
  -- (D-478, D-479).
  IF ("payload"->>'format_version')::integer < accepted_version AND tables ? 'role_permissions' THEN
    tables := jsonb_set(tables, '{role_permissions}', (
      SELECT COALESCE(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT given.item FROM jsonb_array_elements(tables->'role_permissions') given(item)
        UNION
        SELECT jsonb_build_object(
          'role_id', viewing.item->'role_id', 'organization_id', viewing.item->'organization_id',
          'resource', 'presence', 'action', 'view'
        )
        FROM jsonb_array_elements(tables->'role_permissions') viewing(item)
        WHERE viewing.item->>'resource' = 'leaves' AND viewing.item->>'action' = 'view'
      ) merged
    ));
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
