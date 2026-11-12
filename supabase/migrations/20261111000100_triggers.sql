-- =============================================================================
-- Triggers that keep derived data and invariants on the server (D-202).
-- The command gateway (D-201) checks every rule before it writes; these are the
-- database's own guarantees, which hold whatever writes the row.
-- =============================================================================

-- Errors raised here use SQLSTATE 23514 (check_violation): the gateway answers `internal`,
-- because a command that reached one has skipped its own check.

-- -----------------------------------------------------------------------------
-- unit_closure: maintained from units.parent_id only; rejects cycles and parents of
-- another organization.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "units_check_parent"() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW."parent_id" IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "units" WHERE "id" = NEW."parent_id" AND "organization_id" = NEW."organization_id"
  ) THEN
    RAISE EXCEPTION 'unit % has a parent outside its organization', NEW."id" USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND EXISTS (
    SELECT 1 FROM "unit_closure" WHERE "ancestor_id" = NEW."id" AND "descendant_id" = NEW."parent_id"
  ) THEN
    RAISE EXCEPTION 'unit % would become its own ancestor', NEW."id" USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "units_maintain_closure"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "unit_closure" ("organization_id", "ancestor_id", "descendant_id", "depth")
    SELECT NEW."organization_id", NEW."id", NEW."id", 0
    UNION ALL
    SELECT NEW."organization_id", c."ancestor_id", NEW."id", c."depth" + 1
    FROM "unit_closure" c WHERE c."descendant_id" = NEW."parent_id";
    RETURN NULL;
  END IF;
  IF NEW."parent_id" IS NOT DISTINCT FROM OLD."parent_id" THEN
    RETURN NULL;
  END IF;
  -- Detach the subtree from its old ancestors, then attach it under the new parent.
  DELETE FROM "unit_closure" link
  USING "unit_closure" sub
  WHERE sub."ancestor_id" = NEW."id"
    AND link."descendant_id" = sub."descendant_id"
    AND link."ancestor_id" NOT IN (SELECT "descendant_id" FROM "unit_closure" WHERE "ancestor_id" = NEW."id");
  INSERT INTO "unit_closure" ("organization_id", "ancestor_id", "descendant_id", "depth")
  SELECT NEW."organization_id", above."ancestor_id", sub."descendant_id", above."depth" + sub."depth" + 1
  FROM "unit_closure" above
  CROSS JOIN "unit_closure" sub
  WHERE above."descendant_id" = NEW."parent_id" AND sub."ancestor_id" = NEW."id";
  RETURN NULL;
END $$;

CREATE OR REPLACE TRIGGER "units_check_parent"
  BEFORE INSERT OR UPDATE OF "parent_id", "organization_id" ON "units"
  FOR EACH ROW EXECUTE FUNCTION "units_check_parent"();
CREATE OR REPLACE TRIGGER "units_maintain_closure"
  AFTER INSERT OR UPDATE OF "parent_id" ON "units"
  FOR EACH ROW EXECUTE FUNCTION "units_maintain_closure"();

-- -----------------------------------------------------------------------------
-- soldier_tags: at most one tag per soldier in a 'single' category. Checked after the
-- statement's rows are in, so a whole set can be written in one statement.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "soldier_tags_single_selection"() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (
    SELECT count(*)
    FROM "soldier_tags" st
    JOIN "tags" t ON t."id" = st."tag_id"
    JOIN "tag_categories" c ON c."id" = t."category_id"
    WHERE st."soldier_id" = NEW."soldier_id"
      AND c."selection_mode" = 'single'
      AND t."category_id" = (SELECT "category_id" FROM "tags" WHERE "id" = NEW."tag_id")
  ) > 1 THEN
    RAISE EXCEPTION 'soldier % holds two tags of a single-selection category', NEW."soldier_id" USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS "soldier_tags_single_selection" ON "soldier_tags";
CREATE CONSTRAINT TRIGGER "soldier_tags_single_selection"
  AFTER INSERT OR UPDATE ON "soldier_tags"
  FOR EACH ROW EXECUTE FUNCTION "soldier_tags_single_selection"();

-- -----------------------------------------------------------------------------
-- Optimistic concurrency (D-012, D-017): a change to a versioned row raises its version by
-- exactly one. The writer sets updated_at and updated_by from its own clock and actor.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "versioned_row_guard"() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION '%.% changed from version % to %', TG_TABLE_NAME, OLD."id", OLD."version", NEW."version"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE
  versioned record;
BEGIN
  FOR versioned IN
    SELECT c."table_name" FROM information_schema.columns c
    JOIN information_schema.columns k ON k."table_schema" = c."table_schema" AND k."table_name" = c."table_name" AND k."column_name" = 'id'
    WHERE c."table_schema" = 'public' AND c."column_name" = 'version'
  LOOP
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER "versioned_row_guard" BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION "versioned_row_guard"()',
      versioned."table_name"
    );
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- leave_events: append-only history. Events of one leave get strictly increasing times
-- (OI-064): an event written at or before the leave's last event lands 1 ms after it.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "leave_events_append_only"() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'leave_events is append-only' USING ERRCODE = '23514';
END $$;

CREATE OR REPLACE FUNCTION "leave_events_order"() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  last_at timestamptz;
BEGIN
  SELECT max("created_at") INTO last_at FROM "leave_events" WHERE "leave_id" = NEW."leave_id";
  IF last_at IS NOT NULL AND NEW."created_at" <= last_at THEN
    NEW."created_at" := last_at + interval '1 millisecond';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER "leave_events_append_only"
  BEFORE UPDATE OR DELETE ON "leave_events"
  FOR EACH ROW EXECUTE FUNCTION "leave_events_append_only"();
CREATE OR REPLACE TRIGGER "leave_events_order"
  BEFORE INSERT ON "leave_events"
  FOR EACH ROW EXECUTE FUNCTION "leave_events_order"();

-- -----------------------------------------------------------------------------
-- No client reaches a table directly until the row-level policies (roadmap 8.2) exist:
-- row level security on, no policy, so the Data API answers nothing. The gateway connects as the
-- database owner.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  base record;
BEGIN
  FOR base IN SELECT "tablename" FROM pg_tables WHERE "schemaname" = 'public' LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', base."tablename");
  END LOOP;
END $$;
