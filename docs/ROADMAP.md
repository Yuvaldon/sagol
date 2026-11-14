# Sagol — Roadmap

Status of the work. The order, dependencies and contents of each slice are in
`docs/FEATURE_MAP.md`. One slice = one branch = one pull request, one commit = one layer (D-075,
D-154). The `slice` skill holds the workflow: every open item targeted at the slice is in scope
(D-043); each commit is green (D-127); the slice ends with `npm run check`, `npm run build` and the
whole Playwright suite green, a review of its own diff, the docs updated, and a pull request whose
description replaces the handoff note, merged with CI green (D-110, D-126, D-128).

Status: ☐ pending · ◐ in progress · ☑ done. A row's ☑ reaches `main` only through a merge with CI
green, so on `main` it means merged and green (D-126).

Rows `A1` … `A9c` are **audits** (D-051, D-078): read-only, run with the `/audit` skill's steps. Since D-170 the
session that reaches an audit row runs it through a fresh subagent and records the findings itself, without waiting
for the owner. Audit reports A1 … A4 and the old session
handoffs are archived in `.claude/archive/docs/` (D-154).

## Phase 0 — Foundations

| # | Track | Content | Status |
|---|-------|---------|--------|
| 0.1 | docs | Decisions log (D-001 … D-033), schema rev 3.1, architecture rev 2, roadmap, CLAUDE.md | ☑ |
| 0.2 | tooling | See guardrails below. Folder skeleton, deps pinned, env example + build guard, CI (D-034 … D-037) | ☑ |
| 0.3 | docs | `docs/OPEN_ITEMS.md` as the single open-items log; workflow files updated (D-043) | ☑ |
| 0.4 | docs | Audit process (`AUDIT.md`, archived; rows A1 … A8) and next-session model recommendation (D-051, D-052) | ☑ |
| 0.5 | docs | Decision index at the top of `DECISIONS.md`; OI-015 partly resolved with a new trigger (D-062) | ☑ |
| 0.6 | docs | `personal_id` = military personal number (D-069); invite links opened as OI-026 | ☑ |
| 0.7 | docs | Move to vertical slices: `docs/FEATURE_MAP.md`, Stone 3 direction (D-075 … D-082) | ☑ |
| 0.8 | docs | Record audit A1: `.claude/archive/docs/audits/A1.md`, OI-034 … OI-042, D-083, D-084 | ☑ |
| 0.9 | docs | Record audit A3: `.claude/archive/docs/audits/A3.md`, OI-068 … OI-091, D-123 … D-129, open-items archive | ☑ |
| 0.10 | docs | Record audit A4: `.claude/archive/docs/audits/A4.md`, OI-098 … OI-101, D-145 … D-147 | ☑ |

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
- Session handoff template (archived, D-154), PR/commit conventions (Conventional Commits).

## Phase 1 — Model

| # | Layer | Content | Status |
|---|-------|---------|--------|
| 1.1a | contracts | Zod schemas for every table, branded ids, enums, settings, FilterExpression, permission vocabulary + valid combos (D-040). Drift test vs `schema.sql` (D-039) | ☑ |
| 1.1b | contracts | Command inputs, repository/command/auth/session interfaces, error codes (D-044 … D-050) | ☑ |
| 1.2a | domain | hierarchy (ancestry, descendants, cycles), membership and seniority-override overlap, policy (scope anchors, targets, effective seniority, effective permissions, can()), access-manager invariant, escalation guard, grant validity (D-053 … D-060). Policy test matrix | ☑ |
| 1.2b | domain | leave state machine, account-link candidate matching, filter evaluator + canonical form, property validation, Zod issue mapping (D-063 … D-068) | ☑ |
| 1.3 | domain | availability (one status per soldier/day, partition invariant test) and rule evaluation (targets, group_by, priority, conflicts), with tests | ☑ |
| 1.4 | config | env schema, storage keys, view ids, URL param names, breakpoints, palette keys, date formats | ☑ |
| A1 | audit | Contracts and domain against the decisions (`/audit` skill). May run alongside V0 (D-078). Report: `.claude/archive/docs/audits/A1.md` | ☑ |

