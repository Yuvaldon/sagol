# Sagol — Decision Log

Every architectural or product decision that shapes code is recorded here. A decision is
changed only by adding a new entry that supersedes it, never by editing history.
Format: `D-NNN — title` · date · status · decision · reason.

---

## D-001 — One person entity: every user is a soldier
2026-11-03 · accepted
Every user of the system is a `soldiers` row. There is no separate "user" or "person"
entity. Authentication identities are linked to a soldier through `soldier_accounts`.
**Why:** product owner decision. One identity model keeps permissions and audit simple.

## D-002 — Command rank is the single user-defined "level" of a soldier
2026-11-03 · accepted · supersedes the "military rank vs position" question
Each soldier has exactly one `command_rank` (e.g. fighter, squad commander, platoon
commander). Ranks are created, renamed, reordered and colored by users. Their ordering is
`seniority` (an integer users can change in any direction). There is no separate military
rank entity; if one is needed it is modeled as a tag category.
**Why:** product owner described one fixed, user-defined rank per soldier. Military rank
(e.g. sergeant) carries no business logic and fits the tag model.

## D-003 — Permissions are data: roles, rank bindings and grants
2026-11-03 · accepted
- `roles` are user-defined permission sets; `role_permissions` lists `(resource, action)`.
- Resources and actions are a closed vocabulary in contracts (code branches on them).
  Everything else (names, which role does what, who holds it) is data.
- Effective permissions of a soldier = union of:
  1. the organization's **baseline role** applied to `self` (every active linked soldier);
  2. **rank bindings**: default roles of the soldier's command rank, scoped *relative* to the
     soldier's primary unit (`self`, `home_unit`, `home_unit_tree`, `organization`);
  3. **access grants**: explicit, time-bounded, revocable grants to one soldier, scoped
     *absolutely* (a unit, a unit tree, a single soldier, or the organization).
- A permission can be limited by `subject_rank_constraint` (`any`, `junior`,
  `junior_or_equal`) to express "approve only those below me".
- Acting commanders, cross-unit temporary responsibility, and "a fighter allowed to
  approve" are all access grants with `valid_from`/`valid_to`. Revocation sets
  `revoked_at`; nothing is deleted.
- Effective permissions are **derived**, never stored. Moving a soldier to another unit
  moves their default scope automatically.
**Why:** supports arbitrary user-defined hierarchies plus vertical/lateral temporary
authority without duplicating data (single source of truth).

## D-004 — System administrator is a grant, not a flag
2026-11-03 · accepted · closes ARCHITECTURE open decision "source of admin flag"
"Administrator" means holding, at `organization` scope, the permissions to manage roles
and access grants. It is transferable like any grant. Invariant enforced server-side:
an organization always keeps at least one active soldier able to manage access
(no lockout).

## D-005 — Production bootstrap and account linking
2026-11-03 · accepted
- Sign-in is Google only, behind the `AuthProvider` contract.
- **Bootstrap:** on an organization with no accounts, the first sign-in whose verified
  email matches the server secret `BOOTSTRAP_OWNER_EMAIL` becomes the owner (atomic server
  function). The email lives in the server environment, never in source code.
  Without that match, nobody can claim an empty system.
- **Account creation, path 1:** a commander creates a soldier by personal ID (optionally
  with an invite email).
- **Account creation, path 2:** a person signs in with Google and enters their personal ID
  (and details) in onboarding.
- **Linking:** a sign-in is auto-linked to an existing soldier only when the personal ID
  matches **and** the soldier's invite email equals the verified Google email. Any other
  case creates an `account_link_requests` row that an authorized commander approves.
  The response never reveals whether a personal ID exists (no enumeration).
- An unlinked account sees no data.
**Why:** matching on a personal ID alone would let anyone who knows a soldier's ID take
over their record. This is the industry-standard "claim with verification" pattern.

## D-006 — Development mode is the real system with a local identity
2026-11-03 · accepted
`VITE_AUTH_MODE=local` uses a local identity provider and the local data adapter.
On an empty local store the same bootstrap flow makes the developer the owner, so all
permissions are granted *by the real policy*, not by bypassing it. A dev-only identity
switcher allows testing as other soldiers. The production build fails if the auth mode is
local. There is no code path that skips permission checks.

