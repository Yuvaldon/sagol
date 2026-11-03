# Sagol — Roadmap

One session = one layer (or one non-code track: docs / tooling). Every session:

1. starts by reading `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`,
   `docs/schema.sql`, `docs/OPEN_ITEMS.md` and the previous handoff in `docs/sessions/`,
   and takes in scope every open item targeted at it (D-043);
2. touches only its layer's folder (plus `i18n`/theme tokens in UI sessions, D-025);
3. ends with `npm run check` green, `docs/OPEN_ITEMS.md` updated, a commit, and a handoff
   note `docs/sessions/NN-<name>.md` (done / decisions taken / open item ids / next input).

Contracts are written once for the whole domain (phase 1). After that, features are built
as vertical slices across consecutive single-layer sessions.

Status: ☐ pending · ◐ in progress · ☑ done

## Phase 0 — Foundations

| # | Track | Content | Status |
|---|-------|---------|--------|
| 0.1 | docs | Decisions log (D-001 … D-033), schema rev 3.1, architecture rev 2, roadmap, CLAUDE.md | ☑ |
| 0.2 | tooling | See guardrails below. Folder skeleton, deps pinned, env example + build guard, CI (D-034 … D-037) | ☑ |
| 0.3 | docs | `docs/OPEN_ITEMS.md` as the single open-items log; workflow files updated (D-043) | ☑ |

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
| 1.1b | contracts | Command inputs, repository/command/auth/session interfaces, error codes | ☐ |
| 1.2 | domain | policy (scope anchors, effective seniority, effective permissions, can()), hierarchy (ancestry, cycles), leave state machine, account-link candidate matching, filter evaluator + canonical form, property validation. Policy test matrix | ☐ |
| 1.3 | domain | availability (one status per soldier/day, partition invariant test) and rule evaluation (targets, group_by, priority, conflicts), with tests | ☐ |
| 1.4 | config | env schema, storage keys, view ids, URL param names, breakpoints, palette keys, date formats | ☐ |

## Phase 2 — Data

| # | Layer | Content | Status |
|---|-------|---------|--------|
| 2.1 | data | Dexie schema + migrations, session source, transaction/version/audit helpers, reference-data repositories | ☐ |
| 2.2 | data | Commands: bootstrap, accounts, access grants, memberships, units move, leaves workflow with rule enforcement | ☐ |
| 2.3 | data | Shared repository contract test suite (adapter-agnostic) + import/export | ☐ |

## Phase 3 — Logic

| # | Layer | Content | Status |
|---|-------|---------|--------|
| 3.1 | logic | Session/auth service (local provider), permission hints, query client setup | ☐ |
| 3.2 | logic | Reference-data use cases and hooks (units, levels, ranks, roles, tags, leave types, properties) | ☐ |
| 3.3 | logic | View state (URL search params), filters, leave use cases and hooks with optimistic updates | ☐ |

## Phase 4 — Workspace and management

| # | Layer | Content | Status |
|---|-------|---------|--------|
| 4.1 | ui | Tokens, primitives, workspace frame + drawer/sheet + units tree module → `docs/Design.md` | ☐ |
| 4.2 | app | Composition root: env parsing, adapters, providers, router, local auth. First end-to-end run | ☐ |
| 4.3 | ui | Navigation (top floating / bottom bar), sign-in + onboarding screens, empty states | ☐ |
| 4.4 | ui | Modules: unit levels, command ranks, roles & permissions, access grants | ☐ |
| 4.5 | ui | Modules: tag categories & tags, leave type groups & types, custom properties | ☐ |
| 4.6 | ui | Import/export module | ☐ |
| 4.7 | ui | First-run setup wizard reusing module forms; step completion derived from data (D-033) | ☐ |

## Phase 5 — People and requests

| # | Layer | Content | Status |
|---|-------|---------|--------|
| 5.1 | ui | Soldiers module (profile, private fields, tags, membership history), account link review | ☐ |
| 5.2 | ui | Leave request (soldier), my requests and history, comments | ☐ |
| 5.3 | ui | Commander inbox: approve/reject with rule warnings | ☐ |

## Phase 6 — View engines

| # | Layer | Content | Status |
|---|-------|---------|--------|
| 6.1 | ui | Neutral engine model, registry, viewport container, view switcher | ☐ |
| 6.2 | ui | List and table/agenda engines | ☐ |
| 6.3 | ui | Timeline core (pure: layout, lanes, virtualization windows, drag math) + tests | ☐ |
| 6.4 | ui | Timeline view + adapter (read-only) | ☐ |
| 6.5 | ui | Timeline interactions: create, move, resize, conflict/rule feedback | ☐ |
| 6.6 | ui | Calendar engine | ☐ |

## Phase 7 — Availability rules UI

| # | Layer | Content | Status |
|---|-------|---------|--------|
| 7.1 | logic | Rule use cases, availability queries for a window | ☐ |
| 7.2 | ui | Rules module (builder using the shared filter UI) | ☐ |
| 7.3 | ui | Timeline heat row, rule status in views and inbox | ☐ |

## Phase 8 — Production

| # | Track | Content | Status |
|---|-------|---------|--------|
| 8.1 | backend | Provider decision (D-027), migrations from `schema.sql`, triggers, server functions | ☐ |
| 8.2 | backend | RLS policies + policy matrix run against the database | ☐ |
| 8.3 | data | Remote adapter passing the repository contract suite | ☐ |
| 8.4 | app | Google auth provider, env per environment (dev/staging/prod), deploy | ☐ |
| 8.5 | ui | Dark Mode token set | ☐ |

## Later (no schema change required)

Attached memberships, temporary task units, simulations, saved views, rotation templates
for leave batches, hour-level leaves (additive columns), notifications.
