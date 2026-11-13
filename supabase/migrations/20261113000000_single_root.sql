-- =============================================================================
-- One root per organization, and the soldiers' history in it (D-321, refines D-315).
--
-- 1. An organization whose live top-level units (no parent, not archived) are not exactly one gets
--    a root unit: the organization's name, standing, first in order.
-- 2. In those organizations, every other live top-level unit moves under the new root. Only
--    parent_id changes; the closure trigger keeps unit_closure, and every row is kept.
-- 3. Every soldier gets a primary membership in the organization's root for the days before the
--    first primary membership the soldier holds, from the day the soldier was created in the
--    organization's time zone to the day before. A non-archived soldier with no primary membership
--    at all gets one from that day, open-ended. Ranges end before the first one starts, so the
--    one-primary-per-day exclusion holds.
--
-- Additive and idempotent: after a run each organization has one live root and every soldier's
-- first primary membership starts on the day the soldier was created, so a second run finds nothing
-- to do. Constraints and row-level security are unchanged.
-- =============================================================================

DO $$
DECLARE
  organization RECORD;
  root UUID;
BEGIN
  FOR organization IN
    SELECT o."id", o."name"
    FROM "organizations" o
    WHERE (
      SELECT count(*) FROM "units" u
      WHERE u."organization_id" = o."id" AND u."parent_id" IS NULL AND u."archived_at" IS NULL
    ) <> 1
  LOOP
    INSERT INTO "units" ("organization_id", "name", "parent_id", "kind", "sort_order", "properties")
    VALUES (organization."id", organization."name", NULL, 'standing', 0, '{}')
    RETURNING "id" INTO root;
    UPDATE "units"
    SET "parent_id" = root, "updated_at" = now(), "version" = "version" + 1
    WHERE "organization_id" = organization."id" AND "parent_id" IS NULL AND "archived_at" IS NULL
      AND "id" <> root;
  END LOOP;
END $$;

INSERT INTO "unit_memberships" ("organization_id", "soldier_id", "unit_id", "membership_type", "valid_from", "valid_to")
SELECT s."organization_id", s."id", r."id", 'primary', s."created_on", s."first_from" - 1
FROM (
  SELECT s."id", s."organization_id", s."archived_at",
    (s."created_at" AT TIME ZONE o."timezone")::date AS "created_on",
    (SELECT min(p."valid_from") FROM "unit_memberships" p
     WHERE p."soldier_id" = s."id" AND p."membership_type" = 'primary') AS "first_from"
  FROM "soldiers" s
  JOIN "organizations" o ON o."id" = s."organization_id"
) s
JOIN "units" r ON r."organization_id" = s."organization_id" AND r."parent_id" IS NULL AND r."archived_at" IS NULL
WHERE s."first_from" > s."created_on"
   OR (s."first_from" IS NULL AND s."archived_at" IS NULL);
