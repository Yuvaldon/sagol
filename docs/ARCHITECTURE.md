# Sagol — Architecture & Iron Rules

Military reserve unit management and leave tracking. React + TypeScript + Tailwind, Vite,
native RTL (Hebrew), Light Mode default, and a Dark set the soldier may choose (D-181).

Sources of truth: entity and column names → `docs/schema.sql`. Decisions and their
reasons → `docs/DECISIONS.md`. Build order and dependencies → `docs/FEATURE_MAP.md`, status →
`docs/ROADMAP.md`.

## Iron rules (non-negotiable)

1. **Layer separation.** Data, Logic and UI are fully separate. A session builds one feature
   across the layers (one vertical slice), and each commit touches one layer, written against
   the public API of the layer below it, and passes `npm run check` (D-075, D-127).
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
| config    | Constants: storage keys, view ids, breakpoints, palette keys, env schema | contracts, `zod` (D-074)          |
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
- **Writes** are validated (Zod schema → visibility → policy → state → integrity → domain invariants, D-090) inside one
  transaction, bump `version`, reject stale versions, and write audit events.
- **What can take permissions away** is checked on the state after the write, inside its transaction (D-059, D-096).
- **Workflow changes are commands**, not field updates: `createLeave`, `transitionLeave`,
  `rescheduleLeave`, `grantAccess`, `revokeAccess`, `requestAccountLink`,
  `reviewAccountLink`, `bootstrapOwner`, `moveUnit`, `changeMembership`, `importBatch`.
- Errors are typed results with stable codes (contracts). The UI maps codes to i18n.
  An invisible row answers `not_found`, never `forbidden` (D-046). Schema failures are
  mapped to field codes by one domain function, shared with the forms (D-068).
- The contract of an adapter is `DataAdapter` (contracts): `session`, `repositories`
  (one per table), `commands` (grouped by resource), `transfer` (import/export) and
  `changes`. It is built from an `IdentitySource` and a `TimeSource` (D-048, D-083). Create inputs carry
  caller-generated ids (D-044); inputs follow D-045; leave commands take
  `acknowledged_rule_ids` for soft rules (D-047).
- An adapter grows by slice: until it is complete, its type is a `Pick` of the groups that exist,
  each `logic` module declares the narrow port it needs, and nothing returns "not implemented"
  (D-076).
- Every adapter must pass one shared **repository contract test suite**, which grows with each
  slice and takes a `seed` port per adapter (D-076). The remote adapter (`src/data/remote`, D-204) passes the same
  suite, end to end through the gateway on Postgres, which is what makes the switch safe.
- Repositories expose change subscriptions, so the UI has one live source of truth
  across tabs and views.
- On the server (D-201) one function, the command gateway, runs the same command core over a
  Postgres `Store`, in one SERIALIZABLE transaction per request, as the identity of the verified
  token. `src/data/server/index.ts` is its entry; the app imports only `src/data/index.ts`.
  `supabase/migrations` builds the database from `schema.sql`, plus triggers (D-202). The API
  roles hold no privilege and RLS has no policy, so no client reaches a table (D-203).

## Identity and access (D-001 … D-006)

- **Authentication:** Google only, behind the `AuthProvider` contract. `local` provider in
  development. The production build fails if `VITE_AUTH_MODE=local`. As built (8.4, D-207): Google
  through Supabase Auth (PKCE), always paired with the remote adapter; the composition loads only
  the env's pair (D-210). Deploys: Vercel Preview and Production (D-209). CD: Staging runs after every
  green CI on `main` (D-276, D-292); production runs only when the owner starts it after approving a release
  (`production.yml`, D-280 as amended by D-340): migrations, then the function, then the `production` branch that
  Vercel builds as Production.
- **Deploy marking (D-300):** `VITE_APP_ENV=staging`, set on Vercel for the `staging` branch only, marks the staging
  deploy: a black band "אתר בדיקות" on every screen, the title "סגול · בדיקות", and an installed app with the bison in
  black and that name. Production has no such variable and stays unmarked.
- **Accounts:** `soldier_accounts` links a provider identity to a soldier. Commanders may
  create soldiers with names only (personal ID and email optional). Linking is automatic
  only on personal ID + verified invite email match. Anything else becomes an
  `account_link_requests` row. Domain proposes candidate matches (personal ID, then
  normalized names, in either order) to the reviewer only, and approval fills a missing
  personal ID (D-030, D-066). Personal IDs are stored normalized. Unlinked accounts see
  nothing, and requesters never learn whether a match exists.