## M1 — The company exists

| # | Slice | The owner sees | Status |
|---|-------|----------------|--------|
| V0 | Walking skeleton | Local sign-in, claim the organization, empty workspace in the Stone 3 look | ☑ |
| V1 | Unit tree | Units drawer: levels, tree, move, reorder, archive | ☑ |
| V2 | Roster | Ranks and soldiers, private fields, unit history | ☑ |
| A2 | audit | Server-authoritative behavior, no bypasses, first UI and `Design.md`. Report: `.claude/archive/docs/audits/A2.md` | ☑ |

## M2 — The board works

| # | Slice | The owner sees | Status |
|---|-------|----------------|--------|
| V3 | Timeline grid | Main screen with real soldiers, week navigation, unit selector | ☑ |
| V4 | Leaves on the timeline | Leave types, new leave, bars on the timeline | ☑ |
| V5 | Approval workflow | Details drawer, approve and reject, history, comments, inbox | ☑ |
| A3 | audit | Leave workflow, timeline engine, view state. Report: `.claude/archive/docs/audits/A3.md` | ☑ |

## M3 — Who is missing

| # | Slice | The owner sees | Status |
|---|-------|----------------|--------|
| V6 | Tags and filters | Tags, filter chips, "only who is missing", present and absent lists | ☑ |
| V7 | Availability rules | Rule builder, heat row, soft-rule acknowledgment, hard-rule refusal | ☑ |
| V8 | Timeline drag | Drag to create, move and resize, with live feedback | ☑ |
| A4 | audit | Filters and rules: UI warnings equal command results. Report: `.claude/archive/docs/audits/A4.md` | ☑ |

## M4 — Everyone has the right access

M3 and M4 do not depend on each other. The owner picks their order at the end of M2 (OI-031).

| # | Slice | The owner sees | Status |
|---|-------|----------------|--------|
| V9 | Account linking | A second identity asks to link, the owner reviews | ☑ |
| V10 | Roles and access | Roles, rank bindings, grants; each identity sees only its own scope | ☑ |
| V11 | Soldier self-service | A fighter requests on a phone, a commander approves | ☑ |
| A5 | audit | Permissions end to end; deferred by the owner, runs with A6 as one combined audit (D-170). Report: `.claude/archive/docs/audits/A5-A6.md` | ☑ |

## M5 — Go live

| # | Track | Content | Status |
|---|-------|---------|--------|
| V12 | slice | Import and export | ☑ |
| 8.1 | backend | Provider decision (D-027), migrations from `schema.sql`, triggers, server functions | ☑ D-200 … D-202 |
| 8.2 | backend | RLS policies + policy matrix run against the database | ☑ D-203 |
| 8.3 | data | Remote adapter passing the repository contract suite | ☑ D-204 … D-206 |
| 8.4 | app | Google auth provider, env per environment (dev/staging/prod), deploy | ☑ D-207 … D-210 |
| A6 | audit | Production readiness, RLS against the policy matrix; with A5's scope, one audit (D-170). Report: `.claude/archive/docs/audits/A5-A6.md` | ☑ |

## M6 — Complete

From here on, each slice also updates the remote adapter and server functions (D-082).

