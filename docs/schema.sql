-- =============================================================================
-- Sagol — PostgreSQL schema. Revision 3.1 (2026-11-03).
-- Single Source of Truth for entity and column names. `src/contracts` mirrors it;
-- a drift test keeps the two identical. Decisions: docs/DECISIONS.md (D-xxx).
--
-- Conventions
--   * Every table carries organization_id (tenant boundary, D-011).
--   * ids are UUID with server-side defaults.
--   * Mutable entities carry the audit block: created_at, created_by, updated_at,
--     updated_by, version (optimistic concurrency), archived_at (soft delete, D-017).
--   * Colors and icons are semantic keys resolved by the UI theme, never hex/asset paths.
--   * CHECK lists are closed vocabularies that code branches on; they mirror contract
--     enums. Anything users name, order or color is a row, never an enum.
--   * Derived data (unit ancestry, effective permissions, availability, "is active")
--     is never written by application code (D-019).
--   * Rows are archived, not deleted. ON DELETE is NO ACTION unless noted.
--
-- Revision 3 changes vs revision 2
--   + organizations, unit_levels, unit_closure (derived), unit_memberships,
--     soldier_private, soldier_accounts, account_link_requests, soldier_preferences,
--     roles, role_permissions, rank_role_bindings, access_grants, tag_categories,
--     leave_type_groups, leave_batches, leave_events, leave_comments,
--     deployment_members, availability_rules, property_definitions
--   - units.path, units-level uniqueness of code (now per organization)
--   - command_ranks.can_approve_leaves, command_ranks.rank_level  -> seniority + bindings
--   - soldiers.unit_id -> unit_memberships; soldiers.personal_id -> soldier_private
--   - soldiers.access_scope_path, soldiers.auth_user_id -> permissions model, accounts
--   - leaves.approved_by/manager_note/internal_notes/note_author_id
--       -> reviewed_by, leave_comments, leave_events
--   - leave_types.requires_admin (approval is governed by permissions, D-013)
--   - deployments.is_active (derived from dates)
--
-- Revision 3.1 changes vs revision 3
--   * unified scope columns (anchor_*) on rank_role_bindings and access_grants (D-028)
--   + seniority_overrides (D-029)
--   * soldier_private.personal_id optional; account_link_requests.claimed_personal_id optional (D-030)
--   * availability_rules: priority, group_by, group_tag_category_id, NULL scope = organization (D-031)
--   + leaves.availability_effect_override (D-032)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- -----------------------------------------------------------------------------
-- Tenancy
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "organizations" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"name" VARCHAR(100) NOT NULL,
	"timezone" VARCHAR(64) NOT NULL,                 -- IANA zone; defines "today"
	"baseline_role_id" UUID,                         -- FK added below (D-003)
	"settings" JSONB NOT NULL DEFAULT '{}',          -- validated by contracts OrganizationSettings
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"version" INTEGER NOT NULL DEFAULT 1,
	PRIMARY KEY("id")
);

-- -----------------------------------------------------------------------------
-- Hierarchy (D-009)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "unit_levels" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"name" VARCHAR(100) NOT NULL,
	"sort_order" INTEGER NOT NULL,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"created_by" UUID,
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_by" UUID,
	"version" INTEGER NOT NULL DEFAULT 1,
	"archived_at" TIMESTAMPTZ,
	PRIMARY KEY("id")
);

CREATE TABLE IF NOT EXISTS "units" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"name" VARCHAR(100) NOT NULL,
	"code" VARCHAR(50),
	"parent_id" UUID REFERENCES "units"("id"),       -- the ONLY source of ancestry
	"unit_level_id" UUID REFERENCES "unit_levels"("id"),
	"kind" VARCHAR(20) NOT NULL DEFAULT 'standing',
	"valid_from" DATE,                               -- used by temporary units
	"valid_to" DATE,
	"color_key" VARCHAR(30),
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"properties" JSONB NOT NULL DEFAULT '{}',        -- D-016
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"created_by" UUID,
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_by" UUID,
	"version" INTEGER NOT NULL DEFAULT 1,
	"archived_at" TIMESTAMPTZ,
	PRIMARY KEY("id"),
	CONSTRAINT "units_kind_check" CHECK ("kind" IN ('standing', 'temporary')),
	CONSTRAINT "units_not_own_parent" CHECK ("parent_id" IS NULL OR "parent_id" <> "id"),
	CONSTRAINT "units_validity_check" CHECK ("valid_to" IS NULL OR "valid_from" IS NULL OR "valid_to" >= "valid_from")
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_units_code" ON "units"("organization_id", "code") WHERE "code" IS NOT NULL;

