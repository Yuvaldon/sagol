# Sagol — Roadmap

Status of the work. The order, dependencies and contents of each slice are in
`docs/FEATURE_MAP.md`. One session = one vertical slice, one commit = one layer (D-075). Every
session:

1. starts with the reading rule in `CLAUDE.md` (D-081) and takes in scope every open item
   targeted at it (D-043);
2. commits layer by layer, in dependency order, through each layer's public API;
3. ends with `npm run check` and `npm run build` green, the slice's demo running in Playwright,
   `docs/OPEN_ITEMS.md` updated, and a handoff note `docs/sessions/NN-<name>.md` (done / how to
   see it / decisions / open item ids / next input).

Status: ☐ pending · ◐ in progress · ☑ done

Rows `A1` … `A7` are **audit sessions** (D-051, D-078): read-only, opened by the product owner,
following `docs/AUDIT.md`. An execution session never runs an audit. The session that finishes
the row before an audit reminds the owner to open it.

## Phase 0 — Foundations

| # | Track | Content | Status |
|---|-------|---------|--------|
| 0.1 | docs | Decisions log (D-001 … D-033), schema rev 3.1, architecture rev 2, roadmap, CLAUDE.md | ☑ |
| 0.2 | tooling | See guardrails below. Folder skeleton, deps pinned, env example + build guard, CI (D-034 … D-037) | ☑ |
| 0.3 | docs | `docs/OPEN_ITEMS.md` as the single open-items log; workflow files updated (D-043) | ☑ |
| 0.4 | docs | Audit process (`docs/AUDIT.md`, rows A1 … A8) and next-session model recommendation (D-051, D-052) | ☑ |
| 0.5 | docs | Decision index at the top of `DECISIONS.md`; OI-015 partly resolved with a new trigger (D-062) | ☑ |
| 0.6 | docs | `personal_id` = military personal number (D-069); invite links opened as OI-026 | ☑ |
| 0.7 | docs | Move to vertical slices: `docs/FEATURE_MAP.md`, Stone 3 direction (D-075 … D-082) | ☑ |
| 0.8 | docs | Record audit A1: `docs/audits/A1.md`, OI-034 … OI-042, D-083, D-084 | ☑ |

### Session 0.2 guardrails

- git repository + `.gitattributes` (LF), Node version pinned (`.nvmrc`, `engines`).
- Dependencies from D-026 installed and pinned.
- `.dependency-cruiser.cjs` updated for `domain`, plus per-folder rules inside `ui`
  (engines never import modules or each other; `core` folders never import React).
- tsconfig paths: add `@domain`.
- Tailwind: reset default palette/spacing in `@theme`; only semantic tokens.
- Lint (oxlint): no `any`, no non-null assertions, no unsafe casts outside adapters,
  react hooks rules, no JSX string literals (if oxlint lacks the rule, a custom scan).
- `scripts/check-raw-values`: fails on hex/rgb colors, arbitrary Tailwind values
  (`[...]`), physical direction classes (`ml-`, `mr-`, `left-`, `right-`, `text-left`…),
  raw `Date` usage outside the date adapter, `localStorage` outside allowed modules.
- `scripts/check-i18n`: unused and missing keys.
- `.env.example` and production-build guard (refuses `VITE_AUTH_MODE=local`).
- Pre-commit hook (lefthook): typecheck + lint + layers on staged files.
- CI workflow (GitHub Actions): `npm run check`, build, Playwright (added when UI exists).
- `docs/sessions/` handoff template, PR/commit conventions (Conventional Commits).

## Phase 1 — Model