- **Linking, as built (V9, D-148 to D-151):** `accounts.requestLink` (an identity with no account; auto-link on a verified
  email, the personal number and the invite email, else a pending request; both answer `{ outcome }`),
  `cancelLinkRequest` (the asker), `reviewLink` (link to a candidate, create a soldier, reject). A reviewer reads, and may
  name, only the candidates over which they hold `accounts:approve` (`reviewableCandidates`); approval fills a missing
  personal number. Candidates are computed on each read. Screens: the request form and waiting notice of onboarding, and
  the account-links module in the bar. Not built: invite links (D-152).
- **Access, as built (V10, D-156 to D-166):** `roles` (with their permission set), `rank_role_bindings`, `access_grants`
  (grant and revoke) and `organizations.baseline_role_id`. Every way of giving a role is guarded: the writer must hold
  the pairs given, a grant's scope stays within the writer's reach, and the post-write state keeps an access manager
  (D-156, D-158). A holder without seniority gets only `any` (D-157); `self` sees its own unit chain (D-159).
  `accounts.revokeLink` ends a link (D-163). Who cannot view the organization counts days on the device's zone (D-160);
  presence and live warnings leave out what the actor cannot read in full (D-161, D-162). A grant's window is whole days
  in the organization's zone (D-166). Screens: the roles module (roles, rank bindings, the baseline) and the grants
  module. The phone's "more" menu of D-165 gave way to the navigation panel (D-173).
- **Self-service, as built (V11, D-167 to D-169):** "my requests" reads the actor's own leaves (open and history) through
  the same `leaves` permissions, and its "new request" opens the new-leave form with the only soldier the actor may pick
  already chosen (D-167). An identity whose last link request was rejected is told so on the onboarding screen, without
  saying what matched (D-168). The grants list re-renders at the next start or end of a grant while it is on screen
  (D-169).
- **Import and export, as built (V12, D-171):** `transfer.importBatch` runs the built create commands in one outer
  transaction after checking `data_transfer:import`; a malformed list runs nothing, and the first refusal ends the run.
  A dry run writes nothing; a committed run announces its changes once. `transfer.exportOrganization` returns the
  organization's rows, gated by `data_transfer:export`. The domain reads a soldiers CSV (`domain/transfer`), and logic
  turns a picked file into operations (`logic/transfer`). A taken membership id answers `already_exists` (OI-050).
- **Bootstrap:** the first sign-in on an empty organization becomes owner only if its
  verified email matches the server secret `BOOTSTRAP_OWNER_EMAIL`. Atomic server function.
  Locally, the same flow makes the developer the owner.
- **Authorization:** effective permissions = baseline role (self) ∪ rank bindings (general,
  per rank) ∪ active access grants (individual). Both bindings and grants use one scope
  model (D-028): an anchor (`self`, `organization`, the home unit, N levels up, the ancestor
  at a level, an absolute unit, or a soldier) plus `include_descendants`, optionally limited
  by subject rank against **effective seniority** (rank seniority unless a personal
  override is active, D-029). Implemented once in `domain/policy`, consumed by the local
  adapter, which answers UI hints ("can I?", D-085), and run on the server by the command
  gateway; the same matrix is tested in memory and over Postgres (D-203).
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
change. The claim creates the organization and its root unit from one name (V27, D-251); templates (`config/templates`)
are applied by `logic/organization/template` as a sequence of the ordinary commands that stops at the first refusal (D-261).
Quick entry of several soldiers (`logic/roster/quickEntry`, D-282) runs `soldiers.create` once per grid row, saved row by
row; approving several join requests (`logic/accounts/bulk`, D-283) links each one through its own review, and only a
single match by personal number.

## Availability (D-012, D-014, D-070 … D-073)

