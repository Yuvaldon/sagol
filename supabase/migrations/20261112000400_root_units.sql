-- =============================================================================
-- Every organization has a root unit (D-315, D-251, D-262).
--
-- 1. An organization without a live root unit (no parent, not archived) gets one: the
--    organization's name, standing, first in order. Claims since V27 create it (D-262); this
--    covers organizations created before.
-- 2. In those organizations only, each non-archived soldier without a current or future primary
--    membership gets one in the new root, from today in the organization's time zone, open-ended.
--
-- Additive and idempotent: an organization that already has a live root is not touched, and a
-- second run finds nothing to do. Constraints and row-level security are unchanged.
-- =============================================================================

WITH "missing" AS (
  SELECT o."id" AS "organization_id", gen_random_uuid() AS "unit_id", o."name",
    (now() AT TIME ZONE o."timezone")::date AS "today"
  FROM "organizations" o
  WHERE NOT EXISTS (
    SELECT 1 FROM "units" u
    WHERE u."organization_id" = o."id" AND u."parent_id" IS NULL AND u."archived_at" IS NULL
  )
), "roots" AS (
  INSERT INTO "units" ("id", "organization_id", "name", "parent_id", "kind", "sort_order", "properties")
  SELECT m."unit_id", m."organization_id", m."name", NULL, 'standing', 0, '{}'
  FROM "missing" m
  RETURNING "id"
)
INSERT INTO "unit_memberships" ("organization_id", "soldier_id", "unit_id", "membership_type", "valid_from", "valid_to")
SELECT s."organization_id", s."id", m."unit_id", 'primary', m."today", NULL
FROM "soldiers" s
JOIN "missing" m ON m."organization_id" = s."organization_id"
JOIN "roots" r ON r."id" = m."unit_id"
WHERE s."archived_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "unit_memberships" p
    WHERE p."soldier_id" = s."id" AND p."membership_type" = 'primary'
      AND (p."valid_to" IS NULL OR p."valid_to" >= m."today")
  );