| # | Layer | Content | Status |
|---|-------|---------|--------|
| 1.1a | contracts | Zod schemas for every table, branded ids, enums, settings, FilterExpression, permission vocabulary + valid combos (D-040). Drift test vs `schema.sql` (D-039) | ☑ |
| 1.1b | contracts | Command inputs, repository/command/auth/session interfaces, error codes (D-044 … D-050) | ☑ |
| 1.2a | domain | hierarchy (ancestry, descendants, cycles), membership and seniority-override overlap, policy (scope anchors, targets, effective seniority, effective permissions, can()), access-manager invariant, escalation guard, grant validity (D-053 … D-060). Policy test matrix | ☑ |
| 1.2b | domain | leave state machine, account-link candidate matching, filter evaluator + canonical form, property validation, Zod issue mapping (D-063 … D-068) | ☑ |
| 1.3 | domain | availability (one status per soldier/day, partition invariant test) and rule evaluation (targets, group_by, priority, conflicts), with tests | ☑ |
| 1.4 | config | env schema, storage keys, view ids, URL param names, breakpoints, palette keys, date formats | ☑ |
| A1 | audit | Contracts and domain against the decisions (`docs/AUDIT.md`). May run alongside V0 (D-078). Report: `docs/audits/A1.md` | ☑ |

## M1 — The company exists

| # | Slice | The owner sees | Status |
|---|-------|----------------|--------|
| V0 | Walking skeleton | Local sign-in, claim the organization, empty workspace in the Stone 3 look | ☑ |
| V1 | Unit tree | Units drawer: levels, tree, move, reorder, archive | ☑ |
| V2 | Roster | Ranks and soldiers, private fields, unit history | ☑ |
| A2 | audit | Server-authoritative behavior, no bypasses, first UI and `Design.md`. Report: `docs/audits/A2.md` | ☑ |

## M2 — The board works

| # | Slice | The owner sees | Status |
|---|-------|----------------|--------|
| V3 | Timeline grid | Main screen with real soldiers, week navigation, unit selector | ☑ |
| V4 | Leaves on the timeline | Leave types, new leave, bars on the timeline | ☐ |
| V5 | Approval workflow | Details drawer, approve and reject, history, comments, inbox | ☐ |
| A3 | audit | Leave workflow, timeline engine, view state | ☐ |

## M3 — Who is missing

| # | Slice | The owner sees | Status |
|---|-------|----------------|--------|
| V6 | Tags and filters | Tags, filter chips, "only who is missing", present and absent lists | ☐ |
| V7 | Availability rules | Rule builder, heat row, soft-rule acknowledgment, hard-rule refusal | ☐ |
| V8 | Timeline drag | Drag to create, move and resize, with live feedback | ☐ |
| A4 | audit | Filters and rules: UI warnings equal command results | ☐ |

## M4 — Everyone has the right access

M3 and M4 do not depend on each other. The owner picks their order at the end of M2 (OI-031).

| # | Slice | The owner sees | Status |
|---|-------|----------------|--------|
| V9 | Account linking | A second identity asks to link, the owner reviews | ☐ |
| V10 | Roles and access | Roles, rank bindings, grants; each identity sees only its own scope | ☐ |
| V11 | Soldier self-service | A fighter requests on a phone, a commander approves | ☐ |
| A5 | audit | Permissions end to end | ☐ |

## M5 — Go live

| # | Track | Content | Status |
|---|-------|---------|--------|
| V12 | slice | Import and export | ☐ |
| 8.1 | backend | Provider decision (D-027), migrations from `schema.sql`, triggers, server functions | ☐ |
| 8.2 | backend | RLS policies + policy matrix run against the database | ☐ |
| 8.3 | data | Remote adapter passing the repository contract suite | ☐ |
| 8.4 | app | Google auth provider, env per environment (dev/staging/prod), deploy | ☐ |
| A6 | audit | Production readiness, RLS against the policy matrix | ☐ |

## M6 — Complete

From here on, each slice also updates the remote adapter and server functions (D-082).

| # | Slice | The owner sees | Status |
|---|-------|----------------|--------|
| V13 | More views | List, table/agenda and calendar engines | ☐ |
| V14 | Custom properties | Definitions module, values in forms and filters | ☐ |
| V15 | Deployments, batches, overrides | Collective leave, duplicate, deployments, seniority overrides | ☐ |
| V16 | Setup wizard | Guided first run over the existing forms (D-033) | ☐ |
| V17 | Dark Mode | Second token set | ☐ |
| A7 | audit | Whole product | ☐ |

## Later (no schema change required)

Attached memberships, temporary task units, simulations, saved views, rotation templates
for leave batches, hour-level leaves (additive columns), notifications.