## D-007 — New pure layer: `domain`
2026-11-03 · accepted
`src/domain` holds pure functions (no I/O, no React, no framework): permission policy,
hierarchy (ancestry, cycle detection), leave state machine, availability and rule
evaluation, filter evaluation. It imports `contracts` only. Both `data` and `logic` use it.
**Why:** the local adapter must enforce exactly what the server will enforce. One policy
implementation feeds the local adapter, the UI's "can I?" hints, and the test matrix that
later verifies the Postgres RLS policies.

## D-008 — Server-authoritative data layer
2026-11-03 · accepted
The data adapter behaves like a server: it derives the actor from the session it was
constructed with (never from a parameter the caller passes), filters every read by
permission, validates every write, enforces integrity, and writes audit events.
Workflow changes (approve, reject, cancel, reschedule, link account, grant access) are
**commands**, not raw updates. In remote mode the same commands are server functions
and RLS policies.

## D-009 — Unit hierarchy: `parent_id` is the only source of truth
2026-11-03 · accepted
`units.path` is removed. Ancestry is derived: computed by `domain` locally; in Postgres a
closure table maintained only by triggers (a derived index, never written by app code).
Cycles are rejected in `domain` and by a database trigger. Levels above, below or beside
the current root can be added at any time by re-parenting.
User-defined `unit_levels` (e.g. battalion, company, platoon) classify units.

## D-010 — Memberships are time-bounded rows from day one
2026-11-03 · accepted
A soldier's unit is a `unit_memberships` row (`primary` or `attached`, with
`valid_from`/`valid_to`). The MVP uses only one open primary membership per soldier
(database exclusion constraint). Changing a unit closes one row and opens another, which
keeps history (where a soldier was when a leave happened). Attachments, temporary task
units (`units.kind = 'temporary'`) and simulations are future features that need no
schema change.

## D-011 — Multi-tenant from day one
2026-11-03 · accepted
Every table carries `organization_id`. The MVP runs one organization (company "Sagol").
The tenant boundary is independent of the unit tree: levels above the company (battalion)
are added inside the same organization.

## D-012 — Leaves: whole days, overlaps allowed, availability by union
2026-11-03 · accepted
- Dates are whole days (`start_date`, `end_date` inclusive). Times may be added later as
  extra optional columns (additive change).
- A soldier may have overlapping leaves (e.g. an approved leave plus a sick note plus an
  exam marker). Availability per day = the soldier is unavailable if *any* approved leave of
  an `unavailable` type covers that day. Counts and summaries use that union, so overlaps
  never double count.
- `leave_types.availability_effect` distinguishes real absence (`unavailable`) from markers
  (`available`, e.g. an exam during a leave). `leave_type_groups` (user-defined) separate
  categories like vacation vs course vs mission.
- `leave_batches` group leaves created together (collective leave, rotation round).
- Status is the authoritative current state. `leave_events` is an append-only audit trail.
  Comments live in `leave_comments` with `shared` or `internal` visibility.
- `version` column on every mutable row gives optimistic concurrency (two commanders
  dragging the same leave).

## D-013 — Approval behavior
2026-11-03 · accepted
- New leaves are `pending` by default.
- A creator who holds `leaves:approve` over the subject soldier may create or move a leave
  as `approved` in one step. A per-soldier preference sets the default of that choice.
  The server re-checks the permission. A fighter can never self-approve without it.
- When an approved leave is moved, the organization setting `reschedule_policy` decides:
  keep approved if the actor can approve, or always return to pending.
- The leave type does not affect who approves (permissions do).

## D-014 — Availability rules (replaces "readiness_rules")
2026-11-03 · accepted
Users with permission define `availability_rules`: "at least / at most N (or N%) of
*population* must be available, in *scope*, during *validity*".
- **Scope:** a unit tree, or each descendant unit at a chosen level, or each direct child.
- **Population:** a filter expression (the same filter model the views use): tags (medics,
  drivers), command ranks or seniority (commanders), etc.
- **Metric:** count or percent; `min_value` and/or `max_value`.
- **Validity:** always, a date range (heightened alert), or a deployment.
- **Enforcement:** `soft` (warn and require an acknowledgment that is logged) or `hard`
  (the server blocks the change). Chosen by the rule's author.
