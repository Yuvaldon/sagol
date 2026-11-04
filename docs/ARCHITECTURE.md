# Sagol — Architecture & Iron Rules

Military reserve unit management and leave tracking. React + TypeScript + Tailwind, Vite,
native RTL (Hebrew), Light Mode default (Dark Mode added later as a second token set).

Sources of truth: entity and column names → `docs/schema.sql`. Decisions and their
reasons → `docs/DECISIONS.md`. Build order → `docs/ROADMAP.md`.

## Iron rules (non-negotiable)

1. **Layer separation.** Data, Logic and UI are fully separate. Never work on two layers in
   the same session. Each session starts from the contracts as input.
2. **Communication only through APIs.** A layer talks to a neighbour only through that
   neighbour's public API (`index.ts`). No layer touches another layer's internals.
3. **No hardcoded values.** Not strings, colors, sizes, keys, statuses, breakpoints, date
   formats, URL parameter names, ids or identities. Everything comes from `i18n`, `config`,
   `contracts`, theme tokens or the environment.
4. **No mock data.** The app starts empty. Reference data is created by users through
   management modules or validated import. Sample data lives inside test files only.
5. **Single source of truth.** Every fact is stored once. Anything derivable (ancestry,
   permissions, availability, "active") is derived, never stored by app code.
6. **No bypasses.** No code path skips validation or permission checks, in any mode.

## Layers and allowed dependencies

```
contracts  <-  domain  <-  data | logic  <-  ui  <-  app
    ^            config (contracts only)        i18n (leaf, used by ui and app)
```

| Layer     | Responsibility                                                         | May import                         |
|-----------|------------------------------------------------------------------------|------------------------------------|
| contracts | Zod schemas + inferred types, enums, repository/command/auth interfaces | `zod` only                        |
| domain    | Pure rules: policy, hierarchy, leave state machine, availability, filters | contracts, `@internationalized/date` (D-035) |
| config    | Constants: storage keys, view ids, breakpoints, palette keys, env schema | contracts                         |
| data      | Server-authoritative adapters (IndexedDB now, remote later)            | contracts, domain, config          |
| logic     | Use cases, query/mutation hooks, view state for the UI                 | contracts, domain, config          |
| ui        | Shell, view engines, modules, primitives, theme                        | contracts, config, i18n, logic     |
| i18n      | Typed Hebrew dictionary of every user-facing string (keys typed from it) | nothing                          |
| app       | Composition root: env, adapters, providers, router, mount              | all (through public APIs)          |

Enforced by `npm run check:layers` (dependency-cruiser). Other layers import a layer only
through its `index.ts` alias (`@contracts`, `@domain`, ...). No circular dependencies.

## Server-authoritative data layer (D-008)

The data layer is written as if it were the server:

- Adapters are constructed by `app` with a **session source** (who is signed in). They
  never accept an actor id from callers. In remote mode the server derives the actor from
  the token, so a client cannot claim to be someone else.
- **Reads** are filtered by the domain policy before they leave the adapter.
- **Writes** are validated (Zod schema → integrity → policy → domain invariants) inside one
  transaction, bump `version`, reject stale versions, and write audit events.
- **Workflow changes are commands**, not field updates: `createLeave`, `transitionLeave`,
  `rescheduleLeave`, `grantAccess`, `revokeAccess`, `requestAccountLink`,
  `reviewAccountLink`, `bootstrapOwner`, `moveUnit`, `changeMembership`, `importBatch`.
- Errors are typed results with stable codes (contracts). The UI maps codes to i18n.
  An invisible row answers `not_found`, never `forbidden` (D-046).
- The contract of an adapter is `DataAdapter` (contracts): `session`, `repositories`
  (one per table), `commands` (grouped by resource), `transfer` (import/export) and
  `changes`. It is built from an `IdentitySource` only (D-048). Create inputs carry
  caller-generated ids (D-044); inputs follow D-045; leave commands take
  `acknowledged_rule_ids` for soft rules (D-047).
- Every adapter must pass one shared **repository contract test suite**. The remote adapter
  (phase 8) passes the same suite, which is what makes the switch safe.
- Repositories expose change subscriptions, so the UI has one live source of truth
  across tabs and views.

## Identity and access (D-001 … D-006)

- **Authentication:** Google only, behind the `AuthProvider` contract. `local` provider in
  development. The production build fails if `VITE_AUTH_MODE=local`.
- **Accounts:** `soldier_accounts` links a provider identity to a soldier. Commanders may
  create soldiers with names only (personal ID and email optional). Linking is automatic
  only on personal ID + verified invite email match. Anything else becomes an
  `account_link_requests` row. Domain proposes candidate matches (personal ID, then
  normalized names) to the reviewer only, and approval fills missing fields on either side
  (D-030). Unlinked accounts see nothing, and requesters never learn whether a match exists.
- **Bootstrap:** the first sign-in on an empty organization becomes owner only if its
  verified email matches the server secret `BOOTSTRAP_OWNER_EMAIL`. Atomic server function.
  Locally, the same flow makes the developer the owner.
- **Authorization:** effective permissions = baseline role (self) ∪ rank bindings (general,
  per rank) ∪ active access grants (individual). Both bindings and grants use one scope
  model (D-028): an anchor (`self`, `organization`, the home unit, N levels up, the ancestor
  at a level, an absolute unit, or a soldier) plus `include_descendants`, optionally limited
  by subject rank against **effective seniority** (rank seniority unless a personal
  override is active, D-029). Implemented once in `domain/policy`, consumed by the local
  adapter, by `logic` for UI hints ("can I?"), and mirrored by Postgres
  `has_permission()` + RLS.