| # | Slice | The owner sees | Status |
|---|-------|----------------|--------|
| V12a | Navigation rebalance | A lighter bar for daily work, a navigation panel by section with pins, the scope label, filters that show only while filtering, the rules row's place (D-173) | ☑ |
| V13 | More views | List, table and calendar engines on one board model and frame (D-174) | ☑ |
| V14 | Custom properties | Definitions module, values in forms and filters (D-176, D-177) | ☑ |
| V15 | Deployments, batches, overrides | Collective leave, duplicate, deployments, seniority overrides | ☑ |
| V16 | Setup wizard | Guided first run over the existing forms (D-033, D-180) | ☑ |
| V17 | Dark Mode | Second token set, the soldier's choice in the user menu (D-181) | ☑ |
| V18 | Installable app (PWA) | Sagol on the phone's home screen: the manifest and icons, a worker that caches the shell only, the update toast, the install item in the user menu, the offline screen (D-182 … D-185) | ☑ |
| V19 | Time range, rotations, declutter | A range picker (day, week, month, a whole rotation) that every view honors, "סבב" in place of "פריסה", "only who is missing" as a filter condition, a sort control shared by the board and the table, and a calmer screen (D-211 … D-215); then the rotation-centric workspace: every request belongs to a rotation, the workspace opens on it, no request surface without one, and the wizard opens the first (D-216 … D-220) | ☑ |
| V20 | Bars rebalance and declutter | On a phone the week and the avatar at the top, scope, view and filters in a row under it, a tab bar of destinations at the bottom; icons with tooltips on desktop (D-189); a phone on its side keeps the phone's bars, edge to edge inside the safe area, an opaque name column (D-190 to D-192) | ☑ |
| V22 | Daily report (דוח 1) | Tap a day in any view: who is present, absent, leaving and returning, by unit; reasons on request; copy as a message, save or share as an image; several days at once (D-193 … D-197) | ☑ |
| V24 | Simplification: information architecture | Docs only: two vocabularies and a term map, one navigation model (a context strip and a destination strip, the profile, "ניהול יחידה", one requests hub), five journeys, a rotation as a mode of the system, templates (D-250 … D-264) | ☑ |
| V25 | Navigation and words | The term map in every string, no "ארגון"; two floating strips on every screen; a personal profile; "ניהול יחידה" with groups and a line per module; one requests hub; one path per action (D-250 … D-256) | ☑ |
| V23 | Focus mode | One control hides both strips and the chips; one restore button brings them back (OI-032, after V25; D-301) | ☑ |
| V26 | Rotation as a mode | One rotation at a time, routine between them, the final close, the whole unit by default, tags for one rotation (D-257 … D-260; schema change) | ☑ |
| V27 | Templates and setup | The claim creates the root unit; the "פלוגה" template; pick, adjust, done (D-251, D-261, D-262) | ☑ |
| V32 | Work and unit setup | Daily work in "ניהול יחידה", one-time definitions in "הגדרות היחידה"; a definition apart from its use; a missing definition created in place; tag categories advanced; the checklist leads (D-284, D-285) | ☑ |
| V28 | Several requests at once | One sheet of rows, a recurring row, sent atomically, each row its own leave (D-267); the quick action by mode moved to A7 fixes (OI-219) | ☑ |
| A7 | audit | Whole product, once V27 and V28 are in (D-284) | ☑ |
| V29 | Board visual language | Presence quiet, absence a hole, green never means away; rounds under requests; the view by device; a breach in every view (D-268, D-290) | ☑ |
| A7 fixes | A7's findings | The quick action by mode in the strip and a quiet routine band (OI-219, D-296); a unit drop by the root (OI-247); no "ארגון" (OI-248); one setup checklist (OI-250, D-297); journey (b) walked (OI-251); lazy modules (OI-118); `NavigationModule` gone (OI-244, D-291); D-298, D-299 | ☑ |
| V30 | דוח 1 as a workflow | Each unit confirms its list, the report owner sends one message up (D-269, D-293; schema change) | ☑ |
| V33 | Board controls | The heat row fixed above; the view picker as cards from the board's tab; filtering and sorting as a rule builder with AND/OR and several sorts; flat chips; a root unit for every organization (D-310 … D-315; data migration) | ☑ |
| V31 | Leave-round planner | The routine rhythm generated for groups of soldiers in a rotation, sent as one collective leave; overlapping rounds stacked on the timeline (D-270, D-316, D-317) | ☑ |
| V21 | Unit tree canvas | The unit tree as a pannable, zoomable org chart, a view switch beside the tree, with editing on the canvas for whoever may edit units (D-318 … D-320) | ☑ |
| A8 | audit | Pre-launch, on main with V31, V30 and V33 in; V21 and V23 audited when they land | ☑ |
| A8 fixes | A8's findings | Leave batches and plans bounded on the server (OI-265); the root backfill for older organizations (OI-266); the dead "found units" action (OI-267); one filter model (OI-268); a bounded report window (OI-269); local root parity (OI-270); the chart's anchoring (OI-271); the rule builder's focus and URL (OI-260, OI-261); OI-257, OI-258, OI-262 … OI-264 | ☑ |