- Evaluation is a pure `domain` function over memberships + approved leaves for a date
  range. It powers warnings while approving or dragging, and the timeline "heat" row.
- Option `count_pending_as_unavailable` supports planning ahead.

## D-015 — Tags have categories with selection mode
2026-11-03 · accepted
`tag_categories` (user-defined, e.g. civilian / military / marital status) with
`selection_mode` `single` or `multiple`. A tag inherits its category color unless it has
its own.

## D-016 — Notion-like custom properties
2026-11-03 · accepted
Users can add typed properties to soldiers, units and leaves through
`property_definitions` (text, number, date, boolean, select, multi-select, soldier
reference, unit reference). Values live in the entity's `properties` JSONB, keyed by
definition id (renames are safe) and validated against the definition.
Concepts that business logic depends on (dates, status, unit, rank, tags) stay
first-class columns and tables, never custom properties.

## D-017 — Soft delete and audit columns
2026-11-03 · accepted
Reference and mutable entities carry `created_at`, `created_by`, `updated_at`,
`updated_by`, `version`, `archived_at`. "Delete" in the UI archives. Archived rows stay
referenceable, so history and rule filters never break. Purging is a separate admin
operation, out of MVP scope. Leaves are cancelled, not archived.

## D-018 — Sensitive fields are separated
2026-11-03 · accepted
Personal ID and contact details live in `soldier_private` with its own permission
resource, so row-level security can protect them separately from the public profile.

## D-019 — Derived state is never stored
2026-11-03 · accepted
`deployments.is_active` is removed (derived from dates). Unit paths are derived.
Effective permissions are derived. Availability is derived.

## D-020 — Contracts hold Zod schemas
2026-11-03 · accepted · amends ARCHITECTURE "contracts = types only"
`contracts` defines entities, inputs and settings as Zod schemas, and the TypeScript types
are inferred from them. One definition gives compile-time types and runtime validation
(data adapter, forms, URL search params, environment). `contracts` may import `zod` and
nothing else. It still contains no behavior.

## D-021 — Local adapter uses IndexedDB
2026-11-03 · accepted
The local data adapter uses IndexedDB (through Dexie), not localStorage: real
transactions, indexes, no 5 MB limit, versioned migrations, live queries.

## D-022 — Initial data without mock data: import/export
2026-11-03 · accepted
Real initial data is entered through validated CSV/JSON import (preview, validation
report, then commit through the same commands), plus full organization export/backup.
The same export lets a developer move local data to the real backend. Management screens
exist independently of first run; empty states guide the user to the next step. No
first-run wizard is required.

## D-023 — Single-screen workspace
2026-11-03 · accepted
The product is one main workspace: the central viewport shows the active view engine and
everything else opens in floating surfaces (side drawer on desktop, bottom sheet on
mobile, popovers). Management modules (units, ranks, roles, tags, leave types, rules,
properties) are drawer modules, not separate pages. All view state (view id, date range,
filters, open panel) lives in typed URL search params, so switching views keeps filters
and deep links and the back button work.

## D-024 — First designed component
2026-11-03 · accepted
The design language (Design.md) is derived from the **workspace frame** (floating
navigation, filter bar, empty viewport state) **plus the drawer/sheet hosting the units
tree module**. That covers the central screen and the pattern every action uses, with
content simple enough to get right first.

## D-025 — i18n and theme tokens inside UI sessions
2026-11-03 · accepted
Strings and tokens needed by a UI feature are added in that UI session, under these
rules: keys are typed (a missing key is a compile error), no string or color literal
appears in components, and tooling detects unused keys and raw values.

## D-026 — Libraries
2026-11-03 · accepted (exact versions pinned in session 0.2)
TanStack Router (typed search params), TanStack Query (cache and optimistic updates),
TanStack Table (table engine), TanStack Virtual (long lists and timeline rows),
TanStack Form, React Aria Components (accessible primitives with first-class RTL),
`@internationalized/date` (the only date library; calendar and timezone aware),
`motion` (sheet gestures and transitions), `@dnd-kit` (sortable lists), Zod, Dexie.
Timeline drag is implemented in the engine's pure core with pointer events.
Testing: Vitest, Testing Library, Playwright (mobile and desktop, RTL), axe.

