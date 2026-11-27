-- =============================================================================
-- "איתך היום": the presence-only permission (D-478).
--
-- 1. role_permissions takes the resource `presence`, with the action `view`.
-- 2. Every role that may view leaves may see who of its holder's own unit is on base today, by name.
--
-- The permission reads no table of its own and adds none: the command gateway answers the names from the rows it
-- already reads, and no client reaches a table directly (D-203).
--
-- Non-destructive and idempotent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The permission vocabulary (D-040).
-- -----------------------------------------------------------------------------
ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_resource_check";
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_resource_check" CHECK ("resource" IN (
  'organization', 'unit_levels', 'units', 'command_ranks', 'seniority_overrides', 'soldiers', 'soldier_private',
  'memberships', 'tags', 'leave_types', 'leaves', 'leave_comments', 'internal_comments',
  'deployments', 'availability_rules', 'properties', 'roles', 'access_grants',
  'accounts', 'data_transfer', 'day_reports', 'presence'
));

-- -----------------------------------------------------------------------------
-- 2. Who views leaves sees who is with them (D-478).
-- -----------------------------------------------------------------------------
INSERT INTO "role_permissions" ("role_id", "organization_id", "resource", "action")
SELECT "role_id", "organization_id", 'presence', 'view'
FROM "role_permissions"
WHERE "resource" = 'leaves' AND "action" = 'view'
ON CONFLICT DO NOTHING;