`domain/availability` computes exactly **one status per soldier per day** plus the pending
and approved leaves covering it. A soldier is unavailable if any approved leave (or pending,
when pending leaves are counted) whose effective effect (the leave's override, else its
type's effect) is `unavailable` covers the day. Present/absent lists are a partition: each
soldier appears once, in one list, and markers are annotations on that entry (D-032, D-070,
enforced by a test).

`availability_rules` are evaluated per target (evaluated unit × canonical population × group
value × day) → members, available count, required minimum, allowed maximum, broken bounds.
Each child or level unit of a rule's scope is its own target; global rules (no scope unit)
cover the whole organization. Populations are active, non-archived soldiers placed that day,
filtered by the rule and, with a deployment, by its members. Thresholds are exact counts
(minimum up, maximum down). `group_by` splits a rule per tag or rank, including selected
groups nobody holds (D-071, D-072). On the same target the higher-`priority` rule is
effective and the others show as overridden. At equal priority all apply. Min/max conflicts
are reported as configuration errors (D-031). Commands that change leaves get the
violations the change makes worse (`leaveChangeViolations`) and `ruleGate` turns them into
the answer: soft violations need an acknowledgment stored in `leave_events`, hard
violations are rejected by the adapter/server (D-047, D-073). A violation names, per day, who
is unavailable, also soldiers the actor cannot see (D-138).

The current state (D-128):

- **Rule commands** (`availability_rules`): a rule is a unit target, or an organization target when global; moving it
  needs `update` on both ends; references, the population filter and the rows it names are checked (D-139).
- **`logic/rules`** evaluates over what the actor reads, with the commands' domain functions: the heat row, the broken
  rules of a day, the window's conflicts and the live warning of a form (D-141, D-142). Deployments and their members join, archived ones too (D-179).
- **Deployment commands** (`deployments`, `deployment_members`): a deployment is a unit target, moving it needs
  `update` on both units, and its members are replaced whole under its version (D-179).
- **Rotations** (D-216 … D-220, D-257 … D-260, D-221, D-222): every leave names a rotation its soldier serves in on
  those dates, checked by the commands, the gateway and deferred constraint triggers. One rotation at a time per
  organization (`deployments_one_at_a_time`); `deployments.close` and `reopen` set and clear `closed_at`, and a closed
  rotation, its members, rotation tags and requests answer `rotation_closed`. A rotation with no member rows holds its
  unit's soldiers on their membership days. `logic/view-state` derives the mode (`scopeRotation`: the open rotation
  holding today, else the next, else the latest ended; NULL is routine, `useRotationScope`); routine keeps the board
  under its band and hides the requests hub and the day report; `defaultDeploymentMembers` and `startingMembers` fill
  a new list from the unit or the previous rotation.
- **The built-in "סבב יציאות" group** (D-345, D-346): `leave_type_groups.is_rotation_leave`, one per organization,
  made by `bootstrapOwner` and the `20261114000000_rotation_leave.sql` migration (device store version 9). The command
  core refuses archiving it or its last type, and keeps its types unavailable, reasonless and in calm colors
  (`domain/leaves/types`); `logic/leaves/leaveTypes` adds a numbered type with no form; the forms ask no reason
  and the day report shows none for its leaves.
- **Leave batches and copies** (`leaves.createBatch`, `leaves.duplicate`): each leave planned and checked as a single
  one, the rules judged on all at once, all or none (D-179).
- **The leave-round planner** (`domain/leaves/rounds`, `logic/leaves/planner`, D-316): groups of a rotation's soldiers,
  each from its own first day home on one rhythm (`LEAVE_ROUNDS`), cut to the days each soldier serves, sent as one
  `leaves.createBatch`. The timeline gives overlapping rounds lanes (`assignLanes` in the timeline adapter, D-317).
- **The request sheet** (`leaves.createMany`, `logic/leaves/sheet`, D-275): one soldier's rows, a recurring row expanded
  in logic, each leave with its own rotation and checked on `leaves.<n>` as `leaves.create` checks one, all or none;
  the answer's issues land back on their rows.
- **Day report** (`logic/presence`, D-193 … D-197): `dayReport` partitions a day's population into present and absent,
  marks who leaves and returns by `dayMovements` in `domain`, and breaks it down by unit in the tree's order;
  `reportDays` spans to a last day over the reportable days (D-211); `reportText` writes the message. The reasons
  switch is a device flag (`useDeviceFlag`) in the device store of `data/device`, under `DEVICE_KEYS`, per soldier.
  `ui` draws the image on a canvas (`modules/presence/reportImage.ts`).