## D-028 — Unified scope model with relative anchors
2026-11-03 · accepted · supersedes the scope part of D-003
Rank bindings and access grants share one scope structure:
`anchor_type` + `include_descendants`, where the anchor is one of
- `self`, `organization`;
- relative to the soldier's primary unit: `home_unit`, `home_ancestor_steps` (N levels up),
  `home_ancestor_at_level` (the ancestor at a given unit level);
- absolute: `unit`, `soldier`.

This lets a role's tree attachment change up, down or sideways, generally (on a rank
binding: "every squad commander sees the whole platoon" = ancestor 1 step up +
descendants) or individually (on a grant to one soldier: "squad commander A of platoon 1
only"). Relative anchors follow the soldier when their membership changes. Absolute
anchors do not.

## D-029 — Effective seniority with personal overrides
2026-11-03 · accepted · extends D-002
A soldier's effective seniority is their rank's `seniority`, unless an active
`seniority_overrides` row exists (temporary with `valid_to`, or permanent without it, at
most one active per soldier per day). Changing a rank's seniority affects every holder at
once. An override affects one soldier. `subject_rank_constraint` (junior / junior or
equal) always compares effective seniority. Effective seniority is derived, never stored.

## D-030 — Account linking without email
2026-11-03 · accepted · refines D-005
Commanders are not required to collect emails or personal IDs:
`soldier_private.personal_id` becomes optional. Linking rules:
- **Auto-link** only on personal ID match + invite email equal to the verified Google
  email (the only case that needs no human).
- **Otherwise** onboarding creates an `account_link_requests` row. Domain computes
  **candidate matches** (exact personal ID, then normalized first + last name) and shows
  them only to the reviewer, never to the requester. The reviewer is a soldier with
  `accounts:approve` over the candidate's unit (no candidate → organization-scope
  approvers). The reviewer links to a candidate, creates a new soldier, or rejects.
- On approval, missing fields on the soldier (personal ID, names) are filled from the
  request. That is the two-way enrichment: whichever side has the data provides it.
- Security holds because nothing is linked without verified email or human approval, and
  the requester never learns whether a match exists.

## D-031 — Availability rules: grouping, global scope, priority
2026-11-03 · accepted · extends D-014
- **Tags and ranks:** the population filter selects by tags (drivers, medics), ranks,
  seniority, or any combination, with multi-select.
- **Grouping:** `group_by` (`none`, `tag`, `command_rank`, optionally restricted to one tag
  category) evaluates the rule separately for each group value. "Always keep at least 2 of
  every selected tag" is one rule: population = the selected tags, group_by = tag,
  min = 2.
- **Global:** `scope_unit_id` NULL means the whole organization.
- **Priority:** every applicable rule is evaluated, and all must hold. When two rules
  evaluate the same **target** (same scope unit, same canonical population, same group
  value, same day), the one with the higher `priority` is effective and the other is
  shown as overridden. Equal priority: both apply, so the strictest wins.
  Example: global "≥2 per tag" (priority 0) and "≥3 medics in platoon 1 during alert"
  (priority 10): medics in platoon 1 during the alert need 3; all else needs 2.
- **Configuration conflicts** (an effective min above an effective max on the same target)
  are detected by domain and shown in the rules module.

## D-032 — Leave types are user-managed. Availability is a partition.
2026-11-03 · accepted · extends D-012
- Leave type groups and leave types (name, palette color key, icon key, availability
  effect, requires reason, order) are created and managed by authorized users. Nothing is
  predefined.
- Default availability effect of a new type is `unavailable`. A single leave may override
  its type's effect (`leaves.availability_effect_override`).
- **Invariant:** for every soldier and day, domain computes exactly one availability status
  (`available` / `unavailable`) plus the list of leaves covering that day. Unavailable if
  any approved leave whose effective effect is `unavailable` covers the day. Present/absent
  lists are a partition of the population: every soldier appears in exactly one list,
  once. Markers (e.g. an exam) are shown as annotations on that single entry. A test
  enforces the invariant.