-- DERIVED INDEX. Maintained exclusively by a trigger on units.parent_id
-- (insert/update/re-parent). Application code never writes it. Includes depth 0 self rows.
-- The same trigger rejects cycles.
CREATE TABLE IF NOT EXISTS "unit_closure" (
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"ancestor_id" UUID NOT NULL REFERENCES "units"("id") ON DELETE CASCADE,
	"descendant_id" UUID NOT NULL REFERENCES "units"("id") ON DELETE CASCADE,
	"depth" INTEGER NOT NULL,
	PRIMARY KEY("ancestor_id", "descendant_id")
);

-- -----------------------------------------------------------------------------
-- Ranks and soldiers (D-001, D-002, D-018)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "command_ranks" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"title" VARCHAR(100) NOT NULL,
	"short_title" VARCHAR(20),
	"seniority" INTEGER NOT NULL,                    -- higher = more senior; user-editable
	"color_key" VARCHAR(30),
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"created_by" UUID,
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_by" UUID,
	"version" INTEGER NOT NULL DEFAULT 1,
	"archived_at" TIMESTAMPTZ,
	PRIMARY KEY("id")
);

CREATE TABLE IF NOT EXISTS "soldiers" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"first_name" VARCHAR(50) NOT NULL,
	"last_name" VARCHAR(50) NOT NULL,
	"nickname" VARCHAR(50),
	"command_rank_id" UUID REFERENCES "command_ranks"("id"),  -- NULL only before ranks exist (bootstrap)
	"status" VARCHAR(20) NOT NULL DEFAULT 'active',
	"properties" JSONB NOT NULL DEFAULT '{}',
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"created_by" UUID REFERENCES "soldiers"("id"),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_by" UUID REFERENCES "soldiers"("id"),
	"version" INTEGER NOT NULL DEFAULT 1,
	"archived_at" TIMESTAMPTZ,
	PRIMARY KEY("id"),
	CONSTRAINT "soldiers_status_check" CHECK ("status" IN ('active', 'inactive'))
);

-- Sensitive fields, protected by their own permission resource ('soldier_private').
CREATE TABLE IF NOT EXISTS "soldier_private" (
	"soldier_id" UUID NOT NULL REFERENCES "soldiers"("id"),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"personal_id" VARCHAR(50),                       -- optional; filled by commander or by approved link (D-030)
	"invite_email" VARCHAR(255),                     -- optional; enables verified auto-link (D-005)
	"phone" VARCHAR(30),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_by" UUID REFERENCES "soldiers"("id"),
	"version" INTEGER NOT NULL DEFAULT 1,
	PRIMARY KEY("soldier_id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_soldier_private_personal_id"
	ON "soldier_private"("organization_id", "personal_id") WHERE "personal_id" IS NOT NULL;

-- Personal seniority, temporary (valid_to) or permanent (NULL). Effective seniority is
-- derived: active override, else the rank's seniority (D-029).
CREATE TABLE IF NOT EXISTS "seniority_overrides" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"soldier_id" UUID NOT NULL REFERENCES "soldiers"("id"),
	"seniority" INTEGER NOT NULL,
	"valid_from" DATE NOT NULL,
	"valid_to" DATE,
	"reason" TEXT,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"created_by" UUID REFERENCES "soldiers"("id"),
	"revoked_at" TIMESTAMPTZ,
	"revoked_by" UUID REFERENCES "soldiers"("id"),
	PRIMARY KEY("id"),
	CONSTRAINT "seniority_overrides_dates_check" CHECK ("valid_to" IS NULL OR "valid_to" >= "valid_from"),
	CONSTRAINT "seniority_overrides_one_active" EXCLUDE USING gist (
		"soldier_id" WITH =,
		daterange("valid_from", "valid_to", '[]') WITH &&
	) WHERE ("revoked_at" IS NULL)
);

-- Membership in units, time-bounded (D-010).
CREATE TABLE IF NOT EXISTS "unit_memberships" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"soldier_id" UUID NOT NULL REFERENCES "soldiers"("id"),
	"unit_id" UUID NOT NULL REFERENCES "units"("id"),
	"membership_type" VARCHAR(20) NOT NULL DEFAULT 'primary',
	"valid_from" DATE NOT NULL,
	"valid_to" DATE,                                 -- NULL = open
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"created_by" UUID REFERENCES "soldiers"("id"),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_by" UUID REFERENCES "soldiers"("id"),
	"version" INTEGER NOT NULL DEFAULT 1,
	PRIMARY KEY("id"),
	CONSTRAINT "unit_memberships_type_check" CHECK ("membership_type" IN ('primary', 'attached')),
	CONSTRAINT "unit_memberships_dates_check" CHECK ("valid_to" IS NULL OR "valid_to" >= "valid_from"),
	-- At most one primary membership per soldier on any given day.
	CONSTRAINT "unit_memberships_one_primary" EXCLUDE USING gist (
		"soldier_id" WITH =,
		daterange("valid_from", "valid_to", '[]') WITH &&
	) WHERE ("membership_type" = 'primary')
);