- **Report confirmations** (D-293): `report_confirmations` holds one row per unit and date, moved by
  `day_reports.confirm` and never deleted; `deployments.report_owner_id` names who reads the summary. `domain/reports`
  holds the confirm rule (an open, live rotation over the unit on the date) and `confirmationStatus`; "changed since" is
  derived in `logic/presence/confirmations.ts` from the section's soldiers' leaves of any status touching the day ±1,
  written after the confirmation, on the report with no view filter. Which unit and date the actor may confirm is
  `report_confirmations.confirmable`, answered on the whole tree, so a hidden middle level does not hide the button.
  `report_confirmations.sections` counts the rotations' sections on the whole tree for who reads the summary, a count
  only, and how many of them the actor's report cannot head (the unit, or every soldier of it, is outside the actor's view), so the summary shows how many units lie
  outside the view (D-303). Both refuse a window past
  `DAY_REPORT.maxSpanDays`, and `createBatch` and the copies refuse more than `LEAVE_BATCH.maxLeaves`, checked in the
  command (D-302). A
  confirmation holds from the client's read of the leaves (`seen_at`, `confirmedAtOf`). `useReportConfirmations` reads
  them with those leaves; leave writes refresh it, and rotation writes refresh the confirmable answer.
- **Screens:** the rules drawer (list, conflicts, a day's broken rules, the form, D-140); the heat row under the days
  (D-141), and the same breaches beside a calendar day, as a phone day's tone, in the day report and above the list (`ui/board/breaches.ts`, D-290, D-339); one acknowledgment dialog for every leave command on screen, which resends with the soft rules' ids (D-142).

## Filters (shared model)

One `FilterExpression` schema (contracts) and evaluator (domain) is used by view filters,
saved views (later) and rule populations. A filter means the same thing everywhere: it is
evaluated per soldier per day (unit and seniority on that day), negative operators are
complements, and text compares case-insensitively. Rules compare populations by a
structural canonical key (D-067).

The current state (D-128):

- **One source of filter data** in `logic/filters` (`useFilterSource`, `filterContextOf`): soldiers, ranks, units,
  memberships, soldier tags and the property definitions (a soldier's values are on its row), and seniority overrides (D-177, D-179, D-326).
  The board, the presence lists and the rules' evaluation (`ruleDataOf`) read it; units with archived ones join with
  OI-098 (D-147).
- **Who a view starts from:** soldiers not archived, active only unless the filter has a status rule (D-105, D-312).
- **The rule builder** reads and writes `filter` as one model, the rules (`readRules`, `writeRules`): `and(unit, ...rules)` for וגם, `and(unit, or(...rules))` for או;
  a tag category or rank takes any of or none of, a status is or is not, a select property any of, none of, empty or
  not empty, a yes / no is, empty or not empty (D-312, D-322, D-326); anything else is "a filter the bar does not read". Leave conditions (statuses,
  types) are a separate param, `leaves`, never part of `FilterExpression` (D-132). `missing` keeps soldiers absent on a
  day of the window, approved leaves only (D-133).
- **Presence lists** of a day (`day`) partition who the soldier filter selects that day, approved leaves only (D-134).
- **The unit chart** is laid out in logic (`unitChart`: a column per leaf, a parent centered over its children, a row
  per depth) and drawn by the UI in theme lengths; the list and the chart share the units' actions (D-318 … D-320);
  when its width changes, the view holds on the card in focus or last pressed (D-325).

## Tags (D-015, D-065, D-130)

Categories and tags are organization data (`tags:*` at `organization`). `soldiers.setTags` replaces a soldier's set with
`soldiers:update` over the soldier, checks only the tags it adds, keeps one tag of a `single` category, and bumps the
soldier's version (D-045). A category in use is not archived; switching to `single` is refused while a soldier holds two
of its tags. A tag lasts for good (`deployment_id` NULL) or for one rotation, per assignment; the set is replaced one
scope at a time, and a rotation's effective set is the persistent tags plus its own (D-260, D-221). The board, the
filters and the heat row read the mode rotation's set; a leave's warning reads its own rotation's (D-222).

## Leave workflow (D-013, D-063, D-064, D-114 … D-125)

The current state, in short (D-128). The entries hold the reasons.

- **State machine (domain):** which steps each status allows, the permission each needs, the review columns and the event
  (D-063). Rejected and cancelled leaves are closed until reopened. Commands check the permissions with `can()` on the
  leave's soldier.
- **Commands:** `leaves.create` (D-114), `transition` and `update` (D-117, D-123), in the order of D-090, each in one
  transaction with the rule gate (D-073). `update` takes the dates and the details together, one event per edit
  (`rescheduled` for dates alone). A material edit of an approved leave (dates, type, effect) follows
  `reschedule_policy` (D-064). On a leave of an archived soldier only `cancel`; the hints follow (D-124).
- **Comments:** shared or internal; each is read and written with its own pair over the leave's soldier, and only the
  author edits or archives (D-118).
- **Screens:** a bar or badge opens the leave in the `leaves` panel (D-119, D-129): details, the actions the state and the
  hints allow, one edit form, one thread of events and comments. The "+" opens the new-leave form in the same panel
  (D-115); it offers active soldiers only (D-125, D-136). The requests inbox lists pending leaves the actor may
  approve and closed leaves to reopen (D-120). The "approve now" default is a switch in the user menu (D-121).
- **Dragging on the board (D-143, D-144):** a bar or a marker the actor may edit moves by whole days, and a bar's ends
  move its first or last day; the drop is one `leaves.update` with the dates, through the rule gate. A drag on empty days
  opens the new-leave form with the soldier and the days (`draft` in the URL). While it goes on, a card says the new days,
  a return to pending and the rules the change would break. On touch a finger holds first. The math is in the engine's
  core; `logic/timeline/editing.ts` gives the hints and the edit a drop sends.
- **Optimistic updates:** a step shows at once and is taken back on a refusal; `stale_version` shows the stored leave
  again (D-119).

## Workspace, routing and view state (D-023)

- One main workspace route. Management modules and details open as floating surfaces:
  side drawer on desktop, bottom sheet on mobile. Navigation is two floating strips that hug their content on every
  screen (V25, D-252): a context strip at the top (scope, range, view, filters) and a destination strip at the bottom
  (לוח, שלי, בקשות, דוח 1, ניהול) with the role's one quick action by mode (`useQuickAction` in `logic`, D-296) at its inline end. "ניהול יחידה" is
  a panel from the inline start, a plain line per module and no pins (D-254). From V32 it holds daily work only,
  grouped by `WORK_SECTIONS` in `config`, each module loaded lazily (OI-118), with one row at its foot to "הגדרות היחידה", the same panel's rows replaced by
  `SETUP_SECTIONS` (D-285). A field whose definition is missing offers the module's own form over the drawer
  (`CreateInPlace` in `ui/patterns`), and takes what was saved; the next undone setup step is `nextSetupStep` in `logic`. The home follows permissions (`useHome` in `logic`, D-265): who approves or manages lands on the board,
  anyone else on "שלי", and the last choice is kept on the device. The heat row always sits above the soldiers, sticky (D-310).
  The "לוח" tab opens the view sheet on the board (`ViewSheet`, D-311); "סינון ומיון" opens the rule builder
  (`RuleBuilder`, D-312), whose soldier rules live in the URL's `filter` and its sort rows in `sorts` (D-313). The organization's setup (`setup` panel) is first in that panel and the
  empty board's one action (D-256); its steps are `SETUP_STEPS` in `config`, shown by `create` permission and marked
  done from live rows (`useSetupProgress`, D-180).
- Focus mode (D-301) is `useFocusModeScope` in `ui/shell`, a session device flag (`DEVICE_KEYS.focusMode`) live only
  while the board shows: the workspace swaps both strips and the chips row for `FocusModeRestore`, which keeps the
  page's heading. Its key and the overlays an Escape closes first are `FOCUS_MODE` in `config`.
- All view state lives in **typed URL search params** (TanStack Router + Zod): active view
  id, date window, filters, open panel and its entity. Switching views keeps filters. Deep
  links and the back button work. Parameter names come from `config`. The window's kind (`range`: day, week, month,
  a rotation) and the board's sort (`sort`, `order`, shared with the table) live there too; `useDateWindow` and
  `useBoardSort` in `logic/view-state` read and write them (D-211, D-214).
- The back button closes the top overlay only (D-332, D-337): a panel or the navigation panel holds one history entry,
  and every `Popover` and `ModalOverlay` in `ui/primitives` holds one through `useOverlayLayer` while open, innermost first.
- Other routes exist only for sign-in and onboarding.

## View engines (inside `ui/engines`)

Each engine (timeline, calendar, list, table/agenda) is a self-contained module:

1. **core:** pure logic (date math, layout, lanes for overlaps, collisions, drag), no React,
   no domain knowledge. Unit-tested.
2. **view:** React rendering of a neutral model (resources and time-bound items).
3. **adapter:** the only place translating domain entities (soldier, leave, availability)
   into that model.

A registry maps view ids (from `config`) to engines. The central viewport is a pluggable
container that mounts whichever engine is active; each engine reads the same view state (window, filter, colors) from the
URL through `logic`, so switching engines keeps it.
Replacing an engine replaces one registry entry. Engines never call each other.

The current state (D-174): `logic/board` is the one model of every engine (rows, leaves, the window's days and weeks);
`logic/timeline` keeps only drag editing. What the engines share on screen is in `ui/board` (the frame with its loading,
failed and empty states, the scroller region, the leave chip and the labels), outside `ui/engines`, so engines stay
independent. Only the timeline has a core and a view; the list, the table and the calendar are adapters alone.

## Design system

- Tailwind's default palette and spacing scale are reset. Only semantic tokens exist
  (`--color-surface`, `--color-text-muted`, `--color-status-pending`, ...). A light set, and a
  dark set under `[data-appearance='dark']` on the root element (D-181).
- User-chosen colors are **palette keys** (`color_key`). The closed list of palette keys is
  in `config`, and each key maps to a token pair for light/dark in the theme.
- Only logical (RTL-safe) properties: `ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`, never
  `left`/`right`/`ml`/`mr`.
- The visual direction is the owner's "Stone 3" canvas (D-077, values in
  `docs/FEATURE_MAP.md`). `docs/Design.md` is derived from the first built components (D-024)
  and binds all later UI work.
- A control renders only when its action works end to end (D-076).

## Environment

`.env.example` lists every variable. `config` defines the env Zod schema, and `app`
parses `import.meta.env` at startup and fails fast on invalid values. Variables: auth mode,
data adapter, remote URL/keys (phase 8). Server-only secrets (`BOOTSTRAP_OWNER_EMAIL`)
never reach the client bundle.

## Installed app (D-182 … D-185)

- The build makes the manifest, the icons (from `ui/theme/app-icon.svg`, drawn in the marker color) and the head
  tags from the light theme's tokens and the i18n name (`vite.config.ts`, `vite-plugin-pwa`).
- The service worker exists only in a production build. It precaches the app shell, falls back to the cached page
  for navigations, and caches no data: the command gateway and auth always go to the network (`config/pwa`).
- `app/shell` owns the browser APIs (registration through `workbox-window`, the update check, `beforeinstallprompt`)
  behind the `shell` port of `logic`; `useAppUpdate` and `useInstallOffer` read it, and `ui` shows the update
  toast and the install item. `useInstallInvitation` adds the one-time card after sign-in, answered once per device
  (D-274). A remote build without a network waits on the offline screen (`mountApp`).

## Folder structure (target)

```
src/
  contracts/   auth/ commands/ common/ entities/ enums/ errors/ filters/ inputs/ permissions/ repositories/ settings/
  domain/      accounts/ availability/ filters/ hierarchy/ issues/ json/ leaves/ policy/ properties/ tags/ text/ time/
               transfer/ testing/
  config/      breakpoints/ dates/ env/ icons/ inbox/ leaves/ palette/ panels/ pwa/ remote/ report/ routes/ startup/
               storage/ templates/ url/ views/
  data/        device/ (web storage for conveniences, D-197)  local/ (dexie schema, migrations, repositories, commands)  server/ (Postgres store, gateway, D-201)
               remote/ (one POST per call to the gateway, D-204)
               contract-tests/
  logic/       access/ accounts/ board/ deployments/ device/ filters/ forms/ home/ leaves/ organization/ permissions/
               presence/ (the day report) properties/ queries/ roster/ rules/ runtime/ seniority/ session/ shell/ tags/
               timeline/ transfer/ units/ view-state/ testing/ (test-only helpers, D-135)
  ui/          theme/ primitives/ patterns/ (rules/: the rule gate, shared by modules and engines) errors/ shell/ modules/ board/ engines/{registry,timeline,calendar,list,table}/
  i18n/        he/ keys
  app/         env/ time/ composition/ router/ shell/ (the browser's worker and install offer, D-183)
supabase/      migrations/ functions/commands/ (D-201)
e2e/           Playwright specs
docs/          ARCHITECTURE.md schema.sql DECISIONS.md ROADMAP.md FEATURE_MAP.md Design.md OPEN_ITEMS.md
               OPEN_ITEMS_ARCHIVE.md
```

## Quality gates

`npm run check` = typecheck (strict) + lint + layer boundaries + raw-value scan + i18n key
check + unit tests. CI also runs build (with production env validation) and Playwright
(desktop + mobile, RTL, axe). A pre-commit hook runs the fast subset and, from V0, rejects a
commit that crosses layers (D-075). Guardrail details: `docs/ROADMAP.md`, session 0.2.

## Open decisions

- None at present. The backend is Supabase and Vercel on free plans (D-200).