## D-033 — Simple first-run setup wizard
2026-11-03 · accepted · amends D-022
A guided setup wizard walks through organization → unit levels → units → command ranks →
roles and rank bindings → leave types → tag categories and tags, with an explanation per
step. It reuses the management module forms and the same commands, so there is no second
code path. Each step can be skipped and revisited. Step completion is **derived from
existing data**, not stored as a flag. Import/export (D-022) stays as well.

## D-027 — Backend target (provisional)
2026-11-03 · proposed
Supabase is recommended: Postgres matches `schema.sql`, Row Level Security matches the
server-authoritative policy model, Google OAuth is built in, and SQL functions host the
commands. Cloudflare D1 is SQLite without RLS, so all authorization would live in Worker
code. Final decision at phase 8. Creating the account and project is done by the owner.

## D-034 — Icons: lucide-react
2026-11-03 · accepted · extends D-026
`lucide-react` is the icon library. Schema `icon_key` values are semantic keys; the UI theme
maps each key to a lucide icon. Components never pick icons by free-form name.
**Why:** product owner decision in session 0.2; it was already in the skeleton.

## D-035 — domain may import `@internationalized/date`
2026-11-03 · accepted · amends D-007
`domain` imports `contracts` and `@internationalized/date` and nothing else. The library is
pure (no I/O, no React) and is the only date library (D-026). Availability, leave and rule
evaluation need calendar arithmetic. The JavaScript `Date` stays forbidden outside the date
adapter (raw-value scan). Enforced by `.dependency-cruiser.cjs`.
**Why:** product owner decision in session 0.2.

## D-036 — Type assertions only in adapters and tests
2026-11-03 · accepted
`as` assertions (other than `as const`) are a lint error except in `src/data/**`,
`src/ui/engines/*/adapter/**` and `*.test.ts(x)`. Tests may pass deliberately invalid input
to prove validation rejects it. `any` and non-null assertions are forbidden everywhere.
**Why:** product owner decision in session 0.2. Adapters sit on untyped boundaries
(IndexedDB, remote payloads) and validate there.

## D-037 — Node 24 LTS and exact dependency versions
2026-11-03 · accepted
Node is pinned to 24 LTS (`.nvmrc` 24.12.0, `engines` `>=24.12.0 <25`, `engine-strict`).
Every dependency is pinned to an exact version (`.npmrc` `save-exact=true`), and
`package-lock.json` is committed. Tooling scripts are TypeScript run directly by Node
(type stripping), so they use erasable syntax only.
**Why:** product owner decision in session 0.2. Reproducible installs locally and in CI.

## D-038 — Contract field names are the schema column names
2026-11-04 · accepted
Contract schemas use the exact `snake_case` table and column names of `docs/schema.sql`
(`first_name`, `command_rank_id`). No camelCase mapping exists in any layer: IndexedDB,
the remote adapter and the UI see the same names as Postgres.
**Why:** product owner decision in session 1.1a. One name per fact removes a mapping layer
and makes the drift test exact.

## D-039 — The schema drift test lives in contracts
2026-11-04 · accepted
`src/contracts/schema-drift.test.ts` reads `docs/schema.sql` and fails when a table, a
column, nullability, a length, a value type or a CHECK vocabulary differs from the
contracts. `.dependency-cruiser.cjs` allows contracts **test files only** to read
`docs/schema.sql`. Production contracts code still imports `zod` only.
`unit_closure` has no contract: it is a Postgres-only derived index (D-009, D-019).
**Why:** product owner decision in session 1.1a.

## D-040 — Valid permission combinations
2026-11-04 · accepted · refines D-003
Only these `(resource, action)` pairs are valid. Contracts lists them
(`PERMISSION_ACTIONS_BY_RESOURCE`, `Permission`), and the `role_permissions` contract
rejects any other pair.

| resource | actions |
|----------|---------|
| organization | view, update |
| unit_levels, units, command_ranks, tags, leave_types, deployments, availability_rules, properties, roles | view, create, update, delete |
| seniority_overrides | view, create, delete (= revoke) |
| soldiers | view, create, update, delete (= archive) |
| soldier_private | view, update |
| memberships | view, update |
| leaves | view, create, update, delete (= cancel), duplicate, approve, export |
| leave_comments, internal_comments | view, create |
| access_grants | view, create, delete (= revoke) |
| accounts | view, approve |
| data_transfer | export, import |