-- -----------------------------------------------------------------------------
-- Identity and accounts (D-005)
-- -----------------------------------------------------------------------------

-- Link between an authentication identity (provider user id) and a soldier.
CREATE TABLE IF NOT EXISTS "soldier_accounts" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"auth_user_id" UUID NOT NULL,                    -- id issued by the auth provider
	"soldier_id" UUID NOT NULL REFERENCES "soldiers"("id"),
	"provider" VARCHAR(30) NOT NULL,
	"email" VARCHAR(255) NOT NULL,                   -- verified by the provider
	"linked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"linked_by" UUID REFERENCES "soldiers"("id"),    -- NULL for verified auto-link / bootstrap
	"revoked_at" TIMESTAMPTZ,
	"revoked_by" UUID REFERENCES "soldiers"("id"),
	PRIMARY KEY("id"),
	CONSTRAINT "soldier_accounts_provider_check" CHECK ("provider" IN ('google', 'local')),
	CONSTRAINT "uq_soldier_accounts_auth_user" UNIQUE ("organization_id", "auth_user_id"),
	CONSTRAINT "uq_soldier_accounts_soldier" UNIQUE ("soldier_id")
);

CREATE TABLE IF NOT EXISTS "account_link_requests" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"auth_user_id" UUID NOT NULL,
	"email" VARCHAR(255) NOT NULL,
	"claimed_personal_id" VARCHAR(50),               -- optional; candidates also matched by name (D-030)
	"first_name" VARCHAR(50) NOT NULL,
	"last_name" VARCHAR(50) NOT NULL,
	"status" VARCHAR(20) NOT NULL DEFAULT 'pending',
	"resolved_soldier_id" UUID REFERENCES "soldiers"("id"),
	"reviewed_by" UUID REFERENCES "soldiers"("id"),
	"reviewed_at" TIMESTAMPTZ,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id"),
	CONSTRAINT "account_link_requests_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected', 'cancelled'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_account_link_requests_open"
	ON "account_link_requests"("organization_id", "auth_user_id") WHERE "status" = 'pending';

CREATE TABLE IF NOT EXISTS "soldier_preferences" (
	"soldier_id" UUID NOT NULL REFERENCES "soldiers"("id"),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"preferences" JSONB NOT NULL DEFAULT '{}',       -- validated by contracts SoldierPreferences
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"version" INTEGER NOT NULL DEFAULT 1,
	PRIMARY KEY("soldier_id")
);

-- -----------------------------------------------------------------------------
-- Permissions (D-003, D-004)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "roles" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"name" VARCHAR(100) NOT NULL,
	"description" TEXT,
	"color_key" VARCHAR(30),
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"created_by" UUID REFERENCES "soldiers"("id"),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_by" UUID REFERENCES "soldiers"("id"),
	"version" INTEGER NOT NULL DEFAULT 1,
	"archived_at" TIMESTAMPTZ,
	PRIMARY KEY("id")
);