- **Targets:** a permission is checked against a soldier, a unit or the organization.
  Organization-wide data can be viewed from any scope and changed only at organization
  scope. A soldier's unit is the primary membership today. Only active, linked soldiers
  hold permissions (D-053 … D-058).
- **Invariant:** at least one soldier always holds organization-scope access management,
  without expiry (D-059). Nobody grants pairs they do not hold (D-060).
- **Test matrix:** one table-driven matrix (actor × resource × action × target → allowed)
  runs against `domain/policy` now and against the database policies in phase 8.

## Hierarchy (D-009, D-010)

`units.parent_id` is the only source of ancestry. `domain/hierarchy` derives ancestors,
descendants and depth, and rejects cycles. Postgres keeps a trigger-maintained
`unit_closure` as a derived index. A soldier's unit comes from time-bounded
`unit_memberships`, so history is kept and attachments or temporary units need no schema
change.

## Availability (D-012, D-014)

`domain/availability` computes, for a date range, exactly **one status per soldier per
day** plus the leaves covering it. A soldier is unavailable if any approved leave whose
effective effect (the leave's override, else its type's effect) is `unavailable` covers the
day. Present/absent lists are a partition: each soldier appears once, in one list, and
markers are annotations on that entry (D-032, enforced by a test).

`availability_rules` are evaluated per target (scope unit × canonical population × group
value × day) → `{ required, actual, status }`. Global rules (no scope unit) cover the whole
organization. `group_by` splits one rule per tag or rank. On the same target the
higher-`priority` rule is effective and the others show as overridden. At equal priority
all apply. Min/max conflicts are reported as configuration errors (D-031). Commands that
change leaves evaluate affected rules: soft violations need an acknowledgment stored in
`leave_events`, hard violations are rejected by the adapter/server.

## Filters (shared model)

One `FilterExpression` schema (contracts) and evaluator (domain) is used by view filters,
saved views (later) and rule populations. A filter means the same thing everywhere.

## Workspace, routing and view state (D-023)

- One main workspace route. Management modules and details open as floating surfaces:
  side drawer on desktop, bottom sheet on mobile. Navigation is a floating top bar on
  desktop and a bottom bar on mobile.
- All view state lives in **typed URL search params** (TanStack Router + Zod): active view
  id, date window, filters, open panel and its entity. Switching views keeps filters. Deep
  links and the back button work. Parameter names come from `config`.
- Other routes exist only for sign-in and onboarding.

## View engines (inside `ui/engines`)

Each engine (timeline, calendar, list, table/agenda) is a self-contained module:

1. **core:** pure logic (date math, layout, lanes for overlaps, collisions, drag), no React,
   no domain knowledge. Unit-tested.
2. **view:** React rendering of a neutral model (resources and time-bound items).
3. **adapter:** the only place translating domain entities (soldier, leave, availability)
   into that model.

A registry maps view ids (from `config`) to engines. The central viewport is a pluggable
container that passes the same query and filter state to whichever engine is active.
Replacing an engine replaces one registry entry. Engines never call each other.

## Design system

- Tailwind's default palette and spacing scale are reset. Only semantic tokens exist
  (`--color-surface`, `--color-text-muted`, `--color-status-pending`, ...). Light set now,
  dark set later.
- User-chosen colors are **palette keys** (`color_key`). The closed list of palette keys is
  in `config`, and each key maps to a token pair for light/dark in the theme.
- Only logical (RTL-safe) properties: `ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`, never
  `left`/`right`/`ml`/`mr`.
- `docs/Design.md` is derived from the first built component (D-024) and binds all later
  UI work.

## Environment

`.env.example` lists every variable. `config` defines the env Zod schema, and `app`
parses `import.meta.env` at startup and fails fast on invalid values. Variables: auth mode,
data adapter, remote URL/keys (phase 8). Server-only secrets (`BOOTSTRAP_OWNER_EMAIL`)
never reach the client bundle.

## Folder structure (target)

```
src/
  contracts/   entities/ inputs/ enums/ filters/ permissions/ repositories/ commands/ auth/ errors/
  domain/      policy/ hierarchy/ leaves/ availability/ filters/ properties/
  config/      env/ storage/ views/ url/ breakpoints/ palette/
  data/        local/ (dexie schema, migrations, repositories, commands)  remote/ (phase 8)
               contract-tests/
  logic/       services/ queries/ mutations/ view-state/ session/
  ui/          theme/ primitives/ patterns/ shell/ modules/ engines/{registry,timeline,calendar,list,table}/
  i18n/        he/ keys
  app/         env/ composition/ providers/ router/
supabase/      migrations/ policies/ functions/ tests/   (phase 8)
e2e/           Playwright specs
docs/          ARCHITECTURE.md schema.sql DECISIONS.md ROADMAP.md Design.md sessions/
```

## Quality gates

`npm run check` = typecheck (strict) + lint + layer boundaries + raw-value scan + i18n key
check + unit tests. CI also runs build (with production env validation) and Playwright
(desktop + mobile, RTL, axe). A pre-commit hook runs the fast subset. Guardrail details:
`docs/ROADMAP.md`, session 0.2.

## Open decisions

- Backend provider (Supabase recommended, D-027), decided at phase 8.