Assigning a tag to a soldier is `soldiers:update`. "delete" never hard-deletes (D-017).
**Why:** product owner decision in session 1.1a. A closed list keeps the roles screen free
of meaningless pairs such as `tags:approve`.

## D-041 — Settings defaults
2026-11-04 · accepted · refines D-013
- `OrganizationSettings.reschedule_policy`: `keep_if_can_approve` (default) or
  `always_pending`. With the default, moving an approved leave keeps it approved only if the
  actor holds `leaves:approve` over the soldier. Otherwise it returns to `pending`.
- `SoldierPreferences.create_leaves_as_approved`: default `false`. It only pre-selects
  the choice, and the server re-checks the permission.
- Both JSONB columns default to `{}`. The contract schemas fill in the defaults when they
  parse.
**Why:** product owner chose the reschedule default in session 1.1a. The preference
default is the conservative choice.

## D-042 — Date and time representation in contracts
2026-11-04 · accepted
`DATE` columns are ISO calendar-date strings (`YYYY-MM-DD`). `TIMESTAMPTZ` columns are
ISO 8601 date-time strings with an offset. Contracts cannot import a date library
(D-020), so domain converts them with `@internationalized/date` (D-035). `NUMERIC`
columns are numbers.

## D-043 — Open items live in one file
2026-11-04 · accepted
`docs/OPEN_ITEMS.md` is the single source of truth for work one session leaves for another.
Each item has a permanent id (`OI-NNN`), a target session (roadmap number, or a layer when
not fixed yet), its source session, a status and notes. Every session reads it at the start
and takes in scope the open items targeted at it. At the end it closes what it resolved,
adds new items, and its handoff refers to items by id instead of copying them. Rows are
never deleted. An item not resolved in its target session is moved explicitly, with a reason.
**Why:** product owner decision in session 0.3. Sessions read only the latest handoff, so an
item aimed several sessions ahead (e.g. leave filters for 3.3) could be lost.

## D-044 — Ids of new rows are generated by the caller
2026-11-04 · accepted
Every create input carries its own `id` (UUID), generated by the caller. The adapter
rejects an id that is already taken (`already_exists`). Server-side defaults stay in
`schema.sql` for rows created outside the commands.
**Why:** product owner decision in session 1.1b. Optimistic updates (3.3) know the id at
once, an import batch can reference rows created earlier in the same batch, and moving an
export to the backend keeps every id.

## D-045 — Command input conventions
2026-11-04 · accepted
- Inputs are strict Zod objects: an unknown key (for example `status`, `organization_id`)
  is rejected, not dropped.
- Field names are column names of the target table (D-038), plus a closed set of command
  fields (`expected_version`, `changes`, `acknowledged_rule_ids`, `as_approved`, ...).
  A contracts test enforces it.
- Actor, organization, audit columns and versions are never input. The adapter takes them
  from the session (D-008). MVP: one organization per installation, so an unlinked identity
  (bootstrap, link request) belongs to that organization.
- Update = `{ id, expected_version, changes }` with at least one change. The adapter merges
  `changes` into the stored row and parses the merged row with the entity schema.
- Archive = `{ id, expected_version }`. Reorder = the full ordered list of
  `{ id, expected_version }`; `sort_order` is set only at creation and by reorder.
- Workflow columns change only through their command: `units.parent_id` (`moveUnit`),
  memberships (`changeMembership`), leave status and dates (`transitionLeave`,
  `rescheduleLeave`).
- Set-like child rows (`role_permissions`, `soldier_tags`, `deployment_members`) are
  replaced as a whole set, guarded by the parent's version.
- Commands are grouped by resource in `DataCommands` (`commands.leaves.transition`).
**Why:** product owner approved in session 1.1b.