-- Valid (resource, action) combinations are defined in contracts and checked by domain.
CREATE TABLE IF NOT EXISTS "role_permissions" (
	"role_id" UUID NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"resource" VARCHAR(40) NOT NULL,
	"action" VARCHAR(20) NOT NULL,
	PRIMARY KEY("role_id", "resource", "action"),
	CONSTRAINT "role_permissions_resource_check" CHECK ("resource" IN (
		'organization', 'unit_levels', 'units', 'command_ranks', 'seniority_overrides', 'soldiers', 'soldier_private',
		'memberships', 'tags', 'leave_types', 'leaves', 'leave_comments', 'internal_comments',
		'deployments', 'availability_rules', 'properties', 'roles', 'access_grants',
		'accounts', 'data_transfer'
	)),
	CONSTRAINT "role_permissions_action_check" CHECK ("action" IN (
		'view', 'create', 'update', 'delete', 'duplicate', 'approve', 'export', 'import'
	))
);

-- Scope columns (D-028), identical on rank_role_bindings and access_grants:
--   anchor_type          self | organization
--                        home_unit | home_ancestor_steps | home_ancestor_at_level  (relative, follow the soldier)
--                        unit | soldier                                            (absolute)
--   anchor_unit_id       required iff anchor_type = 'unit'
--   anchor_soldier_id    required iff anchor_type = 'soldier'
--   anchor_level_id      required iff anchor_type = 'home_ancestor_at_level'
--   anchor_steps         required iff anchor_type = 'home_ancestor_steps' (>= 1)
--   include_descendants  only for unit-type anchors
--   subject_rank_constraint  compares EFFECTIVE seniority (D-029)

-- Default roles of a command rank (general, per rank type).
CREATE TABLE IF NOT EXISTS "rank_role_bindings" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"command_rank_id" UUID NOT NULL REFERENCES "command_ranks"("id"),
	"role_id" UUID NOT NULL REFERENCES "roles"("id"),
	"anchor_type" VARCHAR(30) NOT NULL,
	"anchor_unit_id" UUID REFERENCES "units"("id"),
	"anchor_soldier_id" UUID REFERENCES "soldiers"("id"),
	"anchor_level_id" UUID REFERENCES "unit_levels"("id"),
	"anchor_steps" INTEGER,
	"include_descendants" BOOLEAN NOT NULL DEFAULT false,
	"subject_rank_constraint" VARCHAR(20) NOT NULL DEFAULT 'any',
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"created_by" UUID REFERENCES "soldiers"("id"),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_by" UUID REFERENCES "soldiers"("id"),
	"version" INTEGER NOT NULL DEFAULT 1,
	"archived_at" TIMESTAMPTZ,
	PRIMARY KEY("id"),
	CONSTRAINT "rank_role_bindings_anchor_check" CHECK ("anchor_type" IN (
		'self', 'organization', 'home_unit', 'home_ancestor_steps', 'home_ancestor_at_level', 'unit', 'soldier'
	)),
	CONSTRAINT "rank_role_bindings_anchor_args_check" CHECK (
		("anchor_unit_id" IS NOT NULL) = ("anchor_type" = 'unit') AND
		("anchor_soldier_id" IS NOT NULL) = ("anchor_type" = 'soldier') AND
		("anchor_level_id" IS NOT NULL) = ("anchor_type" = 'home_ancestor_at_level') AND
		("anchor_steps" IS NOT NULL) = ("anchor_type" = 'home_ancestor_steps') AND
		("anchor_steps" IS NULL OR "anchor_steps" >= 1) AND
		(NOT "include_descendants" OR "anchor_type" IN ('home_unit', 'home_ancestor_steps', 'home_ancestor_at_level', 'unit'))
	),
	CONSTRAINT "rank_role_bindings_subject_check" CHECK ("subject_rank_constraint" IN ('any', 'junior', 'junior_or_equal'))
);