Order (D-271, amended by D-284): before launch, track A runs V32 (its docs first) → V28 and track B runs V26 → V27;
then A7 on main once V27 and V28 are in. V29 is done. Before launch: "A7 fixes" (track A) and V33 "Board controls"
(track B); then V30, V31, V21, V23; then A8 and "A8 fixes". OI-230 (the owner's production settings) gated launch; closed in the 1.0 planning (D-344).

## M7 — Version 1.0

Version 1.0 is the first version technically ready for real use in place of the spreadsheet. Deploying it as it is,
or holding it for one more update, is the owner's decision once it is ready (D-342). Who operates it: D-343. What it
holds: the sort in D-344. The UI update is part of 1.0; D-333's freeze holds until the design rounds approve a concept.

| # | Stage | The owner sees | Status |
|---|-------|----------------|--------|
| R1 | Defining 1.0 | The definition, the target user and the stages (D-342, D-343) | ☑ |
| R2 | Sorting the rest | Every open item and Later feature as Must, Should, Could or Won't for 1.0 (D-344) | ☑ |
| R3 | Closing the gaps | The Must items closed (OI-117 on an iPhone, OI-293, OI-295 with D-345), then the Should items; all closed but OI-117's iPhone check, done in acceptance testing (R6) | ☑ |
| R3·N | Notifications | "עדכונים" on שלי with a count, and phone notifications chosen per device and per kind in the profile (D-351 … D-359) | ☑ |
| R3·D | Dashboards | The command board "דשבורד" with its modules, templates and own list, and "הסבב שלי" on top of "שלי" (OI-222, D-349, D-350, D-360 … D-362) | ☑ |
| R3·C | The Could items (D-370, D-400) | Restoring an archived row from its archive (D-371); "changed since" by a commit-ordered change number (D-373); typed filter conditions, a unit property read on the day, leave property conditions (D-380 … D-382); the range picker's two and four weeks (OI-111, D-383); saved views (D-384 … D-388) | ☑ |
| A9a | audit | The R3 merges (#83 … #89) on main at 6c726e6 | ☑ |
| A9a fixes | A9a's findings | The confirmation's `seen_seq` read before the report (D-402); the dashboard's unit picker offers only units read whole (D-403); a board before the first counted day (D-404); one module key (D-405); a refused restore explained in its dialog; the updates' seen time; D-400, D-401 | ☑ |
| A9b | audit | Security and readiness before 1.0: input refusals, the server store and the function across a deploy (D-410) | ☑ |
| A9b fixes | A9b's findings | A push address that is not a URL refused as invalid (OI-350); the server store writes only the row's columns (OI-351, D-410); the function loads its catalog again after a failure (OI-352); OI-353 recorded for after 1.0 | ☑ |
| A9c | audit | The R3-rest merges (#93, #94) on main at 3d65ba4; its one finding fixed: sign-out unsubscribes the browser even when it cannot read its install | ☑ |
| R4 | Design rounds | A new interface concept, approved by the owner: whether the board stays the main screen, the dashboard's place, archiving without accidents (OI-297), the range picker's redesign (its two and four weeks are built in R3·C) | ☐ |
| R5 | Building the design | The approved concept in the product | ☐ |
| R6 | Acceptance testing | The journeys walked on the real product; the decision point on who maintains the system after handover (D-342) | ☐ |
| R7 | Release decision | A go / no-go: deploy as it is, or wait for one more update; production only on the owner's word (D-340) | ☐ |

## Later (no schema change required)

Attached memberships, missions (משימות/מבצעים), simulations, rotation templates
for leave batches, hour-level leaves (additive columns). Saved views moved to R3·C as built (D-400).