## D-046 — Error model
2026-11-04 · accepted
Every command and query returns `Result<T>` (`{ ok: true, value } | { ok: false, error }`)
and never throws across a layer. `AppError.code` is one of `validation_failed` (with
`issues: { path, code }[]`), `rule_violation`, `rule_acknowledgment_required` (with
`violations`), `unauthenticated`, `account_not_linked`, `forbidden`, `not_found`,
`stale_version`, `bootstrap_not_allowed`, `unavailable`, `internal`. `IssueCode` unites
field codes, the row-check codes (`SchemaIssue`) and state codes (integrity, invariants,
domain rules). A row the actor may not view answers `not_found`, never `forbidden`, so
errors reveal nothing about rows outside the actor's scope.
**Why:** product owner approved in session 1.1b. ARCHITECTURE requires typed results
with stable codes; one vocabulary lets the UI map every code to i18n.

## D-047 — Soft-rule acknowledgment protocol
2026-11-04 · accepted · refines D-014
Commands that change leaves take `acknowledged_rule_ids`. If a hard rule would break, the
command fails with `rule_violation`. If a soft rule would break and its id is not
acknowledged, it fails with `rule_acknowledgment_required` and the violations. The UI
shows them and retries with the ids. The acknowledgment is stored in
`leave_events.acknowledged_rule_ids`. The command is the authority; live warnings in the
UI come from the same domain evaluation.
**Why:** product owner approved in session 1.1b.

## D-048 — Auth and session contracts
2026-11-04 · accepted
- `AuthMode` is the same vocabulary as `soldier_accounts.provider` (`IdentityProvider`):
  `google`, `local`. `DEVELOPMENT_ONLY_AUTH_MODES = ['local']` (D-006).
  `DataAdapterMode` = `local`, `remote`.
- The data adapter is constructed with an `IdentitySource` and resolves the session itself:
  `signed_out`, `unlinked` (signed in, no soldier: onboarding or bootstrap, sees no data)
  or `linked` (soldier and organization).
- `OnboardingState.bootstrap_available` is true only for the identity allowed to claim an
  empty organization.
- The local provider adds `signInAs` and `listIdentities` (the dev identity switcher).
  It changes who acts, never what the policy allows.
**Why:** product owner approved in session 1.1b.

## D-049 — Leave command set
2026-11-04 · accepted · extends D-012, D-013
`create`, `createBatch` (a collective leave in a `leave_batches` row, atomically),
`duplicate` (copies type, effect override, reason and properties of one leave to other
soldiers or dates; `leaves:duplicate`), `update` (type, effect override, reason,
properties), `reschedule` (dates), `transition` (`approve`, `reject`, `cancel`, `reopen`,
with an optional comment). Comments: `add`, `edit`, `archive`. Which transitions are
allowed from which status is domain's state machine (1.2).
**Why:** product owner approved in session 1.1b.

## D-050 — Import and export
2026-11-04 · accepted · refines D-022
`importBatch` is an ordered list of operations, each a command name and that command's
input. It runs inside one transaction, all or nothing. `dry_run` validates and reports
per operation without writing (the import preview). Export is
`{ format_version, exported_at, tables }` with every table's rows as stored, except the
derived `unit_closure`.
**Why:** product owner approved in session 1.1b. Import uses the same commands, so it
has no path around validation or permissions.

## D-051 — Phase audits are separate, read-only sessions
2026-11-04 · accepted
At the end of each phase the roadmap has an audit row (`A1` … `A8`). The product owner
opens it as its own session using `docs/AUDIT.md`. The audit reads and reports only: it
checks intent, decision coverage, test meaning, documentation sync, open-item health and
cross-session drift, which the automated checks do not cover. It does not report choices a
decision explains, work assigned to later sessions, or style, and it proposes no fixes.
Accepted findings become `OPEN_ITEMS.md` entries, recorded by a docs session, and are fixed
in the owning layer's session. Execution sessions never audit; they remind the owner when
an audit row is next or still pending.
**Why:** product owner decision in session 0.4. A review that also fixes would cross
layers and bypass the session rules; a review that re-checks automated gates wastes tokens.

## D-052 — Each session recommends the model and effort for the next one
2026-11-04 · accepted
The handoff and the closing message name the next roadmap row and recommend a Claude model
and effort level for it, with a one-line reason, following the guide in
`docs/sessions/TEMPLATE.md`. The owner decides.
**Why:** product owner decision in session 0.4, to spend tokens where judgment matters.