-- Explicit, time-bounded, revocable grants to ONE soldier (individual).
-- Acting commanders, cross-unit responsibility, individual approvers, administrators.
CREATE TABLE IF NOT EXISTS "access_grants" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"grantee_soldier_id" UUID NOT NULL REFERENCES "soldiers"("id"),
	"role_id" UUID NOT NULL REFERENCES "roles"("id"),
	"anchor_type" VARCHAR(30) NOT NULL,
	"anchor_unit_id" UUID REFERENCES "units"("id"),
	"anchor_soldier_id" UUID REFERENCES "soldiers"("id"),
	"anchor_level_id" UUID REFERENCES "unit_levels"("id"),
	"anchor_steps" INTEGER,
	"include_descendants" BOOLEAN NOT NULL DEFAULT false,
	"subject_rank_constraint" VARCHAR(20) NOT NULL DEFAULT 'any',
	"valid_from" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"valid_to" TIMESTAMPTZ,                          -- NULL = until revoked
	"reason" TEXT,
	"granted_by" UUID REFERENCES "soldiers"("id"),   -- NULL only for bootstrap
	"granted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"revoked_at" TIMESTAMPTZ,
	"revoked_by" UUID REFERENCES "soldiers"("id"),
	PRIMARY KEY("id"),
	CONSTRAINT "access_grants_anchor_check" CHECK ("anchor_type" IN (
		'self', 'organization', 'home_unit', 'home_ancestor_steps', 'home_ancestor_at_level', 'unit', 'soldier'
	)),
	CONSTRAINT "access_grants_anchor_args_check" CHECK (
		("anchor_unit_id" IS NOT NULL) = ("anchor_type" = 'unit') AND
		("anchor_soldier_id" IS NOT NULL) = ("anchor_type" = 'soldier') AND
		("anchor_level_id" IS NOT NULL) = ("anchor_type" = 'home_ancestor_at_level') AND
		("anchor_steps" IS NOT NULL) = ("anchor_type" = 'home_ancestor_steps') AND
		("anchor_steps" IS NULL OR "anchor_steps" >= 1) AND
		(NOT "include_descendants" OR "anchor_type" IN ('home_unit', 'home_ancestor_steps', 'home_ancestor_at_level', 'unit'))
	),
	CONSTRAINT "access_grants_subject_check" CHECK ("subject_rank_constraint" IN ('any', 'junior', 'junior_or_equal')),
	CONSTRAINT "access_grants_validity_check" CHECK ("valid_to" IS NULL OR "valid_to" > "valid_from")
);

ALTER TABLE "organizations"
	ADD CONSTRAINT "organizations_baseline_role_fk" FOREIGN KEY ("baseline_role_id") REFERENCES "roles"("id");

-- -----------------------------------------------------------------------------
-- Tags (D-015)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "tag_categories" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"name" VARCHAR(100) NOT NULL,
	"selection_mode" VARCHAR(20) NOT NULL DEFAULT 'multiple',
	"color_key" VARCHAR(30) NOT NULL,
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"created_by" UUID REFERENCES "soldiers"("id"),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_by" UUID REFERENCES "soldiers"("id"),
	"version" INTEGER NOT NULL DEFAULT 1,
	"archived_at" TIMESTAMPTZ,
	PRIMARY KEY("id"),
	CONSTRAINT "tag_categories_selection_check" CHECK ("selection_mode" IN ('single', 'multiple'))
);

CREATE TABLE IF NOT EXISTS "tags" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"category_id" UUID NOT NULL REFERENCES "tag_categories"("id"),
	"name" VARCHAR(100) NOT NULL,
	"color_key" VARCHAR(30),                         -- NULL = inherit category color
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"created_by" UUID REFERENCES "soldiers"("id"),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_by" UUID REFERENCES "soldiers"("id"),
	"version" INTEGER NOT NULL DEFAULT 1,
	"archived_at" TIMESTAMPTZ,
	PRIMARY KEY("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_tags_name" ON "tags"("category_id", "name") WHERE "archived_at" IS NULL;

-- 'single' selection_mode is enforced by domain and by a trigger.
CREATE TABLE IF NOT EXISTS "soldier_tags" (
	"soldier_id" UUID NOT NULL REFERENCES "soldiers"("id") ON DELETE CASCADE,
	"tag_id" UUID NOT NULL REFERENCES "tags"("id"),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"created_by" UUID REFERENCES "soldiers"("id"),
	PRIMARY KEY("soldier_id", "tag_id")
);

-- -----------------------------------------------------------------------------
-- Leaves (D-012, D-013)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "leave_type_groups" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"name" VARCHAR(100) NOT NULL,
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"created_by" UUID REFERENCES "soldiers"("id"),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_by" UUID REFERENCES "soldiers"("id"),
	"version" INTEGER NOT NULL DEFAULT 1,
	"archived_at" TIMESTAMPTZ,
	PRIMARY KEY("id")
);

CREATE TABLE IF NOT EXISTS "leave_types" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"group_id" UUID REFERENCES "leave_type_groups"("id"),
	"name" VARCHAR(100) NOT NULL,
	"color_key" VARCHAR(30) NOT NULL,
	"icon_key" VARCHAR(40),
	"availability_effect" VARCHAR(20) NOT NULL DEFAULT 'unavailable',
	"requires_reason" BOOLEAN NOT NULL DEFAULT false,
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"created_by" UUID REFERENCES "soldiers"("id"),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_by" UUID REFERENCES "soldiers"("id"),
	"version" INTEGER NOT NULL DEFAULT 1,
	"archived_at" TIMESTAMPTZ,
	PRIMARY KEY("id"),
	CONSTRAINT "leave_types_effect_check" CHECK ("availability_effect" IN ('unavailable', 'available'))
);

CREATE TABLE IF NOT EXISTS "leave_batches" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"name" VARCHAR(255) NOT NULL,
	"description" TEXT,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"created_by" UUID REFERENCES "soldiers"("id"),
	PRIMARY KEY("id")
);

-- Overlapping leaves for one soldier are allowed by design (D-012).
CREATE TABLE IF NOT EXISTS "leaves" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"soldier_id" UUID NOT NULL REFERENCES "soldiers"("id"),
	"leave_type_id" UUID NOT NULL REFERENCES "leave_types"("id"),
	"batch_id" UUID REFERENCES "leave_batches"("id"),
	"start_date" DATE NOT NULL,
	"end_date" DATE NOT NULL,                        -- inclusive
	"status" VARCHAR(20) NOT NULL DEFAULT 'pending',
	"availability_effect_override" VARCHAR(20),      -- NULL = use the leave type's effect (D-032)
	"reason" TEXT,
	"reviewed_by" UUID REFERENCES "soldiers"("id"),
	"reviewed_at" TIMESTAMPTZ,
	"properties" JSONB NOT NULL DEFAULT '{}',
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"created_by" UUID REFERENCES "soldiers"("id"),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_by" UUID REFERENCES "soldiers"("id"),
	"version" INTEGER NOT NULL DEFAULT 1,
	PRIMARY KEY("id"),
	CONSTRAINT "leaves_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "leaves_effect_override_check" CHECK ("availability_effect_override" IS NULL OR "availability_effect_override" IN ('unavailable', 'available')),
	CONSTRAINT "leaves_dates_check" CHECK ("end_date" >= "start_date")
);

-- Append-only audit trail. No UPDATE/DELETE policy is ever granted.
CREATE TABLE IF NOT EXISTS "leave_events" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"leave_id" UUID NOT NULL REFERENCES "leaves"("id"),
	"actor_id" UUID NOT NULL REFERENCES "soldiers"("id"),
	"event_type" VARCHAR(20) NOT NULL,
	"from_status" VARCHAR(20),
	"to_status" VARCHAR(20),
	"changes" JSONB NOT NULL DEFAULT '{}',           -- before/after of changed fields
	"acknowledged_rule_ids" UUID[] NOT NULL DEFAULT '{}',  -- soft rules knowingly overridden (D-014)
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id"),
	CONSTRAINT "leave_events_type_check" CHECK ("event_type" IN (
		'created', 'updated', 'rescheduled', 'approved', 'rejected', 'cancelled', 'reopened'
	))
);

CREATE TABLE IF NOT EXISTS "leave_comments" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"leave_id" UUID NOT NULL REFERENCES "leaves"("id"),
	"author_id" UUID NOT NULL REFERENCES "soldiers"("id"),
	"body" TEXT NOT NULL,
	"visibility" VARCHAR(20) NOT NULL DEFAULT 'shared',  -- 'internal' requires resource internal_comments
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"edited_at" TIMESTAMPTZ,
	"archived_at" TIMESTAMPTZ,
	PRIMARY KEY("id"),
	CONSTRAINT "leave_comments_visibility_check" CHECK ("visibility" IN ('shared', 'internal'))
);

-- -----------------------------------------------------------------------------
-- Deployments (reserve duty periods)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "deployments" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"name" VARCHAR(255) NOT NULL,
	"unit_id" UUID NOT NULL REFERENCES "units"("id"),
	"start_date" DATE NOT NULL,
	"end_date" DATE,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"created_by" UUID REFERENCES "soldiers"("id"),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_by" UUID REFERENCES "soldiers"("id"),
	"version" INTEGER NOT NULL DEFAULT 1,
	"archived_at" TIMESTAMPTZ,
	PRIMARY KEY("id"),
	CONSTRAINT "deployments_dates_check" CHECK ("end_date" IS NULL OR "end_date" >= "start_date")
);

CREATE TABLE IF NOT EXISTS "deployment_members" (
	"deployment_id" UUID NOT NULL REFERENCES "deployments"("id"),
	"soldier_id" UUID NOT NULL REFERENCES "soldiers"("id"),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"start_date" DATE,                               -- NULL = deployment start
	"end_date" DATE,                                 -- NULL = deployment end
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"created_by" UUID REFERENCES "soldiers"("id"),
	PRIMARY KEY("deployment_id", "soldier_id"),
	CONSTRAINT "deployment_members_dates_check" CHECK ("end_date" IS NULL OR "start_date" IS NULL OR "end_date" >= "start_date")
);

-- -----------------------------------------------------------------------------
-- Availability rules (D-014)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "availability_rules" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"name" VARCHAR(255) NOT NULL,
	"description" TEXT,
	"is_enabled" BOOLEAN NOT NULL DEFAULT true,
	"priority" INTEGER NOT NULL DEFAULT 0,           -- higher wins on the same target (D-031)
	"enforcement" VARCHAR(10) NOT NULL DEFAULT 'soft',
	"scope_unit_id" UUID REFERENCES "units"("id"),   -- NULL = whole organization (global rule)
	"scope_mode" VARCHAR(30) NOT NULL DEFAULT 'unit_tree',
	"scope_level_id" UUID REFERENCES "unit_levels"("id"),
	"population_filter" JSONB NOT NULL DEFAULT '{}', -- contracts FilterExpression, shared with views
	"group_by" VARCHAR(20) NOT NULL DEFAULT 'none',  -- evaluate separately per tag / per rank
	"group_tag_category_id" UUID REFERENCES "tag_categories"("id"),
	"metric" VARCHAR(10) NOT NULL,
	"min_value" NUMERIC(7, 2),
	"max_value" NUMERIC(7, 2),
	"effective_from" DATE,
	"effective_to" DATE,
	"deployment_id" UUID REFERENCES "deployments"("id"),
	"count_pending_as_unavailable" BOOLEAN NOT NULL DEFAULT false,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"created_by" UUID REFERENCES "soldiers"("id"),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_by" UUID REFERENCES "soldiers"("id"),
	"version" INTEGER NOT NULL DEFAULT 1,
	"archived_at" TIMESTAMPTZ,
	PRIMARY KEY("id"),
	CONSTRAINT "availability_rules_enforcement_check" CHECK ("enforcement" IN ('soft', 'hard')),
	CONSTRAINT "availability_rules_scope_mode_check" CHECK ("scope_mode" IN ('unit_tree', 'each_child', 'each_descendant_at_level')),
	CONSTRAINT "availability_rules_level_check" CHECK (("scope_mode" = 'each_descendant_at_level') = ("scope_level_id" IS NOT NULL)),
	CONSTRAINT "availability_rules_group_check" CHECK ("group_by" IN ('none', 'tag', 'command_rank')),
	CONSTRAINT "availability_rules_group_category_check" CHECK ("group_tag_category_id" IS NULL OR "group_by" = 'tag'),
	CONSTRAINT "availability_rules_metric_check" CHECK ("metric" IN ('count', 'percent')),
	CONSTRAINT "availability_rules_threshold_check" CHECK ("min_value" IS NOT NULL OR "max_value" IS NOT NULL),
	CONSTRAINT "availability_rules_range_check" CHECK ("min_value" IS NULL OR "max_value" IS NULL OR "max_value" >= "min_value"),
	CONSTRAINT "availability_rules_percent_check" CHECK ("metric" <> 'percent' OR (
		("min_value" IS NULL OR "min_value" BETWEEN 0 AND 100) AND ("max_value" IS NULL OR "max_value" BETWEEN 0 AND 100)
	)),
	CONSTRAINT "availability_rules_dates_check" CHECK ("effective_to" IS NULL OR "effective_from" IS NULL OR "effective_to" >= "effective_from")
);

-- -----------------------------------------------------------------------------
-- Custom properties (D-016)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "property_definitions" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"entity_type" VARCHAR(20) NOT NULL,
	"label" VARCHAR(100) NOT NULL,
	"data_type" VARCHAR(20) NOT NULL,
	"options" JSONB NOT NULL DEFAULT '[]',           -- select options: id, label, color_key, sort_order
	"is_required" BOOLEAN NOT NULL DEFAULT false,
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"created_by" UUID REFERENCES "soldiers"("id"),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_by" UUID REFERENCES "soldiers"("id"),
	"version" INTEGER NOT NULL DEFAULT 1,
	"archived_at" TIMESTAMPTZ,
	PRIMARY KEY("id"),
	CONSTRAINT "property_definitions_entity_check" CHECK ("entity_type" IN ('soldier', 'unit', 'leave')),
	CONSTRAINT "property_definitions_type_check" CHECK ("data_type" IN (
		'text', 'number', 'date', 'boolean', 'select', 'multi_select', 'soldier_ref', 'unit_ref'
	))
);

-- -----------------------------------------------------------------------------
-- Audit FKs for tables declared before "soldiers"
-- -----------------------------------------------------------------------------

ALTER TABLE "unit_levels"   ADD CONSTRAINT "unit_levels_created_by_fk"   FOREIGN KEY ("created_by") REFERENCES "soldiers"("id");
ALTER TABLE "unit_levels"   ADD CONSTRAINT "unit_levels_updated_by_fk"   FOREIGN KEY ("updated_by") REFERENCES "soldiers"("id");
ALTER TABLE "units"         ADD CONSTRAINT "units_created_by_fk"         FOREIGN KEY ("created_by") REFERENCES "soldiers"("id");
ALTER TABLE "units"         ADD CONSTRAINT "units_updated_by_fk"         FOREIGN KEY ("updated_by") REFERENCES "soldiers"("id");
ALTER TABLE "command_ranks" ADD CONSTRAINT "command_ranks_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "soldiers"("id");
ALTER TABLE "command_ranks" ADD CONSTRAINT "command_ranks_updated_by_fk" FOREIGN KEY ("updated_by") REFERENCES "soldiers"("id");

-- -----------------------------------------------------------------------------
-- Indexes for the access patterns the app relies on
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "idx_units_parent_id"            ON "units"("organization_id", "parent_id");
CREATE INDEX IF NOT EXISTS "idx_unit_closure_descendant"    ON "unit_closure"("descendant_id");
CREATE INDEX IF NOT EXISTS "idx_memberships_unit"           ON "unit_memberships"("unit_id", "valid_from", "valid_to");
CREATE INDEX IF NOT EXISTS "idx_memberships_soldier"        ON "unit_memberships"("soldier_id");
CREATE INDEX IF NOT EXISTS "idx_soldiers_rank"              ON "soldiers"("organization_id", "command_rank_id");
CREATE INDEX IF NOT EXISTS "idx_seniority_overrides_soldier" ON "seniority_overrides"("soldier_id") WHERE "revoked_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_soldier_tags_tag"           ON "soldier_tags"("tag_id");
CREATE INDEX IF NOT EXISTS "idx_access_grants_grantee"      ON "access_grants"("grantee_soldier_id") WHERE "revoked_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_rank_role_bindings_rank"    ON "rank_role_bindings"("command_rank_id") WHERE "archived_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_leaves_soldier_dates"       ON "leaves"("soldier_id", "start_date", "end_date");
CREATE INDEX IF NOT EXISTS "idx_leaves_org_dates"           ON "leaves"("organization_id", "start_date", "end_date");
CREATE INDEX IF NOT EXISTS "idx_leaves_status"              ON "leaves"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "idx_leave_events_leave"         ON "leave_events"("leave_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_leave_comments_leave"       ON "leave_comments"("leave_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_deployments_unit_id"        ON "deployments"("unit_id");
CREATE INDEX IF NOT EXISTS "idx_availability_rules_scope"   ON "availability_rules"("scope_unit_id") WHERE "archived_at" IS NULL;

-- -----------------------------------------------------------------------------
-- Server-side objects specified here, implemented in phase 8 (supabase/migrations)
-- -----------------------------------------------------------------------------
-- Triggers:  unit_closure maintenance + cycle rejection; soldier_tags single-select;
--            version bump + updated_at; leave_events append-only; last-admin guard.
-- Functions: bootstrap_owner, request_account_link, review_account_link,
--            create_leave, transition_leave, reschedule_leave, grant_access,
--            revoke_access, has_permission(resource, action, target) used by RLS.
-- RLS:       enabled on every table; policies call has_permission(). Verified by the
--            same table-driven test matrix that tests the domain policy (D-007).
