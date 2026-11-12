# Sagol — Decision Log

Every architectural or product decision that shapes code is recorded here. A decision is
changed only by adding a new entry that supersedes it, never by editing history.
Format: `D-NNN — title` · date · status · decision · reason.

## Index

Navigation only (D-062): the entries below are the decisions. Every new entry adds its row
here in the same commit. When a later entry supersedes, amends, refines or extends an
earlier one, the earlier row's last column gets the new id. Entry bodies are never edited.

Layers: `contracts`, `domain`, `config`, `data`, `logic`, `ui`, `app`, `backend` (phase 8
track), `tooling`, `docs`. `all` = every code layer. A row lists every layer the decision
affects. Status is `accepted` unless marked. Changed by: sup = supersedes (in part),
am = amends, ref = refines, ext = extends.

| Id | Topic | Layers | Changed by |
|----|-------|--------|------------|
| D-001 | One person entity: every user is a soldier | contracts, data, backend | |
| D-002 | Command rank is the single user-defined level | contracts, domain, ui | ext D-029; ref D-095 |
| D-003 | Permissions are data: roles, rank bindings, grants | contracts, domain, data, logic, backend | sup D-028 (scope); ref D-040, D-053, D-056, D-060 |
| D-004 | System administrator is a grant, not a flag | domain, data, backend | ref D-059, D-079 |
| D-005 | Production bootstrap and account linking | contracts, domain, data, app, backend, ui | ref D-030; ref D-148, D-149; ref D-207, D-208; ref D-251 |
| D-006 | Development mode is the real system with a local identity | app, data, tooling | ref D-086 |
| D-007 | Pure layer `domain` | domain, data, logic, tooling | am D-035; ref D-203 |
| D-008 | Server-authoritative data layer | data, backend | ref D-090; ref D-201 |
| D-009 | Unit hierarchy: `parent_id` only, derived ancestry | contracts, domain, data, backend | |
| D-010 | Memberships are time-bounded rows | contracts, domain, data, backend | ref D-097 |
| D-011 | Multi-tenant from day one | contracts, data, backend | |
| D-012 | Leaves: whole days, overlaps, availability by union | contracts, domain, data, ui | ext D-032, D-049; ref D-070; ref D-111 |
| D-013 | Approval behavior | domain, data, logic, ui | ref D-041, D-063, D-064; ext D-049; ref D-114, D-115; ref D-117, D-121 |
| D-014 | Availability rules | contracts, domain, data, logic, ui | ext D-031; ref D-047, D-071, D-073; ref D-139, D-140, D-141; ref D-145 |
| D-015 | Tag categories with selection mode | contracts, domain, ui | ref D-065; ref D-130; ref D-260 |
| D-016 | Notion-like custom properties | contracts, domain, data, ui | ref D-065; ref D-176, D-177 |
| D-017 | Soft delete and audit columns | contracts, data, backend, ui | ref D-088, D-098 |
| D-018 | Sensitive fields in `soldier_private` | contracts, data, backend | ref D-096, D-102; ref D-153 |
| D-019 | Derived state is never stored | all | ref D-258 |
| D-020 | Contracts hold Zod schemas | contracts, config, data, logic, ui | ref D-074 |
| D-021 | Local adapter uses IndexedDB (Dexie) | data | |
| D-022 | Initial data through import/export, no mock data | data, ui | am D-033; ref D-050, D-171; ref D-261 |
| D-023 | Single-screen workspace, view state in URL | logic, ui | ref D-074, D-092, D-103, D-108; ref D-112, D-115; ref D-119, D-120; ref D-132 |
| D-024 | First designed component | ui | ref D-077 |
| D-025 | i18n keys and theme tokens inside UI sessions | ui, tooling | ref D-075 |
| D-026 | Libraries | all | ext D-034, D-077, D-080 |
| D-027 | Backend target (superseded) | backend | sup D-200 |
| D-028 | Unified scope model with relative anchors | contracts, domain, data, backend | ref D-053, D-054, D-055 |
| D-029 | Effective seniority with personal overrides | contracts, domain, backend | ref D-057 |
| D-030 | Account linking without email | contracts, domain, data, ui, backend | ref D-066, D-069; ref D-148, D-149; ref D-163 |
| D-031 | Availability rules: grouping, global scope, priority | contracts, domain, ui | ref D-067 (canonical population), D-071, D-072; ref D-139, D-140 |
| D-032 | User-managed leave types; availability is a partition | contracts, domain, ui | ref D-070; ref D-111, D-113; ref D-134 |
| D-033 | Simple first-run setup wizard | ui | ref D-180; ref D-261, D-262 |
| D-034 | Icons: lucide-react, semantic icon keys | ui | ref D-113 |
| D-035 | domain may import `@internationalized/date` | domain, tooling | am D-061 (tests) |
| D-036 | Type assertions only in adapters and tests | all, tooling | ext D-135 |
| D-037 | Node 24 LTS and exact dependency versions | tooling | |
| D-038 | Contract field names are schema column names | all | |
| D-039 | Schema drift test lives in contracts | contracts, tooling | |
| D-040 | Valid permission combinations | contracts, domain, ui | |
| D-041 | Settings defaults | contracts, data | ref D-064; ref D-115; ref D-121 |
| D-042 | Date and time representation in contracts | contracts, domain | |
| D-043 | Open items live in one file | docs | ref D-075 |
| D-044 | Ids of new rows are generated by the caller | contracts, data, logic | |
| D-045 | Command input conventions | contracts, data, logic | am D-087; ref D-101; am D-123; ref D-130 |
| D-046 | Error model (`Result`, `AppError` codes) | contracts, data, logic, ui | ref D-068, D-090; ref D-138 |
| D-047 | Soft-rule acknowledgment protocol | contracts, domain, data, ui | ref D-073; ref D-114; ref D-117; ref D-142 |
| D-048 | Auth and session contracts | contracts, data, logic, app | ref D-076, D-083 |
| D-049 | Leave command set | contracts, domain, data | ref D-063, D-064; ref D-117, D-118; am D-123 |
| D-050 | Import and export | contracts, data | ref D-171 |
| D-051 | Phase audits are separate, read-only sessions | docs | am D-078; ref D-126; ref D-154; ref D-170 |
| D-052 | Next-session model and effort recommendation | docs | ref D-075; sup D-154 |
| D-053 | What a permission scope covers (policy targets) | domain, data, backend | ref D-083, D-089, D-096; ref D-159 |
| D-054 | Policy unit = primary membership today | domain, backend | ref D-105 |
| D-055 | Unresolvable anchors give an empty scope | domain, backend | |
| D-056 | Only active, linked soldiers hold permissions | domain, backend | ref D-098 |
| D-057 | Subject rank constraints with missing ranks | domain, backend | ref D-157 |
| D-058 | What counts as an active permission source | domain, backend | |
| D-059 | Access-manager invariant (no lockout) | domain, data, backend | ref D-156, D-158 |
| D-060 | No privilege escalation | domain, data, backend | ext D-156 |
| D-061 | domain tests may import vitest | domain, tooling | ext D-074 |
| D-062 | Decision index; read rule unchanged | docs | sup D-081 (read rule); sup D-128 (the rest) |
| D-063 | Leave state machine and its permissions | domain, data, logic, ui, backend | ref D-114; ref D-117, D-118; ref D-124 |
| D-064 | Editing a leave and its approval | domain, data, logic, ui, backend | ref D-117, D-119; ref D-123 |
| D-065 | Property values, options and tag selection | domain, data, logic, ui, backend | ref D-130; ref D-176; ref D-186 |
| D-066 | Account-link matching and personal ids | domain, data, ui, backend | ref D-069; ref D-149 |
| D-067 | Filter semantics and canonical form | domain, data, logic, ui, backend | ref D-104, D-105; ref D-131; ref D-147 |
| D-068 | Schema issue mapping | domain, data, logic | |
| D-069 | `personal_id` is the military personal number | contracts, domain, data, ui, backend | |
| D-070 | Availability of a soldier on a day | domain, data, logic, ui, backend | ref D-133, D-134 |
| D-071 | Rule targets, populations and thresholds | domain, data, logic, ui, backend | |
| D-072 | Rule groups, priority and conflicts | domain, data, logic, ui, backend | |
| D-073 | Leave changes and rule enforcement | domain, data, logic, ui, backend | ref D-137, D-142; ref D-146 |
| D-074 | Config vocabularies (env, palette, breakpoints, views, URL, storage, dates) | config, data, logic, ui, app, tooling | ref D-092, D-103, D-104; ref D-112; ref D-132; ref D-185 |
| D-075 | Vertical slices: one session = one slice, one commit = one layer | all, tooling, docs | ref D-093, D-100; ref D-126; sup D-127 (layer order); ref D-154 |
| D-076 | The adapter grows by slice; no stubs, no dead controls | contracts, data, logic, ui, app, backend | ref D-085; ref D-152; ref D-215 |
| D-077 | Visual direction: Stone 3, self-hosted Heebo | ui, tooling | ref D-108; ref D-111 |
| D-078 | Audits follow milestones | docs | |
| D-079 | The bootstrap owner role holds every valid permission pair | data, backend | |
| D-080 | `fake-indexeddb` for data tests | data, tooling | |
| D-081 | Start-of-session reading follows the slice | docs | sup D-154 |
| D-082 | Go-live before completion features | data, backend, docs | |
| D-083 | One source of the current time: `TimeSource` | contracts, data, logic, app, tooling | ref D-107 |
| D-084 | Domain validates the organization time zone | domain, data, logic, ui | |
| D-085 | The `can` hint moves to V1, computed by the adapter | contracts, data, logic, ui, backend | ref D-091 |
| D-086 | V0 setup choices: dev env file, local bootstrap, time-zone picker, unsupported modes | tooling, data, ui, app | sup D-207 (unsupported modes) |
| D-087 | A moved unit lands last among its new siblings | contracts, data, backend | |
| D-088 | Archiving units and levels | contracts, domain, data, ui, backend | ref D-095, D-099; ref D-113 |
| D-089 | Permissions of the unit commands | domain, data, logic, ui, backend | |
| D-090 | The order of checks inside a command | data, backend, docs | ref D-114; ref D-117 |
| D-091 | The `can` hint: `session.can(checks)` | contracts, domain, data, logic, ui, backend | ref D-107; ref D-122 |
| D-092 | The units drawer: fields, moving, URL, surface | config, logic, ui | ext D-094; ref D-108; ext D-113 |
| D-093 | A new issue code lands after its message | contracts, ui, docs | sup D-127 |
| D-094 | The soldiers drawer: sections, fields, search | config, logic, ui | ref D-116; ref D-153 |
| D-095 | Command ranks: order by seniority, archive refused while held | contracts, domain, data, logic, ui, backend | |
| D-096 | Permissions of the roster commands | domain, data, logic, ui, backend | ref D-102; ref D-130 |
| D-097 | Changing a soldier's membership | domain, data, logic, ui, backend | |
| D-098 | Archiving a soldier | data, ui, backend | ref D-124 |
| D-099 | Unit names in a soldier's history | logic, ui | ref D-106 |
| D-100 | A new required port lands in `app` before `logic` | logic, app, docs | sup D-127 |
| D-101 | Commands store blank optional text as NULL | contracts, data, logic, backend | |
| D-102 | Reading private fields and placements needs only their own `view` | data, logic, ui, backend | |
| D-103 | The date window in the URL | logic, ui | ref D-129; ref D-211 |
| D-104 | The unit selector writes the filter | config, logic, ui | ref D-131; ref D-173; ref D-251 |
| D-105 | The rows of the timeline | logic, ui | ref D-109; ref D-131, D-133; ref D-214 |
| D-106 | What a row knows about its unit | logic, ui | ref D-122 |
| D-107 | Today follows the organization's day | domain, logic | ref D-160 |
| D-108 | The workspace bars and the timeline surface | config, ui | ref D-116; ref D-120; ref D-131; ref D-154; ref D-165; ref D-173; ref D-174; ref D-189; ref D-252; ref D-268 |
| D-109 | The reference day of a timeline row | logic | |
| D-110 | A branch and a pull request per session | docs, tooling | ref D-126; ref D-154 |
| D-111 | Leave bars on the timeline: type color, status by form, badges, lanes | ui | ref D-119; ref D-143, D-144 |
| D-112 | Uniform color mode of the timeline (`colors` in the URL) | config, logic, ui | ref D-174 |
| D-113 | The leave types drawer: fields, icons, order, archive | config, domain, data, logic, ui, backend | |
| D-114 | Creating a leave: permissions, order of checks, rules, reads | data, logic, backend | ref D-117; ref D-125; ref D-138 |
| D-115 | The new-leave form and its floating button | config, logic, ui | ref D-119, D-121; ref D-125, D-129; ref D-143; sup D-255 (floating "+"); ref D-267 |
| D-116 | Module buttons on a phone show their icon | ui | ref D-120; ref D-154; ref D-173; sup D-189 (bars); ref D-252 |
| D-117 | The leave commands after creation: transition, update, reschedule | data, logic, backend | am D-123; ref D-124 |
| D-118 | Leave comments: who reads, who writes | data, logic, ui, backend | |
| D-119 | The leave details drawer: bars as buttons, actions, one edit form, one thread | config, logic, ui | sup D-123 (edit form); ref D-129; ref D-143; ref D-255 |
| D-120 | The requests inbox: pending and closed; `LeaveQuery.window` may be NULL | contracts, config, data, logic, ui, backend | ref D-205; sup D-255 (destination) |
| D-121 | The "approve now" default lives in the user menu | data, logic, ui, backend | ref D-173; ext D-181; sup D-253 (place); ref D-255 |
| D-122 | The board waits for the permission hints | logic, ui | |
| D-123 | Editing a leave is one command | contracts, domain, data, logic, ui, backend | |
| D-124 | A leave of an archived soldier can only be cancelled | domain, data, logic, ui, backend | |
| D-125 | The new-leave form offers active soldiers only, until V6 | logic, ui | ref D-136 |
| D-126 | A slice is done when it is merged with CI green | docs, tooling | ref D-154 |
| D-127 | One commit = one layer, and every commit passes | all, tooling, docs | |
| D-128 | Closed items move to an archive; current state in ARCHITECTURE and Design.md | docs | ref D-154 |
| D-129 | Two behaviors of the leaves panel | logic, ui | |
| D-130 | Tags: categories, tags and a soldier's tags | domain, data, logic, ui, backend | ref D-260 |
| D-131 | The filter bar: soldier conditions | config, logic, ui | ref D-147; ref D-173; ref D-177 |
| D-132 | Leave conditions on the board | config, logic, ui | |
| D-133 | "Only who is missing" | config, logic, ui | ref D-161; ref D-213 |
| D-134 | Present and absent lists of a day | config, logic, ui | ref D-141; ref D-147; ref D-161; sup D-193 (panel) |
| D-135 | Shared test helpers live in a layer's `testing/` folder | tooling, logic | |
| D-136 | The new-leave form stays with active soldiers | logic, ui | |
| D-137 | Pending leaves counted by a rule: the requester acknowledges | domain, data | |
| D-138 | What a rule violation reveals | contracts, domain, data, ui, backend | |
| D-139 | The availability rule commands | domain, data, logic, backend | |
| D-140 | The rules module | config, logic, ui | |
| D-141 | The heat row | config, logic, ui | ref D-173 |
| D-142 | Live rule warnings and the acknowledgment dialog | logic, ui | ref D-143; ref D-145, D-146; ref D-162 |
| D-143 | Timeline drag: move, resize and create, with live feedback | config, logic, ui | ref D-144 |
| D-144 | The touch path of the timeline, and its lanes on a phone | config, ui | |
| D-145 | Approving shows the rules' answer, not a live warning | logic, ui | ref D-255 |
| D-146 | A live warning lists hard and soft rules together | logic, ui | |
| D-147 | "A unit and below" counts archived sub-units on the days served; the chip of an unread filter | logic, ui | ref D-174 |
| D-148 | Asking to link: the request, auto-link, withdrawing | data, logic, ui, backend | |
| D-149 | Reviewing a link request: who may be named, what approval writes | domain, data, logic, ui, backend | ref D-163, D-164 |
| D-150 | The account-links module | config, logic, ui | |
| D-151 | The onboarding of an identity with no account | logic, ui | ref D-160; am D-168 |
| D-152 | Deferred from V9: invite links, revoking a link, restoring archived rows | docs | ref D-163 |
| D-153 | The invite email field | logic, ui | |
| D-154 | The Claude Code harness replaces the session rituals | docs, tooling | ref D-170; ref D-172; ref D-263, D-264 |
| D-155 | The phone's module buttons scroll inside the bottom bar | ui | ref D-165; ref D-189; ref D-252 |
| D-156 | Every way of giving a role is guarded; a grant stays within the granter's reach | domain, data, backend | |
| D-157 | A holder without seniority gets only `any`; a rank write is checked before and after | domain, data, backend | |
| D-158 | An access manager holds the three pairs with `any` | domain, backend | |
| D-159 | `self` lets a soldier see their own unit chain | domain, backend | |
| D-160 | Without `organization:view` the board uses the device's day | logic, ui | |
| D-161 | Presence lists leave out soldiers whose leaves the actor cannot read | logic, ui | |
| D-162 | Live rule warnings only for an actor who reads everything a rule counts | logic, ui | |
| D-163 | Revoking an account link | contracts, data, logic, ui, backend | |
| D-164 | Link-request candidates stay computed | data | |
| D-165 | The roles and grants modules; "more" on a phone | config, logic, ui | ref D-173 |
| D-166 | A grant's window is whole days in the organization's zone | logic, ui | ext D-169 |
| D-167 | My requests: the soldier's own leaves, open and history | config, logic, ui | sup D-255 (tab); ref D-265 |
| D-168 | A rejected link request is told to its identity | contracts, data, logic, ui | |
| D-169 | The grants list moves to the next state on its own | logic | |
| D-170 | Full autonomy: Claude decides product choices and runs audits without stopping | docs, tooling | ref D-172 |
| D-171 | Import runs the built commands and stops at the first refusal | contracts, data, logic, ui | ref D-173 |
| D-172 | Parallel tracks: two sessions build the roadmap at once | docs, tooling | |
| D-173 | Navigation rebalance: daily work in the bar, setup in a side panel | contracts, config, logic, ui | ref D-175; ref D-178; ext D-181; sup D-189 (bars); ref D-213; sup D-254 (pins, sections); ref D-252, D-253, D-256 |
| D-174 | The list, the table and the calendar share the board's model and frame | logic, ui | ref D-214; ref D-268 |
| D-175 | The bar names the unit in scope, not the organization | ui | ref D-251 |
| D-176 | The properties module, and the rows behind reference values | data, logic, ui | ref D-186 |
| D-177 | Property chips in the filter bar | logic, ui | |
| D-178 | A new navigation module: its entry first, then the enum, then its section | contracts, config, ui | ref D-254 |
| D-179 | Deployments, collective leave, copies of a leave and personal seniority on screen | domain, data, logic, config, contracts, ui | ref D-212; ref D-257, D-258, D-259; ref D-267, D-268, D-270 |
| D-180 | The organization's setup: steps, who sees them, where it opens | config, logic, ui | ref D-251, D-254, D-256, D-262 |
| D-181 | The dark set, and the soldier's choice of appearance | contracts, logic, ui | ref D-187; ref D-253 |
| D-182 | The installable app: manifest, icons and head, from the theme and i18n | config, ui, tooling | |
| D-183 | The service worker caches the app shell only, and a new version waits for the soldier | config, logic, ui, app, tooling | |
| D-184 | The install offer in the user menu, and sign-in in the installed app | logic, ui, app | ref D-253 |
| D-185 | Offline: the shell opens, a remote build waits for the network | ui, app | |
| D-200 | Backend: Supabase and Vercel, free plans | backend, app | ext D-209 |
| D-201 | One command gateway runs the adapter's own code on Postgres | data, backend, tooling | ref D-203; ref D-204; ref D-208, D-209; ref D-188 |
| D-202 | The database's own guarantees: triggers | backend | am D-203 |
| D-203 | No client reaches a table: the policy stays in the domain | backend, data, tooling | ref D-188 |
| D-204 | The remote adapter: one POST per call to the command gateway | data, config, app | ref D-207 |
| D-205 | The inbox's closed section reads a span of dates around today | config, logic | |
| D-206 | A local export loads into the backend once, through a SQL function | backend, data | |
| D-207 | Google sign-in through Supabase Auth, loaded only in production modes | contracts, config, data, logic, ui, app | ref D-184 |
| D-208 | The bootstrap claimant is a data dependency: the owner email on the server | data, backend | |
| D-209 | Environments, the Vercel deploy and the function bundle | app, config, data, backend, tooling | |
| D-210 | Code splitting: the env's adapter pair and libraries in chunks of their own | data, app, tooling | ref D-183 |
| D-186 | Who creates or changes an entity reads its property definitions | data, logic, ui | |
| D-187 | A preference save that fails says so, and the menu shows the stored row | logic, ui | |
| D-188 | Postgres extensions live in the `extensions` schema | backend, docs | |
| D-189 | Bars rebalance and declutter: a phone tab bar, icons with tooltips | config, i18n, ui | ext D-190; ext D-191; sup D-252 (bars); ref D-256, D-257 |
| D-190 | A phone on its side keeps the phone's bars, and a wide phone folds the context row into the top | config, ui, tooling | sup D-252 (folded top row) |
| D-191 | Edge to edge: the canvas under the cutouts, what can be pressed inside the safe area | ui, tooling | ref D-252 |
| D-192 | The board's corner and name column are one opaque surface | ui | |
| D-211 | The range picker: day, week, month or a whole rotation | config, logic, ui | ref D-217, D-220, D-256, D-257 |
| D-212 | "סבב" in the interface; `deployment` in code | config, i18n, ui | ref D-219, D-250, D-257 |
| D-213 | "Only who is missing" is a filter condition | logic, ui | |
| D-214 | The board's sort | config, logic, ui | |
| D-215 | Data and controls, not prose | i18n, ui | ref D-250 |
| D-193 | The day report (דוח 1): who is present, absent, leaving and returning | domain, config, logic, ui | |
| D-194 | Reasons in the day report: off by default, remembered per device, only what the viewer may read | config, data, logic, ui | |
| D-195 | The day report as text for a messaging app | config, i18n, logic | |
| D-196 | The day report as an image: drawn on a canvas in the light tokens | ui | |
| D-197 | A device store for conveniences | config, data, logic, tooling | |
| D-216 | Every request belongs to a rotation | contracts, data, logic, backend | |
| D-217 | The workspace is scoped to the active or upcoming rotation, silently | logic, ui | |
| D-218 | No request surface without a rotation in scope; one empty state | logic, i18n, ui | |
| D-219 | The setup wizard ends by opening the first rotation | logic, i18n, ui | |
| D-220 | Rotation membership in practice: references, reads and the form | contracts, data, logic, backend, ui | |
| D-250 | Two vocabularies: everyday words, and the words of managing a unit | i18n, ui, docs | |
| D-251 | "ארגון" never shows; the user manages "היחידה שלי", the root unit | domain, logic, i18n, ui | |
| D-252 | One navigation model: a context strip at the top, a destination strip at the bottom | config, ui | ref D-265, D-266 |
| D-253 | The profile is personal only | ui | |
| D-254 | One entry for managing the unit: "ניהול יחידה" | config, i18n, ui | |
| D-255 | One requests hub: mine, awaiting me, and a new request | logic, ui | sup D-265 (הבקשות שלי); ref D-266 |
| D-256 | One path for each action | ui | |
| D-257 | A rotation is a mode of the system: one at a time, and routine without one | contracts, domain, data, logic, ui, backend | ref D-266 |
| D-258 | A rotation's life: dates, plus one stored fact for its close | contracts, domain, data, logic, ui, backend | |
| D-259 | Who is in a rotation: the whole unit by default, a list when chosen | domain, data, logic, ui | |
| D-260 | Tags have two lifetimes: persistent, or for one rotation | contracts, domain, data, logic, ui, backend | |
| D-261 | Templates: a starter unit in config, names in i18n, applied through the commands | config, i18n, logic, ui | |
| D-262 | The setup: pick, adjust, done | domain, data, logic, ui, backend | |
| D-263 | Five journeys are the acceptance tests of V25, V26 and V27 | docs, tooling | ref D-265 |
| D-264 | Order of the simplification slices | docs | am D-271 |
| D-265 | Home follows permissions: the board, or "שלי" | logic, ui | |
| D-266 | The quick action follows the role, then the mode | logic, ui | |
| D-267 | Several requests at once | contracts, domain, data, logic, ui, backend | |
| D-268 | The board's visual language: presence is quiet, absence is a hole | ui | |
| D-269 | דוח 1 as a workflow: each unit confirms, one owner sends it up | contracts, domain, data, logic, ui, backend | |
| D-270 | The leave-round planner | domain, logic, ui | |
| D-271 | Order of the slices after the journeys matrix | docs | |
| D-272 | The spreadsheet review: refinements of existing slices, no new ones | docs | |

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
2026-11-03 · superseded by D-200
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

## D-053 — What a permission scope covers (policy targets)
2026-11-04 · accepted · refines D-003, D-028
`can()` checks a permission against a **target** of one of three kinds:
- **soldier** (leaves, comments, soldier rows, private fields, memberships, seniority
  overrides, access grants by grantee): covered by `self` (the holder only), by a `soldier`
  anchor (that soldier), by a unit scope when the soldier's primary unit today is the
  anchor unit (or a descendant, with `include_descendants`), and by `organization`.
- **unit** (units, deployments, availability rules with a scope unit, placements): covered
  by a unit scope (the anchor unit, or a descendant with `include_descendants`) and by
  `organization`.
- **organization** (organization, unit levels, command ranks, tags, leave types,
  properties, roles and rank bindings, data transfer, global availability rules, top-level
  units): `view` is covered by any non-empty scope; every other action only by
  `organization`.
Domain lists the target kinds each resource accepts (`TARGET_KINDS_BY_RESOURCE`). A
target of another kind is refused.
Domain is clock-free: callers pass `today` (organization time zone) and `now`.
**Why:** product owner approved in session 1.2a. Lets the baseline role show reference
data to everyone without letting a unit commander change organization-wide data.

## D-054 — A soldier's unit for policy is the primary membership today
2026-11-04 · accepted · refines D-028
The home unit of a permission holder (relative anchors) and the unit of a subject soldier
are the unit of the soldier's `primary` membership that covers today. A soldier with no
such membership is covered only by `organization`, `self` and `soldier` scopes, and holds
no relative unit scope.
**Why:** product owner approved in session 1.2a.

## D-055 — Unresolvable anchors give an empty scope
2026-11-04 · accepted · refines D-028
An anchor that cannot be resolved (more steps up than the tree has, no ancestor at the
level, a holder without a home unit) resolves to an empty scope that covers nothing.
`home_ancestor_at_level` includes the home unit itself.
**Why:** product owner approved in session 1.2a. Fails closed.

## D-056 — Only active, linked soldiers hold permissions
2026-11-04 · accepted · refines D-003
A soldier holds permissions (baseline, rank bindings and grants) only while
`status = 'active'`, not archived, with a non-revoked account (`soldier_accounts`).
Otherwise the soldier holds nothing.
**Why:** product owner approved in session 1.2a (active and not archived); the account
condition is D-003's "every active linked soldier", applied to every source.

## D-057 — Subject rank constraints with missing ranks
2026-11-04 · accepted · refines D-029
`subject_rank_constraint` compares effective seniority today. A subject without seniority
(no rank and no override) is junior to every holder with seniority. A holder without
seniority gets only `any` permissions. `junior` excludes the holder's own record,
`junior_or_equal` includes it. The constraint applies to soldier targets only.
**Why:** product owner approved in session 1.2a.

## D-058 — What counts as an active permission source
2026-11-04 · accepted
Archived roles and archived rank bindings grant nothing. An access grant is active when
`revoked_at` is NULL and `valid_from <= now < valid_to` (NULL `valid_to` = open).
Timestamps are compared as instants, not as strings (OI-009).
**Why:** product owner approved in session 1.2a.

## D-059 — Access-manager invariant (no lockout)
2026-11-04 · accepted · refines D-004
An access manager is an active, linked soldier (D-056) who holds `access_grants:create`,
`access_grants:delete` and `roles:update` at `organization` scope from sources without
expiry (a rank binding, or a grant without `valid_to`). Every write that can change
permissions is checked on the state after the change: if no access manager remains, the
data layer rejects it with `last_access_manager`.
**Why:** product owner approved in session 1.2a. A grant that expires later would lock the
organization out with no write to reject.

## D-060 — No privilege escalation
2026-11-04 · accepted · refines D-003
An actor may grant a role, or add `(resource, action)` pairs to a role, only when the actor
already holds every one of those pairs (at any non-empty scope). Removing pairs is not
limited. A missing pair makes the command fail with `forbidden`.
**Why:** product owner approved in session 1.2a. Without it, `roles:update` or
`access_grants:create` would let anyone give themselves any permission.

## D-061 — domain tests may import vitest
2026-11-04 · accepted · amends D-035 for test files only
`src/domain/**/*.test.ts` may also import `vitest`. Production domain code still imports
`contracts` and `@internationalized/date` only. Enforced by `.dependency-cruiser.cjs`.
**Why:** domain is unit-tested (ROADMAP 1.2, 1.3), like contracts (D-039).

## D-062 — Decision index; read rule unchanged
2026-11-04 · accepted · partly resolves OI-015
- `DECISIONS.md` starts with an index: one row per decision with its topic, every layer it
  affects, and the later entries that supersede, amend, refine or extend it. A new entry
  adds its row in the same commit, and updates the "changed by" column of the rows it
  changes. The index is navigation; entry bodies are still never edited.
- The read rule does not change: every session reads all of `DECISIONS.md` and the other
  start-of-session documents (`CLAUDE.md`).
- Closed open items are not archived now.
- The rest of OI-015 (archive, narrower read rule, condensed ARCHITECTURE) waits for a new
  trigger: reading the start-of-session documents takes more than ~10% of the context
  window, or sessions are compacted before they finish.
**Why:** product owner decision in session 0.5. The index makes supersessions and layer
impact visible at once and prepares a narrower read later, without the risk of a session
missing a decision today.

## D-063 — Leave state machine and its permissions
2026-11-04 · accepted · refines D-013, D-049
Status after each transition (absent = refused):

| from | approve | reject | cancel | reopen |
|------|---------|--------|--------|--------|
| pending | approved | rejected | cancelled | — |
| approved | — | rejected | cancelled | pending (undo the approval) |
| rejected | — | — | — | pending |
| cancelled | — | — | — | pending |

- Permissions, checked with `can()` on the leave's soldier: approve and reject need
  `leaves:approve`; cancel needs `leaves:delete`; reopen needs `leaves:approve` from
  `approved` and `leaves:create` from `rejected` or `cancelled` (like a new request).
  Creating needs `leaves:create` (`duplicate`: `leaves:duplicate`), plus `leaves:approve`
  when created as approved (D-013).
- Approve and reject record the actor and the time in `reviewed_by` / `reviewed_at`.
  Reopen clears them (a pending leave has no review). Cancel keeps them.
- Events: `approved`, `rejected`, `cancelled`, `reopened`, with `from_status` / `to_status`.
- A refused step answers `archived` when the leave is cancelled, else `invalid_transition`.
- Comments may be added in any status, with `leave_comments:create` (shared) or
  `internal_comments:create` (internal). Only the author edits or archives a comment
  (anyone else: `forbidden`). An archived comment answers `archived`.
**Why:** product owner decision in session 1.2b.

## D-064 — Editing a leave and its approval
2026-11-04 · accepted · refines D-013, D-041, D-049
- `update` (type, effect override, reason, properties) and `reschedule` (dates) need
  `leaves:update` and are allowed on `pending` and `approved` leaves only. A rejected or
  cancelled leave is reopened first (D-063).
- A **material** edit of an approved leave (the dates move, or the type or the effect
  override changes) follows `reschedule_policy`: it stays approved only under
  `keep_if_can_approve` when the actor holds `leaves:approve` over the soldier, and the actor
  becomes its reviewer (the actor approves the new state). Otherwise it returns to pending
  and the review is cleared. Reason and properties never change the status.
- Events `updated` / `rescheduled` carry `from_status` / `to_status` only when the status
  changes.
- A leave type with `requires_reason` needs a non-blank reason (`reason_required`).
**Why:** product owner decision in session 1.2b: a type change can change availability as
much as a date move does.

## D-065 — Property values, options and tag selection
2026-11-04 · accepted · refines D-015, D-016
- "No value" is an absent key. NULL, blank text and empty lists are not stored
  (`property_value_invalid`), so emptiness has one representation.
- Value shapes: text = non-blank string; number = finite number; date = calendar date
  string; boolean; select = id of a current option; multi_select = non-empty list of
  distinct current option ids; soldier_ref / unit_ref = an id (its row is checked by the data
  layer).
- A write checks only new or changed values (JSON equality, key order ignored): unknown
  definition or one of another entity type → `property_unknown`; archived definition →
  `reference_archived`; wrong shape → `property_value_invalid`. Unchanged values that became
  invalid later (option removed, definition archived) are left alone, so an unrelated edit
  never fails.
- Required, non-archived definitions are enforced on creation and on writes that change the
  properties (`property_required`).
- Only `select` / `multi_select` have options (`property_options_invalid`). Option ids and
  labels (case and spaces ignored) are distinct (`duplicate_item`). Removing an option is
  always allowed; stored values keep its id.
- Tags: a soldier holds at most one tag of a `single` category, archived tags included
  (`tag_single_selection` at the second). Switching a category to `single` is refused while
  a soldier holds two of its tags.
- Domain reports paths relative to the row (`properties.<id>`); the data layer nests them
  under the input field (`changes`).
**Why:** product owner decision in session 1.2b (check changes only).

## D-066 — Account-link matching and personal ids
2026-11-04 · accepted · refines D-030
- **Names** compare normalized: niqqud and accents removed, geresh, gershayim and quotes
  removed, hyphen and maqaf as spaces, final letters as regular letters, lower case, single
  spaces, trimmed. A name matches when first and last name are equal, in order or swapped.
  A name that normalizes to nothing matches nobody.
- **Personal ids** are normalized: spaces, dashes and dots removed, an all-digit id without
  leading zeros, letters upper case; nothing left = no id. The data layer stores every
  personal id in this form (`soldier_private.personal_id`,
  `account_link_requests.claimed_personal_id`), so the unique index catches one person
  typed two ways. Emails compare trimmed and lower case.
- **Candidates** are soldiers that are not archived and have no account row (a revoked one
  included: the schema allows one account row per soldier). Inactive soldiers are included.
  Personal-id matches come first, then name matches; each soldier once.
- **Auto-link** only when exactly one candidate has the personal id and an invite email equal
  to the verified email. Otherwise a pending request.
- **Review:** `accounts:approve` over any candidate; without candidates, at organization
  scope. The same check decides which requests a reviewer sees. Only a pending request is
  reviewed or cancelled (`invalid_transition`).
- **Enrichment:** approval fills the soldier's missing personal id from the request. Names
  are NOT NULL and never overwritten.
**Why:** product owner decision in session 1.2b.

## D-067 — Filter semantics and canonical form
2026-11-04 · accepted · refines D-031 (canonical population)
- A filter is evaluated for one soldier on one day: `unit` uses the primary membership that
  day (with descendants when asked), `seniority` the effective seniority that day (none
  never matches). Rank, status, tags and properties are current values.
- Property operators per data type: text `equals`, `not_equals`, `contains`, `any_of`;
  number `equals`, `not_equals`, `any_of`, ordering; date `equals`, `not_equals`, ordering;
  boolean `equals`, `not_equals`; select and references `equals`, `not_equals`, `any_of`;
  multi_select `contains`, `any_of`. Every type also has `is_empty` / `is_not_empty`.
  Operand: NULL for emptiness, a non-empty list for `any_of`, one item otherwise; option
  operands must be current options when the filter is written.
- Negative operators are exact complements (no value matches `not_equals`). Text compares
  folded (case and surrounding spaces ignored). A stored value that does not fit its type
  counts as empty. A property condition whose definition is missing or belongs to another
  entity matches nobody.
- Writes check property conditions (`property_unknown`, `filter_operator_invalid`,
  `invalid_value`, paths from `where`); domain lists the referenced rows for the data
  layer's integrity checks.
- **Canonical form** is structural: id lists sorted without repetition, nested and/or
  flattened, repeated children removed, children sorted, one-child and/or unwrapped, double
  negation removed, a one-tag `all` written as `any`, `any_of` operands sorted. Equal keys
  mean the same population (rule targets, D-031). Filters equivalent only by meaning keep
  different keys. Filters are stored as entered.
**Why:** product owner decision in session 1.2b (complement, case-insensitive); the
canonical form follows D-031.

## D-068 — Schema issue mapping
2026-11-04 · accepted · refines D-046
One pure domain function (`issuesFromSchema`) maps Zod issues, typed structurally, to field
codes: missing or NULL → `required`; blank text that must not be empty → `required`;
non-integer → `not_integer`; wrong type → `invalid_type`; length bounds of text and lists →
`too_short` / `too_long`; numeric bounds → `too_small` / `too_big`; formats →
`invalid_format`; contract refinements keep their `IssueCode`; each unknown key →
`unknown_field` at its own path; anything else → `invalid_value`. Each `(path, code)`
appears once. The data adapter and the forms (through logic) use the same function.
**Why:** OI-016; one mapping keeps adapter and form errors identical.

## D-069 — `personal_id` is the military personal number
2026-11-05 · accepted · refines D-030, D-066
`soldier_private.personal_id` and `account_link_requests.claimed_personal_id` hold the
soldier's military personal number (מספר אישי), not the national identity number (תעודת
זהות). No identity-number check digit is validated; normalization stays as in D-066. UI
labels say "מספר אישי". Column names do not change.
**Why:** product owner clarification in session 0.6.

## D-070 — Availability of a soldier on a day
2026-11-05 · accepted · refines D-012, D-032
- For a soldier and a day, domain derives one status and the leaves covering the day. Pending
  and approved leaves are listed, each with its effective effect and whether it counts.
  Rejected and cancelled leaves are never listed.
- A leave counts when its effective effect is `unavailable` and it is approved, or pending
  while pending leaves are counted (a rule's `count_pending_as_unavailable`; a view chooses
  its own). The soldier is unavailable when any listed leave counts.
- A leave whose type is missing takes the default effect `unavailable`. Archived types keep
  their effect.
- A day's partition lists every given soldier once (repeated ids once) in the present or the
  absent list. A test enforces it on a generated world.
**Why:** the D-012 / D-032 invariant, made exact in session 1.3.

## D-071 — Rule targets, populations and thresholds
2026-11-05 · accepted · refines D-014, D-031
- **Days:** a rule applies on a day when it is enabled, not archived, inside
  `effective_from` … `effective_to` (NULL = open), and, with a deployment, the deployment is
  not archived and runs that day (NULL end = open). The deployment limits the days and the
  soldiers.
- **Evaluated units:** `unit_tree` = the scope unit (NULL = the whole organization);
  `each_child` = its direct children (global: the top-level units);
  `each_descendant_at_level` = its descendants at the level, not the scope unit itself
  (global: every unit at the level). Only units that are not archived and inside their
  `valid_from` … `valid_to` that day; an archived scope unit gives no targets. The evaluated
  unit is the target's scope unit, so a `unit_tree` rule on platoon 1 and an `each_child`
  rule evaluated on platoon 1 share targets (D-031).
- **Population:** soldiers that are active, not archived, have a primary membership that day
  inside the evaluated unit's tree (any unit for the whole organization), match the
  population filter that day (D-067), and, with a deployment, are its members that day
  (member dates, NULL = the deployment's dates). Soldiers placed directly on the scope unit
  of `each_child` / `each_descendant_at_level` belong to no target.
- **Thresholds** are counts of available soldiers. A minimum rounds up and a maximum rounds
  down (`percent`: value % of the population), which is exactly "available / population ≥
  min %" and "≤ max %". Values are compared in hundredths, so float error never moves a
  count. Violations report `required` and `actual` as counts.
**Why:** product owner decisions in session 1.3 (exact rounding, active placed soldiers,
deployment days and members, soldiers on the scope unit not counted).

## D-072 — Rule groups, priority and conflicts
2026-11-05 · accepted · refines D-031
- **Groups:** `group_by = tag` evaluates the tags the population filter selects positively
  (a `tag` condition with `any` / `all` outside a negation, or `none` under one) plus the tags
  held by the target's soldiers, limited to `group_tag_category_id` when set. `command_rank`
  does the same with ranks. Archived tags and ranks form no group. A selected group with no
  soldier is still evaluated, so "at least 2 drivers" fails in a platoon without drivers.
- **Priority:** on one target (evaluated unit, canonical population key, group, day) the
  rules with the highest priority are effective; the others are overridden and never
  violate. Priority is resolved on all targets before a result is narrowed to some soldiers.
- **Conflicts:** among the effective rules of a target, a largest required minimum above a
  smallest allowed maximum (as counts, that day) is a configuration conflict, listing the
  rules that set those bounds. One rule can conflict with itself after rounding (50 % … 50 %
  of 1 soldier = at least 1, at most 0).
**Why:** product owner decision in session 1.3 (selected groups evaluated even when empty);
the rest follows D-031.

## D-073 — Leave changes and rule enforcement
2026-11-05 · accepted · refines D-014, D-047
- A leave command evaluates the effective rules before and after the change, on the days any
  changed leave covers (old and new dates) and on the targets that count its soldier. A
  broken bound is a violation only when the change makes it worse: fewer available under a
  minimum, or more available over a maximum. Cancelling or rejecting never breaks a minimum,
  and a change that keeps the count never violates.
- The command's answer: any hard violation → `rule_violation` with the hard ones; else a soft
  violation whose rule is not acknowledged → `rule_acknowledgment_required` with every soft
  violation; else the change proceeds and the broken soft rules' ids are stored in
  `leave_events.acknowledged_rule_ids`.
- Only leave commands are gated (D-014). Membership, tag, status and rule changes are not;
  their effect shows in the evaluation.
**Why:** product owner decision in session 1.3 (only a change that makes it worse).

## D-074 — Config vocabularies
2026-11-05 · accepted · refines D-020, D-023; extends D-061 (config tests)
`config` holds, as constants with no logic beyond validation:
- **Env:** `EnvSchema` and `parseEnv(raw, { production })` over `VITE_AUTH_MODE`,
  `VITE_DATA_ADAPTER`, `VITE_REMOTE_URL`, `VITE_REMOTE_ANON_KEY`, built from `AuthMode` and
  `DataAdapterMode` (D-048). Blank counts as unset. The remote adapter requires URL and key;
  a production parse refuses `DEVELOPMENT_ONLY_AUTH_MODES`. It returns issues
  (`missing`, `invalid`, `development_only`, `required_for_remote`), never throws.
- **Palette:** 12 closed `color_key` values: red, orange, amber, lime, green, teal, cyan,
  blue, indigo, purple, pink, gray. Adding one is a config + theme change, no schema change.
- **Breakpoints:** Tailwind's `sm 640`, `md 768`, `lg 1024`, `xl 1280`; desktop (top bar,
  side drawer) from `md`, mobile (bottom bar, bottom sheet) below.
- **Views and URL:** view ids `timeline`, `calendar`, `list`, `table`, default `timeline`;
  search params `view`, `from`, `to`, `filter`, `panel`, `entity`. Panel ids and the
  encoding of `filter` belong to the sessions that build them.
- **Storage:** IndexedDB name `sagol`; one `localStorage` key, the local identity (D-006).
- **Dates:** locale `he-IL`, week starts on Sunday, six `Intl` format presets. The
  organization time zone stays in its settings.
- `src/config/**/*.test.ts` may also import `vitest`, like contracts (D-039) and domain
  (D-061). Enforced by `.dependency-cruiser.cjs`.
**Why:** product owner chose the 12-color palette and Tailwind breakpoints in session 1.4.
Default view, URL names, storage names and the Sunday week start are the session's
proposals, changeable by a later entry.

## D-075 — Vertical slices: one session = one slice, one commit = one layer
2026-11-08 · accepted · supersedes the session rule in ARCHITECTURE iron rule 1 and
`CLAUDE.md`; refines D-025, D-043, D-052
- Work is ordered by `docs/FEATURE_MAP.md`. Each slice takes one feature from the data layer
  to the screen, in dependency order, and ends with something the owner can run.
- One session = one slice (or one non-code track). A slice that will not fit is split at a
  smaller demo, and the split is recorded in the map.
- One commit = one layer, in the order `docs/contracts` → `domain` → `config` → `data` →
  `logic` → `i18n` + `ui` → `app` → `e2e`. Each commit passes `npm run check`. A pre-commit
  guard (added in V0) rejects a commit whose `src/` files cross layers. `i18n` with `ui` is
  the one allowed pair (D-025). Files outside `src/` (docs, scripts, e2e, root config) are
  not a layer. `src/main.tsx` counts as `app`.
- Layer boundaries do not change: `index.ts` only, aliases only, `npm run check:layers`.
- A fix goes in the layer that owns it, in its own commit in the same slice when the slice
  needs it. Otherwise it becomes an open item with a target slice.
- A model change updates `schema.sql`, `DECISIONS.md` and contracts together in one commit,
  first in the slice, after the owner's approval when it needs a decision.
- A slice is done when `npm run check` and `npm run build` are green, its demo runs in
  Playwright (desktop, mobile, RTL, axe), and the handoff gives the owner steps to see it in
  a browser.
- Roadmap rows and open-item targets use slice ids (`V3`). Rows 2.x to 7.x and 8.5 are
  replaced (mapping in the map). Rows 8.1 to 8.4 keep their ids.
**Why:** product owner decision in session 0.7. Building bottom-up gave no sign that the
product looks right or works. A tool guarding each commit keeps the separation at least as
strict as session discipline did.

## D-076 — The adapter grows by slice; no stubs, no dead controls
2026-11-08 · accepted · refines D-048
- `DataAdapter` stays the full contract. While an adapter is incomplete, its type is a `Pick`
  of `DataCommands` and `DataRepositories` holding what exists. Each `logic` module declares
  the narrow port it needs, and `app` wires what exists. No path returns "not implemented".
  When every group exists, each adapter `satisfies DataAdapter`.
- A control renders only when its action works end to end. Lists of choices come from what
  exists (the view switcher reads the engine registry).
- Every read and write goes through the policy from the first command. The owner passes
  because of a real grant (D-006).
- The shared contract suite grows with each slice and takes a `seed` port per adapter (local:
  direct store writes, inside test files only). Denial paths are tested before the screens
  that create their rows exist.
**Why:** a stub is a workaround that fails at runtime, while a narrow type fails at compile
time. Product owner asked for no components that do not work (session 0.7).

## D-077 — Visual direction: Stone 3, self-hosted Heebo
2026-11-08 · accepted · refines D-024; extends D-026
- The owner's canvas artboard "אבן 3" is the visual direction, not a final spec. Its values
  are in `docs/FEATURE_MAP.md`, section 6. V0 turns them into semantic tokens and primitives.
  `docs/Design.md` is still derived from what is built (D-024) and binds later UI.
- Heebo is self-hosted from an npm package (`@fontsource-variable/heebo`, pinned in V0), never
  loaded from a third party at runtime.
- Glass surfaces have solid fallbacks under `prefers-reduced-transparency`.
- A control in the mock is not a product decision by itself (OI-032).
**Why:** product owner decisions in session 0.7. Self-hosting avoids third-party requests and
works without a network.

## D-078 — Audits follow milestones
2026-11-08 · accepted · amends D-051
Audit rows follow the milestones of `docs/FEATURE_MAP.md`: A1 (contracts and domain) stays,
A2 after M1, A3 after M2, A4 after M3, A5 after M4, A6 after M5, A7 after M6. A8 is retired.
A1 may run alongside V0: its findings become open items with a target slice. Everything else
in D-051 stays: audits are separate, read-only and opened by the owner.
**Why:** phases no longer exist as build stages. Product owner chose in session 0.7 not to hold
V0 for A1, which reads only and can run in parallel.

## D-079 — The bootstrap owner role holds every valid permission pair
2026-11-08 · accepted · resolves OI-017 · refines D-004
`bootstrapOwner` creates an owner role with every pair of `PERMISSION_ACTIONS_BY_RESOURCE`,
granted at `organization` scope without expiry. After that it is an ordinary role and grant,
which can be changed and transferred under D-059 and D-060.
**Why:** D-060 lets nobody grant a pair they do not hold. An owner holding only access
management could never give anyone, itself included, any other permission, and the
organization would be stuck. Product owner approved in session 0.7.

## D-080 — `fake-indexeddb` for data tests
2026-11-08 · accepted · resolves OI-007 · extends D-026
`fake-indexeddb` is a pinned dev dependency, used only by test setup so Dexie runs under Node.
Playwright covers the real browser. Added in V0.
**Why:** product owner approved in session 0.7. The contract suite must run in `npm run check`.

## D-081 — Start-of-session reading follows the slice
2026-11-08 · accepted · supersedes the read rule of D-062; resolves OI-015 part (c)
A slice session reads `ARCHITECTURE.md`, `ROADMAP.md`, `OPEN_ITEMS.md`, the latest handoff, and
`FEATURE_MAP.md` sections 2 and 3 with its slice card. In `DECISIONS.md` it reads the index, the
baseline entries and the entries its card lists, plus whatever their "Changed by" column names
and any other entry the work turns out to touch. In `schema.sql` it reads the tables the slice
touches. Audits and docs sessions that change decisions read `DECISIONS.md` in full. When
unsure, read more.
**Why:** product owner decision in session 0.7. The documents reached about 36k tokens, and
slice sessions need more room for work than single-layer sessions did. The index tags every
layer a decision affects, so a narrower read stays safe (D-062).

## D-082 — Go-live before completion features
2026-11-08 · accepted
M5 (import/export and rows 8.1 to 8.4) comes before M6 (more views, custom properties,
deployments and batches, setup wizard, Dark Mode). From M6 on, each slice also updates the
remote adapter and server functions, and the contract suite holds both adapters to the same
behavior. M3 and M4 do not depend on each other: the owner picks their order at the end of M2
(OI-031).
**Why:** IndexedDB lives on one device (D-021), so two real people can use the product only on
the backend. Product owner approved in session 0.7.

## D-083 — One source of the current time: `TimeSource`
2026-11-08 · accepted · refines D-048, D-053 · from audit A1, OI-004
`contracts` defines `TimeSource`, an interface beside `IdentitySource` with `now()` returning a
`Timestamp`. `DataAdapterFactory` takes it beside `identity`. The only implementation that reads the
system clock lives in `app`, which is the path OI-004 adds to `RAW_DATE_ALLOWED_IN`. `app` gives the
same source to `logic`. Tests inject a fixed time. Domain stays clock-free: callers derive its `Clock`
with `clockAt(timezone, now)`.
**Why:** product owner approved in session 0.8. One source keeps audit columns, policy checks and UI
hints on the same time, and tests never depend on the real clock. The name differs from domain's
`Clock` because the two are different things: a source of the time, and today and now for one
organization.

## D-084 — Domain validates the organization time zone
2026-11-08 · accepted · from audit A1, OI-035
One domain function decides whether a string is a time zone the runtime knows. `contracts` keeps the
length check only. The data layer calls the function on every write of `organizations.timezone`
(`bootstrapOwner`, `updateOrganization`) and rejects a bad value with `validation_failed`, code
`invalid_value`, at path `timezone`. Forms get the same answer through `logic`.
**Why:** product owner approved in session 0.8. Validity depends on the runtime's time-zone data,
domain already owns time, and contracts hold no behavior (D-020). A bad value that reached `todayIn`
would throw across a layer, against D-046.

## D-085 — The `can` hint moves to V1, computed by the adapter
2026-11-08 · accepted · refines D-076 · changes card V0
V0 builds no `can` hint in `logic`: no V0 control uses one, and exporting it unused would be dead
code. V1, the first slice with a gated control, builds it. Direction for V1 (OI-043): the hint asks
the adapter, as a contract read such as `session.can(...)`, instead of evaluating the policy in
`logic`. Authorization itself goes through the policy from V0 on (D-076).
**Why:** product owner approved in V0. `can()` reads a full policy snapshot, and every repository
read is filtered, so `logic` cannot rebuild it without seeing the whole organization's permissions.
In remote mode the same read maps to `has_permission()`.

## D-086 — V0 setup choices
2026-11-08 · accepted · refines D-006
- `.env.development` is committed, so `npm run dev` and the Playwright demo need no setup file. A
  production build does not read it.
- With the local provider, any verified identity may claim an empty store, and the first one wins.
  There is no server secret locally. "Empty" means no organization and no account.
- The claim form picks the time zone from a searchable list of the runtime's zones, starting at the
  device's zone. Zone names stay in English (IANA).
- A valid env whose adapter or auth provider is not built yet (`google`, `remote`, until row 8.4 and
  row 8.3) shows the startup error screen. Nothing is stubbed (D-076).
- The local identity's one `localStorage` key (D-074) holds the current identity and the identities
  that signed in on the device (the switcher's list).
- The raw-value scan applies its Tailwind class rules only to `ui` and `app`, the layers whose
  strings can be classes. Color, date and web-storage rules still cover all of `src`.
**Why:** product owner approved in V0.

## D-087 — A moved unit lands last among its new siblings
2026-11-08 · accepted · amends D-045
`moveUnit` also sets `sort_order`: the adapter places the unit after the live children of the new
parent (the largest `sort_order` plus one, or 0 when there are none). `sort_order` is otherwise set
only at creation and by reorder. A caller that wants another position calls reorder afterwards.
Moving a unit to the parent it already has answers `no_changes` at `parent_id`.
**Why:** product owner approved in V1. Without it a moved unit lands wherever its old `sort_order`
happens to fall.

## D-088 — Archiving units and levels
2026-11-08 · accepted · refines D-017
- A unit cannot be archived while it has a live sub-unit, or a soldier who is not archived and is
  placed in it today or later. The answer is `validation_failed`, code `unit_not_empty`.
- A level can be archived while units use it. Those units keep it and show its name. A new
  reference to an archived row answers `reference_archived`, and an unchanged one is left alone.
- V1 has no restore command, and archived units appear nowhere on screen. OI-019 stays with V9. The
  confirmation says that there is no way back for now.
**Why:** product owner approved in V1. No live unit sits under an archived parent, and no placement
breaks. The cost is known: a mistaken archive is fixed by creating the unit again.

## D-089 — Permissions of the unit commands
2026-11-08 · accepted · refines D-053
| Command | Permission | Checked against |
|---------|------------|-----------------|
| `units.create` | `units:create` | The parent, or `organization` for a top-level unit |
| `units.update` | `units:update` | The unit (`organization` when it is top-level) |
| `units.move` | `units:update` | The unit, and the new parent as above |
| `units.reorder` | `units:update` | Every live sibling, listed or not |
| `units.archive` | `units:delete` | The unit |
| `unit_levels.*` | `unit_levels:*` | `organization` |

Domain derives the targets (`unitTarget`, `placementTarget`). In a reorder, an actor who cannot update
every sibling gets `forbidden` before the list is compared, so the answer does not reveal siblings
the actor cannot see.
**Why:** product owner approved in V1.

## D-090 — The order of checks inside a command
2026-11-08 · accepted · refines D-008, D-046 · changes ARCHITECTURE
Schema → the row exists and is visible (`not_found`) → policy (`forbidden`) → the row's state
(`archived`, `stale_version`) → references and uniques → domain invariants → write. All of it runs in
one transaction, after the input is parsed.
**Why:** product owner approved in V1. ARCHITECTURE listed integrity before policy, which would tell an
actor without permission that, for example, a code is taken. That goes against D-046.

## D-091 — The `can` hint
2026-11-08 · accepted · refines D-085
`DataAdapter.session` gains `can(checks)`, which takes a list of `{ permission, target }` and answers
one boolean per check, in order. `PolicyTarget` moves from domain to contracts. It is declared as
`SessionPermissions` beside `SessionService`, so the contract and the adapter can each land in their
own commit (D-075). `logic` treats a failed or pending answer as "no", so a control stays hidden, and
re-asks after every change on the feed. The command still decides (D-008).
**Why:** product owner approved in V1.

## D-092 — The units drawer
2026-11-08 · accepted · refines D-023, D-074
- **Form fields:** name, level and color. `code`, `kind` and the validity dates are enforced by the
  commands and have no field on screen until a slice needs them (D-076).
- **Moving:** a row has a drag handle. Dropping on the middle of a row moves into it, and dropping on
  its top or bottom edge places the unit before or after it. A cycle is sent to the adapter, which
  refuses it. The row menu offers the same through "move to" and "up" and "down", for keyboards,
  screen readers and phones.
- **URL:** panel ids `units` and `unit_levels`; `entity` holds a row id or `new`; a new param `parent`
  holds the parent of a new unit.
- **Surface:** a modal drawer on the inline end (the left in Hebrew) from `md`, and below it a bottom
  sheet that also closes by dragging its grip down. In V3 the drawer leaves the name column visible.
**Why:** product owner approved in V1.

## D-093 — A new issue code lands after its message
2026-11-08 · accepted · refines D-075
The map from issue codes to messages in `ui` is total, and a commit touches one layer, so a new code
in contracts cannot compile in its own commit. The order is: first an `i18n` + `ui` commit with the
message, then the code in contracts. The map is checked by assignment, so it may hold the message
for a moment before the code exists, and a code without a message still fails to compile. This is
the one exception to "contracts first".
**Why:** the session's proposal in V1, told to the owner while building. Changeable by a later entry.

## D-094 — The soldiers drawer
2026-11-09 · accepted · extends D-092 · changes card V2
- **Surface:** one drawer with two sections, each its own panel in the URL: `soldiers` and
  `command_ranks`. The card named two drawers, one bar button each.
- **Fields on screen:** first name, last name, nickname, rank, and on an existing soldier the status.
  Private fields: personal id and phone. `invite_email` has no field until V9, because nothing uses
  it before auto-link (D-076). A new soldier starts active.
- **Soldier details:** the profile, the private fields and the placement are separate sections, because
  each has its own permission and version. Creating a soldier writes them together (one command).
- **List:** a search by name above the list. It compares names the way account matching does
  (D-066), in first, last and nickname. `logic` sorts by last name, then first name, in Hebrew order. The
  adapter promises no order for soldiers, so the two adapters need not agree on collation.
**Why:** product owner approved in V2. A phone's bottom bar has no room for a third control, and a list
of 100 or more people is not usable without a search.

## D-095 — Command ranks
2026-11-09 · accepted · refines D-002, D-088
- The form holds `seniority` as a number, where higher means more senior, and equal values are allowed.
  There is no drag and no reorder command. The adapter lists ranks most senior first. A new rank
  starts one above the most senior.
- A rank cannot be archived while a soldier who is not archived holds it: `validation_failed`, code
  `rank_in_use`. A new reference to an archived rank answers `reference_archived`, and an unchanged one
  is left alone.
**Why:** product owner approved in V2. This differs from levels (D-088): a rank carries seniority and
permissions, and an archived rank that still grants them through bindings would be invisible on
screen.

## D-096 — Permissions of the roster commands
2026-11-09 · accepted · refines D-018, D-053
| Command | Permission | Checked against |
|---------|------------|-----------------|
| `command_ranks.*` | `command_ranks:*` | `organization` |
| `soldiers.create` | `soldiers:create` | The unit of the first placement, or `organization` without one |
| With a placement | also `memberships:update` | That unit |
| With private fields | also `soldier_private:update` | The unit of the first placement, or `organization` without one |
| `soldiers.update` | `soldiers:update` | The soldier |
| `soldiers.archive` | `soldiers:delete` | The soldier |
| `soldiers.updatePrivate` | `soldier_private:view` and `soldier_private:update` | The soldier |
| `soldiers.changeMembership` | `memberships:update` | The soldier, and the new unit |

- `soldier_private` accepts a unit or `organization` target for creation, as `soldiers` does, because the
  soldier does not exist yet. Reads and updates check the soldier.
- A soldier the actor cannot see through `soldiers:view` answers `not_found` on every command.
- `updatePrivate` needs `view` too, because its answer holds the values.
- A personal id stored by anyone in the organization answers `already_exists` to whoever may write
  private fields. The unique index needs it.
- `accessManagerIssues` runs on the state after a status change, a rank change, an archive and a membership
  change (D-059). Creating a soldier removes no permission, so it does not run there.
- Changing a rank is not yet limited by what the actor holds. OI-038 keeps that for V10.
**Why:** product owner approved in V2. A permission to create a soldier must not be a second way to
place one or to write private fields (iron rule 6), and moving a soldier needs authority on both sides.

## D-097 — Changing a soldier's membership
2026-11-09 · accepted · refines D-010
- `current_membership` names the soldier's open primary row. A row that is closed or has another version
  answers `stale_version`, and a row of another soldier answers `reference_not_found`.
- `effective_date` may be in the past or the future. The form starts at today. A date before the current
  row's `valid_from` answers `range_inverted`.
- **Same day:** a date equal to `valid_from` with a new unit corrects the row in place, with no new row and no
  history, because a placement that lasted no day is a typing mistake. The `new_membership.id` is
  not used then. The answer holds the one corrected row.
- **Leaving without a unit** is allowed, because emptying a unit needs it. Leaving on the row's own first
  day answers `range_inverted`, since a row must cover at least one day. The form asks for a later date.
- Moving to the unit the soldier is already in answers `no_changes`.
- With no `current_membership`, an open row or any other overlap answers `membership_overlap`.
**Why:** product owner approved in V2.

## D-098 — Archiving a soldier
2026-11-09 · accepted · refines D-017, D-056
Archiving changes only `archived_at`. The placement stays as it was, as history, and D-088 already ignores
placements of archived soldiers. The account row stays, and D-056 takes the permissions away. There is no way
back until V9 (OI-019), and the confirmation says so. The personal id stays taken, because
`uq_soldier_private_personal_id` covers archived soldiers, so a soldier archived by mistake cannot be
created again with the same number until then. The confirmation says that too.
**Why:** product owner approved in V2, knowing the cost.

## D-099 — Unit names in a soldier's history
2026-11-09 · accepted · refines D-088
A soldier's history shows an archived unit by its name, marked as archived. A unit the actor cannot see
shows a neutral label. Everywhere else archived units stay out of sight, as D-088 says.
**Why:** product owner approved in V2. History is the reason memberships are rows (D-010), and it is not
readable without names.

## D-100 — A new required port lands in `app` before `logic`
2026-11-09 · accepted · refines D-075
When `logic` starts to require a new port, `app` provides it one commit earlier, and `logic` then requires
it. In the opposite order the `logic` commit would not compile, and a commit touches one layer.
`TimeSource` reaches `logic` this way in V2, as D-083 planned.
**Why:** the same conflict as D-093, between "each commit passes" and "one layer". Told to the owner in
the V2 plan.

## D-101 — Commands store blank optional text as NULL
2026-11-09 · accepted · refines D-045 · from audit A2
An optional text column (a nickname, a short title, a phone, a reason, ...) has one stored form for "no value":
NULL. A command turns a value that is blank or only spaces into NULL before it validates and writes, so the forms,
the import (D-050) and the remote adapter store the same thing. Required names stay as they are: trimmed and never
empty (`label`). The forms keep doing the same on their side, so the two agree. Built in the first slice that
writes such a column (OI-052).
**Why:** product owner approved in the A2 review. The rule lived only in `logic`, so a command called without a
form could store `''` beside NULL, against iron rule 5 and the single representation of emptiness in D-065.

## D-102 — Reading private fields and placements needs only their own `view`
2026-11-09 · accepted · refines D-018, D-096 · from audit A2
`soldier_private:view` over a soldier is enough to read that soldier's private fields, and `memberships:view` is
enough to read their placements, without `soldiers:view`. That is how the adapter reads today. Commands keep
D-096: a soldier the actor cannot see through `soldiers:view` answers `not_found` on every command.
**Why:** product owner decision in the A2 review. A personal number is personal but not classified, and in the field
someone is often asked to make a list (who signed for what) without managing the soldiers on it.

## D-103 — The date window in the URL
2026-11-09 · accepted · refines D-023, D-074
- `from` and `to` hold the first and last day of the window, inclusive. A pair that is inverted, longer than
  `MAX_WINDOW_DAYS` (config), or has only one side counts as absent, like any invalid value (a URL never breaks the
  workspace).
- **Absent means "this week":** the week that holds today in the organization's time zone, starting on
  `FIRST_DAY_OF_WEEK`. It follows the clock, so an open screen moves to the new week at midnight (D-107).
- **Week navigation** moves both by the window's length and writes them. "Today" removes them, so the window
  follows the clock again. It shows only while the window does not hold today (D-076).
- Opening or closing a panel keeps `view`, `from`, `to` and `filter`. Until V3 a panel replaced the whole search.
**Why:** product owner approved the V3 plan. A link to a week shows that week; a screen left open shows the current
one.

## D-104 — The unit selector writes the filter
2026-11-09 · accepted · refines D-067, D-074
- `filter` holds a `FilterExpression` (D-067) as JSON, the router's own encoding. An invalid value counts as absent.
  Absent means the whole organization.
- In V3 only the unit selector writes it: `{ where: { kind: 'unit', unit_ids: [id], include_descendants: true } }`.
  V6 builds the other conditions on the same parameter, with the same meaning everywhere.
- The selector offers "the whole organization" and the live units the actor can see, in tree order. A unit in the URL
  that the actor cannot see shows a neutral label and matches nobody.
**Why:** product owner approved the V3 plan. The card puts the unit in the shared filter encoding (FEATURE_MAP,
"Filter encoding in the URL: V3 (unit), V6 (all)").

## D-105 — The rows of the timeline
2026-11-09 · accepted · refines D-054, D-067
- A row is an active soldier, not archived, who matches the filter on at least one day of the window, each day
  evaluated on its own (D-067). The days on which the row does not match are muted. Inactive soldiers stay in the
  soldiers drawer; a V6 filter can bring them back.
- Rows are grouped by unit, one header per unit, in tree order. A row's unit is its primary unit on the reference day:
  today when the window holds it, otherwise the first day the row matches. A header names the unit by its path below
  the selected unit (`מחלקה א · כיתה 1`), so two units with the same name stay apart.
- Without a unit filter, soldiers whose unit is not a visible unit form the last groups, by D-106: no unit, another
  unit, unknown.
- Inside a group: the most senior rank first (no rank last), then last name and first name in Hebrew order (D-094).
**Why:** product owner chose in the V3 plan: everyone who served in the unit that week, grouped like the unit is.

## D-106 — What a row knows about its unit
2026-11-09 · accepted · refines D-099 · from audit A2, OI-048
A soldier's unit on a day is one of four states, and each has its own label wherever a unit is shown:
- **a unit** the actor can see;
- **none:** the actor may read the soldier's placements (`memberships:view`) and none covers the day ("ללא יחידה");
- **another unit:** a placement covers the day, and its unit is not one the actor can see (the neutral label of
  D-099, "יחידה אחרת");
- **unknown:** there is no day (no `organization:view`), or the actor may not read the soldier's placements
  ("לא ידוע").
**Why:** the A2 finding: "ללא יחידה" told something false in the last two states. The adapter filters placements per
soldier (D-102), so a soldier's rows are either all readable or none are, and the states are exact.

## D-107 — Today follows the organization's day
2026-11-09 · accepted · refines D-083, D-091 · from audit A2, OI-057
`logic` keeps one "today" for the screen. At the next midnight in the organization's time zone it moves to the new
day, and the permission hints are asked again, because policy reads today (D-053). Domain gives the time left until
the next day starts; `logic` sets one timer from the `TimeSource` (D-083). The command still decides with its own day.
**Why:** the A2 finding. The timeline marks today, so a screen left open overnight must not show yesterday.

## D-108 — The workspace bars and the timeline surface
2026-11-09 · accepted · refines D-023, D-077, D-092
- **Desktop:** two floating bars at the top, as in Stone 3. On the inline start: the organization's name, the unit
  selector, the view switcher. On the inline end: week navigation, "today", the module buttons and the user menu.
- **Mobile:** a top bar with week navigation, "today", the unit selector and the view switcher; the bottom bar keeps the
  organization's name, the module buttons and the user menu.
- **The view switcher** lists what the engine registry holds, so in V3 it holds only "ציר זמן" (card V3).
- **The grid:** the name column sticks to the inline start, and the days header floats under the top bars. Day columns
  are at least the day density token wide and share any extra width. Below that width the grid scrolls sideways, as
  on a phone. Rows are virtualized.
- A soldier's name opens their page in the soldiers drawer, for who may open it (D-094). The drawer leaves the name
  column in sight (D-092).
**Why:** product owner chose the two-bar layout in the V3 plan.

## D-109 — The reference day of a timeline row
2026-11-09 · accepted · refines D-105
A row's group comes from its unit on today when the soldier is in the view today, and otherwise on the first day of the
window they are in it. D-105 said "today when the window holds it", which would place a soldier who left the selected
unit before today under a unit outside it.
**Why:** found while building V3. It is what D-105 meant: a row is grouped by a day on which it belongs to the view.
Told to the owner at the end of V3.

## D-110 — A branch and a pull request per session
2026-11-09 · accepted · refines D-075
- Every session (slice, audit or docs track) works on its own branch, named after its roadmap row or topic, and never
  commits to `main` directly.
- It ends by pushing the branch and opening a pull request whose description is the handoff summary. CI runs on it.
  When CI is green the session merges it itself, keeping the commits, and deletes the branch. When CI is red the session
  fixes it, or reports to the owner and leaves it unmerged. The owner still gets the screenshots, and a change they want
  becomes an open item.
- A session that finds a pull request still open merges it (CI green) or reports it before starting its own work.
- A session starts from an up-to-date `main`. It may run in the cloud or on the owner's computer: GitHub is the only
  shared copy, so neither holds work the other lacks once the branch is pushed.
- One commit = one layer (D-075) holds inside the branch as before. Merges keep the commits (no squash), so history stays
  layer by layer.
**Why:** product owner decision after V3. The owner works from a phone with the computer off, so work runs in cloud
sessions. A pull request lets CI check the slice before it reaches `main`. The owner chose not to approve each merge: they
do not review code, and a merge waiting on them would leave `main` behind the work, which is what they wanted to avoid.

## D-111 — Leave bars on the timeline
2026-11-10 · accepted · refines D-012, D-032, D-077 · resolves OI-030
- **Color is the type, form is the status.** A bar is filled with its type's `color_key`. Approved is solid; pending is a
  dashed outline in the type's color over a faint fill of it. Rejected and cancelled leaves are not drawn (D-070). This is
  the default mode; D-112 adds a uniform one.
- **Markers:** a leave whose effective effect is `available` (D-032) is a round badge with its type's icon, centered on
  each day it covers and drawn over any bar, as in Stone 3. Its ring and icon take the type's color; the ring is dashed
  while pending.
- **Lanes:** overlapping bars of one row take lanes. In start order (the longer first on a tie), each bar takes the first
  lane that is free on all its days. Badges take lanes among badges the same way. A row holds one lane at its base height
  and grows by one lane step for each more, so nothing is hidden.
- A bar cut by the window's edge has a square end on that side, so it reads as continuing.
- Bars are not controls until V5 opens a leave's details (D-076). Each row reads its leaves aloud: type, status and dates.
**Why:** product owner decision at the start of V4 (OI-030): one look tells the kind by color and the approval by form, and
`Design.md` already carries status by form. The badge and the "+" follow Stone 3.

## D-112 — Uniform color mode of the timeline
2026-11-10 · accepted · refines D-023, D-074
- The search param `colors` holds `type` (the default, also when absent or invalid) or `uniform`. Switching views and
  opening panels keeps it, like the filter.
- The view menu holds the choice, under its own heading, so the bars gain no control.
- In uniform mode every bar has one neutral color, and form still carries status (solid, dashed). The type shows as a dot
  of its color at the bar's inline start, and its name inside the bar when the bar has room. Badges take the marker color.
**Why:** the owner asked in V4, approving D-111, for a calm mode where one color shows who is away and a small sign tells
why: many colors at once can be noise.

## D-113 — The leave types drawer
2026-11-10 · accepted · extends D-092 · refines D-032, D-034, D-088
- **Surface:** one drawer, "סוגי היעדרות", with two sections, each its own panel: `leave_types` and `leave_type_groups`.
- **Fields:** a type has a name, a group (optional), a color (required), an icon (optional), its effect (absence, the
  default, or marker) and "requires a reason". A group has a name.
- **Icons:** `icon_key` is a closed list in `config` (`ICON_KEYS`), checked on every write like `color_key`
  (`invalid_value`). The UI maps each key to a lucide icon through a total map (D-034).
- **Order:** groups by `sort_order`; types by their group's order, ungrouped last, then by their own `sort_order`. Up and
  down in the row menu reorder groups, and types inside their group. A new row comes last.
- **Archive:** a type may be archived while leaves use it. Those leaves keep it and show it, and a new leave cannot pick it
  (`reference_archived`). A group cannot be archived while it holds a type that is not archived (`group_in_use`), and an
  archived group cannot be picked.
- **Permissions:** both tables are `leave_types:*` at `organization` (D-040 has no resource for groups, D-053).
**Why:** product owner approved in V4, with groups built now. It mirrors units and levels (D-088) and ranks (D-095): a
group in use is refused like a rank in use, because its types would otherwise sit under a name nobody can see.

## D-114 — Creating a leave
2026-11-10 · accepted · refines D-047, D-063, D-090 · OI-023 (a), OI-027
| Part of `leaves.create` | Permission | Checked against |
|-------------------------|------------|-----------------|
| The leave | `leaves:create` | The soldier |
| `as_approved` | also `leaves:approve` | The soldier |
| A shared or internal comment | also `leave_comments:create` or `internal_comments:create` | The soldier |

- **Order (D-090):** schema → the soldier exists and the actor sees them through `soldiers:view` (`not_found`) → policy →
  the soldier is not archived (`archived`) → the id is free → the type exists, is visible and live
  (`reference_not_found`, `reference_archived`) → the reason (`reason_required`) and properties → the rule gate → the
  leave, its `created` event with the acknowledged rule ids, and the comment, in one transaction.
- An inactive soldier may get a leave; only archiving closes a soldier (D-098).
- **Rules** are read without the actor's read filter, because they count soldiers the actor may not see. A violation
  names its rule, unit, group, bound and counts, never a soldier; what more it may reveal stays with V7 (OI-027).
- **Reads:** a leave, and its events, are visible with `leaves:view` over its soldier. Events have no screen until V5.
- A blank reason is stored as NULL (D-101).
**Why:** product owner approved the V4 plan. It applies D-063 and D-073 to the first leave command, in the order every
command follows.

## D-115 — The new-leave form
2026-11-10 · accepted · refines D-013, D-023, D-041
- A dark round "+" floats at the bottom inline-end corner of the board, above the bottom bar on a phone, as in Stone 3. It
  shows for who may create a leave for at least one soldier they see.
- It opens the drawer on the panel `leaves` with `entity=new`, so a deep link opens the form. V5 opens a leave in the same
  panel.
- **Fields:** the soldier (searchable, only those the actor may create a leave for), the type (live types, by group), the
  first and last day (both start at today), the reason (marked required when the type requires it), and "approve now" for
  who may approve that soldier. "Approve now" starts off; the personal default of D-041 joins in V5 with
  `updateMyPreferences`.
- After saving, the drawer closes and the bar is on the board at once; a refusal takes it back and shows on the form.
**Why:** product owner chose the floating button in V4.

## D-116 — Module buttons on a phone show their icon
2026-11-10 · accepted · refines D-094, D-108
On a phone, the bottom bar's module buttons show their icon only, with their name kept for screen readers, so a third
module (leave types) fits beside the organization's name and the user menu. On desktop they keep icon and name.
**Why:** D-094 found no room for a third labeled control on a phone. Part of the V4 plan the owner approved.

## D-117 — The leave commands after creation
2026-11-10 · accepted · refines D-013, D-047, D-063, D-064, D-090, D-114 · OI-023 (a), OI-027
| Command | Permission | Checked against |
|---------|------------|-----------------|
| `leaves.transition` | The one D-063 names for the step | The leave's soldier |
| With a comment | also `leave_comments:create` or `internal_comments:create` | The leave's soldier |
| `leaves.update`, `leaves.reschedule` | `leaves:update` | The leave's soldier |

- **Order (D-090):** schema → the leave is visible through `leaves:view` over its soldier (`not_found`) → policy → the
  leave's state: `stale_version`, then the state machine's refusal (`invalid_transition`, `archived`) → a changed type
  exists, is visible and is live → the reason, when the type or the reason changes → properties → `no_changes` when
  nothing differs from the stored leave → the rule gate → the leave, its event and the comment, in one transaction.
- A step the status does not allow names no permission (D-063), so it goes from visibility straight to the state. The
  actor sees the leave, so its status tells them nothing new.
- An archived type the leave already has is left alone (D-113). A leave of an archived or inactive soldier can still be
  changed, so it can be cancelled.
- **Approval after an edit (D-064):** `actor_can_approve` is `leaves:approve` over the soldier at the time of the command,
  and the policy is the organization's `reschedule_policy`.
- **Rules:** the gate runs on the leave as the command would leave it, over unfiltered rule data, as in D-114. Approving
  a leave, reopening one and moving one can break a rule; rejecting and cancelling never break a minimum (D-073).
- **Events:** `updated` and `rescheduled` hold, in `changes`, the before and after of each column that changed.
  Transitions hold none. Every event stores the rule ids its command acknowledged.
**Why:** product owner approved the V5 plan. It applies D-063, D-064 and D-073 to the rest of the leave commands, in the
order of D-114.

## D-118 — Leave comments
2026-11-10 · accepted · refines D-049, D-063
- **Reads:** a comment is visible when its leave is (D-114) and the actor holds, over the leave's soldier,
  `leave_comments:view` for a shared comment or `internal_comments:view` for an internal one. A list holds the comments
  that are not archived, oldest first. An invisible leave answers `not_found`.
- **`add`:** the leave is visible (`not_found`), then the create pair of the comment's visibility (`forbidden`), then the
  id is free. Any status of the leave takes comments (D-063).
- **`edit`, `archive`:** the comment is visible to the actor (`not_found`), the actor is its author (`forbidden`), it is
  not archived (`archived`). An edit sets `edited_at`. Comments have no version.
- An archived comment leaves the thread. Nothing on screen brings it back.
**Why:** product owner approved the V5 plan. Internal comments are for commanders, so reading them is its own pair
(D-040), and a soldier who later sees their own leave must not see them.

## D-119 — The leave details drawer
2026-11-10 · accepted · refines D-023, D-064, D-111, D-115
- **Opening:** a bar and a badge are buttons. Each opens the panel `leaves` with `entity=<leave id>`, the panel of the
  new-leave form (D-115). The button's name is the type, the status and the dates, so the row's hidden list of D-111 is
  gone. A leave the actor cannot see, or an id that is not a leave, shows "not found".
- **Content:** the soldier, the type with its color and icon, the dates and the number of days, the status, the reason,
  and who reviewed it and when. A name the actor cannot read shows a neutral label.
- **Actions** follow the state machine and the hints (OI-024): approve, reject, cancel, reopen and edit each show only when
  the status allows the step and the actor holds its permission. Approve and reopen act at once. Reject and cancel ask
  first, in a dialog with an optional comment, which is shared.
- **One edit form** holds the type, the dates and the reason. Changed dates send `reschedule` and changed details send
  `update`, the dates first, so each has its own event. When the edit would return an approved leave to pending
  (D-064), the form says so before it is sent. The effect override has no field (D-076).
- **One thread** holds the events and the comments, oldest first, with the comment box under it. A line shows its day
  and time in the organization's time zone, from a seventh date preset in `config`, `dayMonthTime` (D-074). An internal comment
  carries a label, and its choice shows only to who may write one. The author's own comments have "edit" and "delete".
- **Optimistic updates:** a transition shows at once and is taken back on a refusal. `stale_version` tells the actor
  the leave changed meanwhile, and the drawer shows the stored leave again.
**Why:** product owner chose one edit form and one thread in the V5 plan.

## D-120 — The requests inbox
2026-11-10 · accepted · refines D-023, D-108, D-116 · changes contracts
- **Contract:** `LeaveQuery.window` may be NULL, which means any dates, like the NULL lists beside it. Its two readers,
  in `data` and `logic`, learn to take NULL one commit each before the contract allows it, so every commit compiles
  (as D-093 and D-100).
- A bar button, "בקשות", opens a drawer with two sections, each its own panel: `leave_inbox` and `leave_closed`. It shows
  for who may approve at least one soldier they see, and carries the number of pending requests.
- **Pending:** the pending leaves the actor may approve, whatever their dates, the earliest first. A row names the
  soldier, the type and the dates, has "approve" and "reject", and opens the leave's details.
- **Closed:** the rejected and cancelled leaves the actor sees, the last changed first. They are not drawn on the board
  (D-070), so this is the way to reopen one.
- On a phone it is a fourth icon in the bottom bar (D-116), and the organization's name gives way.
**Why:** product owner chose the closed section in the V5 plan: without it "reopen" can be reached only right after a
leave is closed.

## D-121 — The "approve now" default
2026-11-10 · accepted · refines D-013, D-041, D-115 · OI-062
- The user menu holds a switch, "לאשר מיד בקשות שאני יוצר", for who may approve at least one soldier they see. It
  writes `soldier_preferences.create_leaves_as_approved` through `accounts.updateMyPreferences`.
- The new-leave form starts "approve now" from it. The command still checks `leaves:approve` (D-013).
- `updateMyPreferences` needs only a linked session: the row is the actor's own. `expected_version` NULL creates it, and
  answers `stale_version` when a row exists; a number must equal the stored version.
**Why:** product owner chose an explicit switch over a form that remembers the last choice: an approval must not happen
by a default nobody set.

## D-122 — The board waits for the permission hints
2026-11-10 · accepted · refines D-091, D-106 · OI-063
The timeline shows its loading state until the hint for reading placements has answered once. A pending hint still
counts as "no" for a control (D-091), but it no longer decides what a row says about its unit, so "לא ידוע" does not
flash after a reload.
**Why:** OI-063. "Unknown" is a statement about the actor's permissions, and a hint that has not answered knows nothing
yet.

## D-123 — Editing a leave is one command
2026-11-10 · accepted · amends D-045, D-049, D-117; refines D-064; supersedes the two commands of D-119's edit form · from
audit A3
- `leaves.update` takes the dates beside the type, the effect override, the reason and the properties. `leaves.reschedule`
  leaves the contract. A drag (V8) sends `update` with the dates only.
- One edit is one command in one transaction: everything it changes is saved, or nothing is. The checks of D-117 run once,
  on the leave as the edit would leave it: the type, the reason when the type or the reason changes, the properties,
  `no_changes` when nothing differs, and the rule gate once over the whole change (D-073).
- Approval after the edit follows D-064 on the whole edit: it is material when the dates, the type or the effect override
  change.
- One event per edit: `rescheduled` when only the dates changed, otherwise `updated`. Its `changes` hold the before and after
  of every column that changed (D-117). The event vocabulary of `schema.sql` does not change.
- The edit form sends one command and keeps nothing between two.
**Why:** audit A3 finding 2. Two commands could save the dates and refuse the details: a half-saved edit, a form left on a
stale version, and a rule gate that judges the step between them instead of the edit (D-073). From V7 a soft rule makes that
path ordinary, and server functions arrive in 8.1, so the contract is cheapest to change now. The owner accepted the audit's
technical recommendations.

## D-124 — A leave of an archived soldier can only be cancelled
2026-11-10 · accepted · refines D-063, D-098, D-117 · from audit A3
- On a leave whose soldier is archived, `leaves.transition` allows `cancel` only. `approve`, `reject`, `reopen` and
  `leaves.update` answer `archived`, at the state step of D-117's order (after visibility, policy and `stale_version`).
- Comments stay open. They change nothing about the leave, and the thread is its history (D-118).
- The hints follow the same rule, so the details drawer and the inbox offer only "cancel" on such a leave.
- An inactive soldier is not archived: their leaves keep every step (D-114, D-117).
**Why:** product owner decision in the A3 record (A3 question 2). A soldier who left the roster gets no new approval, and a
leave left open can still be closed. D-117 allowed every change "so it can be cancelled", which was wider than its reason.

## D-125 — The new-leave form offers active soldiers only, until V6
2026-11-10 · accepted · refines D-114, D-115 · from audit A3
- The soldier field lists the soldiers who are active and not archived, among those the actor may create a leave for. The
  command keeps D-114: an inactive soldier may get a leave.
- V6 lets a filter bring inactive soldiers back to the board (D-105). The form offers them only when the board can show their
  bars, and V6 asks the owner how.
**Why:** product owner decision in the A3 record (A3 finding 3, question 3). A leave of an inactive soldier showed on no
screen: the board has no row for them (D-105), and the inbox lists only pending leaves. D-115 promises that the bar is on the
board at once.

## D-126 — A slice is done when it is merged with CI green
2026-11-10 · accepted · refines D-051, D-075, D-110 · from audit A3
- A pull request merges only with CI green (D-110), so `main` holds only finished slices, and a row's ☑ in `ROADMAP.md`,
  written in the slice's last commit, reaches `main` only through that merge. A session does not end with its pull request
  red and unexplained: it fixes it on the branch, or reports it and leaves it unmerged.
- Before the handoff, the session runs what CI runs: `npm run check`, `npm run build`, and the whole Playwright suite with
  the CI worker count. The handoff records those results and the pull request. When CI then fails, the fix goes on the branch
  and the handoff says what failed and why.
- Before merging, the session reviews its own diff, read-only: the `code-review` skill, or a fresh subagent asked for
  correctness and rule findings. A finding inside the slice is fixed in the owning layer's commit; anything else becomes an
  open item. The handoff lists what the review found. Milestone audits stay for intent, coverage and drift (D-051).
- Audits read `main`.
**Why:** audit A3 found V5 marked done while its CI was red, and each audit so far found about ten small findings two or
three slices late. A review of each diff catches them while the context is fresh. The owner accepted the audit's technical
recommendations.

## D-127 — One commit = one layer, and every commit passes
2026-11-10 · accepted · supersedes the order of layers in D-075; makes the exceptions of D-093 and D-100 unnecessary · from
audit A3
- A commit touches one layer (`i18n` with `ui` is the one pair, D-025) and passes `npm run check`. Inside a slice, the
  order is whatever keeps every commit green, which usually follows the dependencies. A commit that comes before its
  natural place says why in its message.
- A model change still comes first in the slice: `schema.sql`, `DECISIONS.md` and contracts together (iron rule 7).
- The pre-commit guard does not change.
**Why:** audit A3, part 2. "Dependency order" gathered three recorded exceptions (D-093, D-100, D-120) and config commits after
logic. What holds in practice, and what the tools check, is one layer per commit and a green commit.

## D-128 — Closed items move to an archive; the current state lives in ARCHITECTURE and Design.md
2026-11-10 · accepted · supersedes the rest of D-062; resolves OI-015 (a), (d) · from audit A3
- A session moves the items it closes to `docs/OPEN_ITEMS_ARCHIVE.md` at its end, row unchanged. The archive is not read at
  the start of a session. Ids stay permanent and are never reused; a row is moved, never deleted.
- An item targets one slice. Work that spans slices is one item per slice, and the Notes column is not a change log.
- `ARCHITECTURE.md` holds the current behavior of each area in a few lines, with the D-numbers behind it, and `Design.md`
  the current screens. A slice that changes an area updates those lines in its last docs commit. `DECISIONS.md` stays the
  log of what was decided, when and why.
**Why:** OI-015's trigger is reached (A3 finding 10): the start-of-session documents of V6 are about 115 KB (≈30k tokens),
about 45% of the rows in `OPEN_ITEMS.md` were closed, and learning how approval works today meant following eight entries.
The owner accepted the audit's answer to its question 5.

## D-129 — Two behaviors of the leaves panel
2026-11-10 · accepted · refines D-103, D-115, D-119 · from audit A3
Decided while building V5 and written only in its handoff:
- An `entity` in the `leaves` panel that is not an id counts as absent, as every invalid value does (D-103), so it opens the
  new-leave form. An id that is no leave the actor sees shows "not found" (D-119).
- The `leaves` panel opens for anyone. The leave's read decides what the details show, and the new-leave form says when there
  is nobody the actor may create a leave for.
**Why:** audit A3 finding 9. Decisions live in this log, not in a handoff.

## D-130 — Tags: categories, tags and a soldier's tags
2026-11-10 · accepted · refines D-015, D-045, D-065, D-096 · OI-070
- **Organization data:** categories and tags are `tags:*` at `organization` (D-053). Every scope reads them, only
  organization scope writes them. Nothing is predefined.
- **The drawer:** one drawer, "תגיות", with two sections as in D-113: `tags` (the tags by category, each category in its
  order, its tags in theirs) and `tag_categories`. A category has a name, a selection mode (`multiple` by default, or
  `single`) and a color; a tag has a name and an optional color, NULL inheriting its category's. Up and down in the row
  menu order categories, and tags inside their category. A category cannot be archived while it holds a live tag
  (`group_in_use`), and an archived category cannot be picked. Switching a category to `single` runs
  `selectionModeChangeIssues` (`tag_single_selection` under `changes`).
- **A soldier's tags:** `soldiers.setTags` replaces the whole set (D-045) and needs `soldiers:update` over the soldier,
  the same right as editing the soldier (the owner's answer). It is guarded by the soldier's version and bumps it, with
  `updated_at` and `updated_by`. Order of checks (D-090): schema → the soldier is visible (`not_found`) →
  `soldiers:update` → the soldier is not archived (`archived`) and the version (`stale_version`) → each tag the set adds
  exists and is visible (`reference_not_found`) and live (`reference_archived`) → `tagSelectionIssues` on the whole set
  → write. A tag the soldier already holds stays even when archived (D-065: only changes are checked).
- **Reading:** a soldier's `soldier_tags` rows with `soldiers:view` over the soldier.
- **On screen:** a soldier's page gains a "תגיות" section: the tags held, by category, and an edit for who may update
  the soldier. A `single` category is one choice, a `multiple` one is checkboxes. A held archived tag shows with
  "בארכיון" and can be removed, never added.
**Why:** product owner approved the V6 plan: whoever may edit a soldier may tag them, so a platoon commander tags their
own soldiers, while the list of tags is the organization's. The drawer copies D-113, its nearest kin.

## D-131 — The filter bar: soldier conditions
2026-11-10 · accepted · refines D-067, D-104, D-105, D-108 · OI-079
- **Place:** a row of chips under the bars. From `md` it floats under the bar with the unit selector; below `md` it sits
  under the top bar and scrolls sideways. The board starts under it. The row holds the chips, "+" to add a condition, the
  "רק מי שחסר" switch (D-133) and the presence button (D-134).
- **Soldier conditions go into `filter`** (D-104): the unit selector keeps its unit. The bar adds one chip per tag
  category (`tag`, `any` of the chosen tags of that category), a rank chip (`command_rank`) and a status chip
  (`soldier_status`). Inside a chip any of its values matches; across chips all must. The bar writes one top-level `and`
  of these nodes, a lone node unwrapped, and reads the unit selector's unit among them.
- **What the bar does not read** (a hand-written URL) shows as one chip "סינון אחר", which can only be removed. A value
  the actor cannot see (an unknown tag, rank or unit) shows a neutral label and matches nobody, as D-104 does for units.
- **Status (D-105):** rows are soldiers not archived who match the filter. When the filter has no status condition, only
  active soldiers, as before; a status chip decides otherwise, so it can bring inactive soldiers to the board.
- **One source of the data a filter reads** in `logic`: soldiers, ranks, units, memberships and soldier tags now;
  seniority overrides and property values join with V15 and V14 (OI-080, OI-081). The board, the bar and the presence
  lists read it, and V7's rules will.
**Why:** product owner approved the V6 plan and the Stone 3 bar (chips, "+", the switch). The selector stays where D-108
put it, so the unit is not a chip twice.

## D-132 — Leave conditions on the board
2026-11-10 · accepted · refines D-023, D-074 · resolves OI-012
- `FilterExpression` stays a filter of soldiers, which rule populations share (D-014). The board's leave conditions live
  in their own search param, `leaves`: statuses (`pending`, `approved`, the ones the board draws) and leave type ids. An
  invalid value counts as absent (D-103). Switching views and opening panels keeps it, like `filter`.
- Two chips in the same bar: "סטטוס בקשה" and "סוג היעדרות". With a leave condition, the board draws only the bars and
  markers that match, and a row with no matching mark in the window leaves the board (the owner's answer).
- The presence lists do not follow leave conditions: a day's status counts every leave (D-134).
**Why:** OI-012, the owner's answer in the V6 plan. "Pending" describes a leave, not a soldier, and rules must never
select soldiers by a view's leave chips.

## D-133 — "Only who is missing"
2026-11-10 · accepted · refines D-070, D-105
- A switch in the bar, kept in the search param `missing`. On, the rows are the soldiers who are unavailable on at least
  one day of the window on which they match the filter, and their other days are muted and read aloud as present (the
  owner's answer). Off or absent, the board is as before.
- On the board and in the presence lists, unavailable means an approved leave whose effect is `unavailable` covers the
  day: pending leaves do not count (D-070, the owner's answer).
**Why:** product owner approved the V6 plan: the board answers "who is missing this week", and only approval makes an
absence certain.

## D-134 — Present and absent lists of a day
2026-11-10 · accepted · refines D-032, D-070 · OI-090
- **Panel:** `presence` in the drawer, for one day held in the search param `day`. Absent or invalid means today (D-103).
  It moves a day back or forward, and back to today.
- **Population:** the soldiers the board's soldier filter selects that day (the unit, the chips, the status rule of
  D-131), not the leave conditions and not "only who is missing".
- **Lists:** a partition (D-032, D-070): "חסרים" first, then "נוכחים", each with its count, every soldier once. An absent
  entry names the types of the leaves that make them absent; a present entry with a pending leave carries "ממתין"; a
  marker shows as an annotation on the entry.
- **The presence button** in the bar shows how many are missing today and opens the panel on today.
**Why:** the V6 card (present and absent counts and lists for a day), with D-133's meaning of "missing".

## D-135 — Shared test helpers live in a layer's `testing/` folder
2026-11-10 · accepted · extends D-036 · OI-086
- A layer may keep test-only helpers in `src/<layer>/testing/` (fake ports, sample builders). Only test files and other
  helpers import them, which `.dependency-cruiser.cjs` enforces, so they never reach the bundle.
- Type assertions are allowed there as in test files (D-036), because a fake stands in for a contract it implements only
  in part. Sample data stays in tests and their helpers (iron rule 4).
**Why:** OI-086. Seven logic test files built their own fake ports; one helper needs the latitude test files already
have, and a folder rule keeps it out of production code.

## D-136 — The new-leave form stays with active soldiers
2026-11-10 · accepted · refines D-125 · resolves OI-078
The new-leave form offers active soldiers only, also when a status chip brings inactive soldiers to the board (D-131).
The command keeps D-114 and still takes an inactive soldier.
**Why:** the owner's answer at the end of V6. A leave is planned for who serves; a soldier who comes back is made active
first.

## D-137 — Pending leaves counted by a rule: the requester acknowledges
2026-11-10 · accepted · confirms D-073 · resolves OI-042
With `count_pending_as_unavailable`, a request already counts when it is made. So the requester acknowledges a soft rule
when creating it, and approving it changes no count and asks nothing again. A hard rule of that kind refuses the request
itself. Each step keeps D-073: only the change that makes a bound worse is judged.
**Why:** the owner's answer at the start of V7. The option means "plan ahead", so the request is the moment the count
changes. The commander still sees the broken rule on the heat row (D-141).

## D-138 — What a rule violation reveals
2026-11-10 · accepted · refines D-046, D-114 · resolves OI-075
- A violation names its rule, its evaluated unit, its group and its bound, and for each day the required and actual counts
  and the soldiers of the target who are unavailable that day: `days[].unavailable`, each `{ id, first_name, last_name }`
  (contracts `RuleViolation`). It names them also when the actor cannot see them.
- Names of the rule, the unit and the group show when the actor may view them; otherwise a neutral "unknown", as D-106
  does for units. A soldier's name comes from the violation itself.
- Nothing else of an invisible soldier is revealed: not their leaves, types or unit.
**Why:** the owner's answer at the start of V7, against the recommendation to show counts only: a commander who meets a
broken rule needs to know whom to talk to. It narrows D-046 for this one payload; D-114 said "never a soldier".

## D-139 — The availability rule commands
2026-11-10 · accepted · refines D-014, D-031, D-053, D-090 · OI-071
| Command | Permission | Checked against |
|---------|------------|-----------------|
| `availability_rules.create` | `availability_rules:create` | The scope unit (unit target), or the organization when global |
| `availability_rules.update` | `availability_rules:update` | The stored target, and the new one when the scope unit changes |
| `availability_rules.archive` | `availability_rules:delete` | The stored target |

- **Reads:** a rule is visible with `availability_rules:view` over its target (D-053). Archived rules are read only when
  asked (`include_archived`).
- **Order (D-090):** schema → the rule is visible (`not_found`) → policy → `archived`, `stale_version` → references → the
  population filter → write. References must exist in the organization and be live: the scope unit, the scope level and
  the group's tag category (`reference_not_found`, `reference_archived`); a deployment must exist, and none can before
  V15. The population filter passes `filterIssues`, and every row `filterReferences` lists exists in the organization
  (`reference_not_found`, paths under `population_filter`). An archived row stays allowed in a filter, so a filter never
  breaks (D-017).
- Rule writes are not gated by the rules (D-073). No reorder: the list is ordered by priority, then name.
**Why:** the V7 card and OI-071. It applies D-053 and D-090 to the rules, the way D-089 does for units: moving a rule
needs authority on both ends.

## D-140 — The rules module
2026-11-10 · accepted · refines D-014, D-031, D-108
- **Panel:** `rules` in the drawer, from a "כללים" button in the bar, shown with `availability_rules:view` at any scope.
- **List:** live rules by priority, then name. Each row says what it asks ("לפחות 2 · חובש · כל מחלקה"), its scope and
  its enforcement, and marks a disabled rule. A section "התנגשויות" lists the configuration conflicts (D-072) on the
  days of the board's window, each with its unit, group, the rules and the bounds.
- **Form:** name; description; enforcement (soft or hard); scope: the whole organization or a unit, and the mode (the unit
  and below, each direct child, each unit at a level); population: tag and rank conditions with the filter bar's check lists
  (D-131), none = everyone, and a stored filter the form does not read shown as "סינון מותאם" until cleared; group by none, tag (optionally one category) or rank; metric count or percent; minimum and
  maximum; valid from and to; "ממתינים נספרים כחסרים"; priority; enabled. A deployment has no field until V15 (D-076).
- Archive asks for confirmation. Archived rules have no way back on screen (D-088).
**Why:** the V7 card: a builder on the shared filter UI, and conflicts in the rules module.

## D-141 — The heat row
2026-11-10 · accepted · refines D-014, D-108, D-134 · OI-091
- One row under the days header of the timeline, shown when the actor sees at least one rule.
- **A day's cell** judges the effective targets of that day evaluated inside the selected unit's tree, or counting at
  least one soldier placed there that day (the whole organization without a unit). A target inside the unit counts even
  with nobody in it, as D-072 judges an empty selected group. Each rule counts pending leaves by its own setting. The
  cell shows the number of broken targets, and its form and color say the worst: hard (refused color, solid), soft
  (pending color, dashed), none (empty). Color is never the only signal: the number and an accessible name say it too.
- **Pressing a cell** opens the `rules` panel on that day (search param `day`, as D-134): the day's broken targets, each
  with its rule, unit, group, required and actual counts and who is unavailable, above the list of rules.
**Why:** the owner's answer at the start of V7 (one row, day by day, for the selected unit).

## D-142 — Live rule warnings and the acknowledgment dialog
2026-11-10 · accepted · refines D-047, D-073 · OI-066, OI-091
- **Live warnings:** while a new leave or an edit is being filled, `logic` evaluates `leaveChangeViolations` on the leave
  as the command would leave it, over the data the actor reads, and the form shows what it finds, a hard rule as a refusal
  ahead of time.
- **The command stays the authority.** `rule_acknowledgment_required` opens a dialog with the soft violations (D-138);
  "שמירה בכל זאת" sends the same command again with their rule ids. `rule_violation` shows the hard ones in the same
  dialog with no way through. The dialog serves the new-leave form, the edit form, the details drawer's steps and the
  inbox's approve.
- An actor who cannot read every row a rule counts may get a live warning that differs from the command's answer. Only
  the owner has an account before V10, which decides how such an actor previews rules (OI-094).
**Why:** the owner's answer at the start of V7 (warn while choosing), D-047 (the command is the authority) and OI-066.

## D-143 — Timeline drag: move, resize and create, with live feedback
2026-11-11 · accepted · refines D-092, D-111, D-115, D-119, D-123, D-142 · decided under the owner's autonomy instruction of
2026-11-11
- **What moves:** a bar or a marker of a pending or approved leave, whose soldier is not archived, where the actor holds
  `leaves:update` over the soldier (a hint, D-091). Its body moves it by whole days; the inner ends of a bar (a handle of
  `TIMELINE_DRAG.handlePx`) move its first or last day, and a leave keeps at least one day. A marker only moves. The row
  never changes: a leave keeps its soldier (D-045). A drag starts past `TIMELINE_DRAG.thresholdPx`; anything shorter is
  the press that opens the leave (D-119).
- **Where:** the pointer counts only the window's days. A leave cut by the window keeps its hidden days and moves them by
  the same count. A grid wider than the screen scrolls sideways while the pointer is near its edge.
- **Live feedback:** a ghost of the mark at its new days over the stored one, and a card (`role="status"`) with the new
  days and their count, "returns to pending" when D-064 says so, and the rules the change would break, as the edit form
  judges them (D-142): each rule's name with its enforcement chip. The ghost's edge says the worst, a dashed pending edge
  for a soft rule and a refused edge for a hard one. A hard rule is the conflict a drag shows: the drop is still sent and
  the command's refusal shows in the dialog, because the command is the authority.
- **The drop** sends `leaves.update` with the dates only (D-123), through the acknowledgment dialog (D-142). The same days
  send nothing, and Escape cancels. The mark stays at its new days until the command answers; a refusal puts it back and
  says why in a notice on the board, cleared by the next drag or its close button.
- **Create:** pressing an empty day of a soldier the actor may create a leave for (active, `leaves:create`, D-114, D-125)
  and dragging marks a run of days. Releasing opens the new-leave form with the soldier and the days filled in; the type
  is chosen there, so its rule warning shows there. The draft is the search param `draft` beside the panel, so a link
  reopens it, and closing the panel removes it. A mouse press with no drag creates nothing.
- **Without a pointer:** the details drawer's edit form changes the days, and the "+" creates (D-092: every drag has a
  way without one).
**Why:** the V8 card. A drop that is one `update` is all or nothing (D-123), and a creation needs a type, which a drag
cannot give. Recommended options taken without asking, under the owner's instruction of 2026-11-11.

## D-144 — The touch path of the timeline, and its lanes on a phone
2026-11-11 · accepted · refines D-111, D-143 · OI-067 · decided under the owner's autonomy instruction of 2026-11-11
- **On touch** a finger that moves scrolls the board, as before. Holding still on a mark or an empty day for
  `TIMELINE_DRAG.holdMs` picks it up: the board stops scrolling and the moves of D-143 follow the finger. A tap still opens
  the leave. A hold on an empty day released without moving opens the new-leave form for that day; a mark released where
  it was sends nothing.
- **Lanes on a phone (OI-067):** bars are 28 high with a lane step of 44 (`TIMELINE_LANES_TOUCH`), so a bar's hit area,
  which fills the gap to the next lane (D-119), is 44 high, and a marker's hit area is 44 wide. A row with one lane stays
  44 high; each more lane adds 44.
**Why:** OI-067 asked for 44 px touch targets on the board; taller lanes keep every mark on the board, where a list per
row would hide them. A hold before a drag keeps scrolling by finger, which a phone needs most.

## D-145 — Approving shows the rules' answer, not a live warning
2026-11-11 · accepted · refines D-014, D-142 · from audit A4
The approve buttons of the details drawer and the inbox show no live rule warning. Pressing one sends the step, and the
command's answer opens the acknowledgment dialog of D-142; the heat row gives the context beforehand. D-014's "warnings
while approving" is met by that dialog.
**Why:** audit A4 question 1, answered with its recommendation under the owner's instruction of 2026-11-11 to work fully
autonomously. A warning beside every approve in a list would cost one evaluation per row for what the dialog already says.

## D-146 — A live warning lists hard and soft rules together
2026-11-11 · accepted · refines D-073, D-142 · from audit A4
While a form is filled or a bar dragged, the live warning lists every rule the change breaks, hard and soft. The command
keeps D-073: a hard rule refuses with the hard ones only, and once the change no longer breaks it, the soft ones ask for
their acknowledgment, as the warning already showed.
**Why:** audit A4 question 2, answered with its recommendation under the owner's instruction of 2026-11-11. The person
filling the form sees the whole cost of the change at once.

## D-147 — "A unit and below" counts archived sub-units on the days served; the chip of an unread filter
2026-11-11 · accepted · refines D-067, D-131, D-134 · from audit A4
- A unit condition with descendants means the same everywhere: on a day, a soldier whose primary membership that day is
  in the unit's tree counts, also when that sub-unit was archived later. The board, the bar and the presence lists read
  the tree with archived units, as rules and commands already do (OI-098).
- The chip of a filter the bar does not read says "סינון מותאם", the words the UI and D-140 use; D-131's "סינון אחר" is
  replaced.
**Why:** audit A4 finding 1 and question 3, answered with its recommendation under the owner's instruction of
2026-11-11 (one meaning of a filter, D-067), and finding 5 on the words.

## D-148 — Asking to link: the request, auto-link, withdrawing
2026-11-11 · accepted · refines D-005, D-030 · decided under the owner's autonomy instruction of 2026-11-11
- **`accounts.requestLink`** is for a signed-in identity with no account (`forbidden` once linked, `unauthenticated` when
  signed out). Its organization is the one the store holds (D-011: one per local store); with none it answers `not_found`,
  since an empty store is claimed through the bootstrap (D-005). The claimed personal number is stored normalized (D-066).
  An identity with a pending request cannot send another (`already_exists` on `id`).
- **Auto-link** needs a verified email and `autoLinkSoldier` (D-066). It writes the account (`linked_by` NULL, the
  identity's provider) and keeps the claim as a request row, `approved`, with the soldier and no reviewer, so every ask
  leaves one row. The answer is `{ outcome }` in both cases, and a pending outcome never says whether anything matched.
- **`accounts.cancelLinkRequest`**: the requester withdraws their own pending request (`cancelled`); another identity's
  request answers `not_found`, and one that is no longer pending `invalid_transition`.
- A request needs no new column: the provider of an account written by a review is the build's provider, the same for every
  identity of one build (D-048).
**Why:** the V9 card; the smallest set that keeps D-005's no-enumeration rule and leaves one audit row per ask.

## D-149 — Reviewing a link request: who may be named, what approval writes
2026-11-11 · accepted · refines D-030, D-066 · OI-034, OI-072 · decided under the owner's autonomy instruction of 2026-11-11
- **Who sees a request, and its candidates (OI-034).** A reviewer reads the candidates over which they hold
  `accounts:approve`, and no others. A request is visible when that list is not empty, or when the request has no candidates
  at all and the reviewer holds the permission at organization scope (D-066's rule, stated on the filtered list). A request
  the actor may not review answers `not_found`.
- **Resolutions.** `link` must name one of those candidates (`reference_not_found` otherwise, at
  `resolution.soldier_id`); it writes the account (`linked_by` the reviewer). `create_soldier` needs `soldiers:create` and
  `accounts:approve` over the placement (the unit, or the organization without a membership) and `memberships:update` over the
  unit, with the checks of a new soldier: rank, unit, live. `reject` needs only the right to review.
  Only a pending request is reviewed (`invalid_transition`, D-066).
- **Enrichment (D-030).** Approval writes the claimed personal number to the linked or created soldier when it has none, in
  the same transaction, whatever `soldier_private:update` the reviewer holds, since the approval is the permission that
  covers it. A number another soldier already holds is skipped, not refused; the request still links. Names are never
  overwritten.
- An identity that got an account since the request was written answers `already_exists`.
**Why:** OI-034: a reviewer's authority covers the soldiers they approve, so they cannot link an identity to one outside it;
and the candidate list reveals no soldier beyond that authority (D-005, D-138).

## D-150 — The account-links module
2026-11-11 · accepted · refines D-030 · decided under the owner's autonomy instruction of 2026-11-11
- One panel, `account_links`, with a bar button "חיבורים" and the number of pending requests, for who holds
  `accounts:approve` at organization scope or reads at least one pending request.
- The list shows pending requests only (a closed row stays stored). A request shows the name, the claimed number, the email
  and when; opening it shows its candidates with why each matches (personal number, name), and three actions: link to a
  candidate, create a new soldier (rank, unit and the date it starts, as a new soldier's form), reject.
- The link and the reject confirm in a dialog that says what is written.
**Why:** the V9 card's "review module", the smallest form that shows every resolution of D-030.

## D-151 — The onboarding of an identity with no account
2026-11-11 · accepted · refines D-005, D-030 · OI-055 · decided under the owner's autonomy instruction of 2026-11-11
- An identity that cannot claim the organization sees a form (first name, last name, optional personal number) or, with a
  pending request, a notice that it waits for review, with a way to withdraw it. A sent form that auto-links goes straight to
  the workspace; one that does not shows the notice, whatever matched.
- A linked soldier with no permission to read the organization sees that their account is linked and has no access yet,
  rather than a board that "is not available" (OI-055). Whether such a soldier sees more is OI-060.
- Not told: a request that was rejected looks like no request, and the form returns (an open item for V11).
**Why:** D-005's "the response never reveals whether a match exists", and the card's "the linked soldier sees nothing until
V10 gives them a role, and that is correct".

## D-152 — Deferred from V9: invite links, revoking a link, restoring archived rows
2026-11-11 · accepted · OI-019, OI-026 · decided under the owner's autonomy instruction of 2026-11-11
- **Invite links (OI-026)** are not built: they change D-030's matching (a unit's soldiers only) and add a table, so they are
  their own slice when the owner wants them (a new open item, `owner (later)`).
- **Revoking a link** needs a partial unique index on `soldier_accounts.soldier_id` (`WHERE revoked_at IS NULL`) so a soldier
  can be linked again; it is decided with the access screens, in V10 (a new open item).
- **Restoring an archived row** stays out; it is a new open item, `owner (later)`, with the personal-number note of D-098.
**Why:** none of the three is needed to link a second identity; the autonomy instruction prefers the smallest option that does
not grow the slice.

## D-153 — The invite email field
2026-11-11 · accepted · refines D-018, D-094 · OI-046 · decided under the owner's autonomy instruction of 2026-11-11
`soldier_private.invite_email` gets a field in the new-soldier form and in the private fields (read-only for who may only
read), beside the personal number and the phone, with the same permissions (D-096). Auto-link reads it (D-148).
**Why:** OI-046: it is the field auto-link matches, so without it auto-link has nothing to link.

## D-154 — The Claude Code harness replaces the session rituals
2026-11-11 · accepted · supersedes D-052, D-081 · refines D-051, D-075, D-110, D-126, D-128
- What a prose rule asked of every session is enforced by the harness in `.claude/settings.json`: hooks block pushes to
  main, commits on main, force pushes, history rewrites, skipped git hooks and `.env` files; a lint hook runs after each
  edit; a stop hook runs `npm run check` before a turn may end with uncommitted code.
- `CLAUDE.md` keeps only commands, where the docs are, and the rules no tool checks. The slice workflow is the `slice`
  skill and the audit is the `/audit` skill (owner-invoked, read-only); `docs/AUDIT.md` moves into it.
- No start-of-session reading list (D-081): a session reads the slice card, the decisions it names (index first, then
  the entries by grep), its open items and its tables, on demand.
- No handoff files: the pull request's description carries done, how to see it, decisions, checks and the review, open
  items by id, and the next row with a model and effort recommendation (replaces D-052's handoff part). The
  audit reports go in the description of the docs pull request that records them. `docs/sessions/`,
  `docs/audits/` and `docs/AUDIT.md` move to `.claude/archive/`, unchanged.
- One slice is still one branch and one pull request (D-110, D-126), but a session may run several slices in a row,
  with `/clear` between them (D-075).
- No GitHub branch protection or rulesets: the repository is private on a personal free plan, where they are not
  enforced, and the owner chose not to pay for them. The harness hooks and CI are the guard; a pull request merges
  only when CI is green.
**Why:** the owner's instruction of 2026-11-11 to cut usage and enforce quality through the harness. A fresh session per
slice and a fixed reading list re-paid a context of about 100k tokens every time, and rules in prose were
re-read on every turn but enforced by nothing.

## D-155 — The phone's module buttons scroll inside the bottom bar
2026-11-11 · accepted · refines D-108, D-116 · OI-095 · decided under the owner's autonomy instruction of 2026-11-11
On a phone, the bottom bar's module buttons sit in a row that shrinks with the bar and scrolls sideways when they do not
fit, as the filter row does (D-131); the organization's name and the user menu stay in place. No bar may be wider than
the screen.
**Why:** V9's account-links button made seven 44 px modules plus the user menu, wider than a phone's bar. The bar then
widened the page, the phone zoomed out, and presses landed beside their targets (V9's CI failed on mobile). A "more"
menu, OI-095's lasting answer, stays with V10, which adds more modules.

## D-156 — Every way of giving a role is guarded, and a grant stays within the granter's reach
2026-11-11 · accepted · extends D-060 · refines D-059 · OI-038, OI-068 · decided under the owner's autonomy instruction of 2026-11-11
- D-060's guard (the actor holds every pair, at a non-empty scope, or the write fails with `forbidden`) applies to every
  write that gives pairs to someone: a grant (the role's pairs), a role's permission set (the added pairs), a rank
  binding's create and its `role_id` change (the role's pairs), the organization's `baseline_role_id` (the new role's
  pairs), and a soldier's `command_rank_id` (the pairs of every live role bound to the new rank).
- A grant's scope is limited too: its scope, resolved for the grantee today (D-054), must lie within a scope at which the
  actor holds `access_grants:create`. Organization lies only within organization; a unit with its descendants lies within
  the same unit with descendants or any ancestor with descendants; a unit alone also within the same unit; a soldier
  within any scope that covers that soldier. An empty scope grants nothing and is refused with `forbidden`.
  The source that covers the scope must also be no wider in rank and no longer in time: its `subject_rank_constraint`
  is the grant's or wider (`any` ⊇ `junior_or_equal` ⊇ `junior`), and it has no end or ends no earlier than the grant.
  Rank bindings and the baseline role are organization targets, so D-053 already asks organization scope for them.
- After every write that can change permissions (grants and revokes, roles and their permission sets, archiving a role,
  rank bindings, the baseline role, a soldier's rank, status or archive, account links and their revocation) the data
  layer checks D-059 on the state after the write and rejects it with `last_access_manager`.
**Why:** OI-038: a role reached through a rank binding, the baseline or a promotion bypassed D-060, and a platoon
commander could grant a pair at organization scope. Limiting the scope by the granter's own reach is the same rule that
already limits the pairs.

## D-157 — A holder without seniority gets only `any`; a rank write is checked before and after
2026-11-11 · accepted · refines D-057 · OI-039, OI-038 · decided under the owner's autonomy instruction of 2026-11-11
- D-057 wins over the current code: a holder without seniority gets only `any` permissions, their own record included.
  With seniority, `junior` excludes the holder's own record and `junior_or_equal` includes it, as before.
- A soldier write that sets `command_rank_id` (create or update) passes the permission check on the soldier as stored
  after the write too, so a holder limited to `junior` cannot create a soldier above them or promote one past them.
  This holds for every way a soldier is created, an approved link request included. A soldier's own rank changes only
  through a source with `any`: `junior_or_equal` covers their own record, and a higher rank would widen what their
  constrained sources reach.
**Why:** D-057 is the approved rule (OI-039). The check after the write closes the gap OI-038 notes: the constraint
compared only the state before.

## D-158 — An access manager holds the three pairs with `any`
2026-11-11 · accepted · refines D-059 · OI-040 · decided under the owner's autonomy instruction of 2026-11-11
D-059's three pairs count toward an access manager only from sources with `subject_rank_constraint = 'any'`, at
organization scope, without expiry.
**Why:** OI-040: a holder limited to `junior`, or without seniority, cannot manage everyone, so the invariant must not
count them.

## D-159 — `self` lets a soldier see their own unit chain
2026-11-11 · accepted · refines D-053 · OI-041 · decided under the owner's autonomy instruction of 2026-11-11
A `soldier` scope (`self` or a soldier anchor) also covers `view` of unit targets that are the soldier's primary unit
today and its ancestors (D-054). Every other action on a unit target still needs a unit or organization scope.
**Why:** OI-041: with the baseline role a soldier saw the top-level units but not their own platoon. Seeing one's own chain
is what the baseline's `units:view` is for; sibling units stay hidden.

## D-160 — Without `organization:view` the board uses the device's day
2026-11-11 · accepted · refines D-107, D-151 · OI-060 · decided under the owner's autonomy instruction of 2026-11-11
A linked soldier who cannot read the organization still gets the board and the new-leave form, with "today" in the
device's time zone and only the rows they may read. Commands still compute the day in the organization's time zone.
The "no access yet" notice of D-151 stays for a soldier who reads no soldier at all.
**Why:** OI-060: the baseline role is the organization's choice, so the screens must not depend on it holding
`organization:view`; the device's zone is the organization's for every real user of a one-country pilot.

## D-161 — Presence lists leave out soldiers whose leaves the actor cannot read
2026-11-11 · accepted · refines D-133, D-134 · OI-092 · decided under the owner's autonomy instruction of 2026-11-11
The present and absent lists, their counts, the presence pill and "only who is missing" include only soldiers whose
leaves the actor may view. The others are left out, not counted as present.
**Why:** OI-092: counting them as present says something false; "unknown" would add a third list for no use.

## D-162 — Live rule warnings only for an actor who reads everything a rule counts
2026-11-11 · accepted · refines D-142 · OI-094 · decided under the owner's autonomy instruction of 2026-11-11
Live warnings (D-142) run only when the actor holds `view` on soldiers, unit memberships and leaves at organization scope
with `any`. Any other actor sees a rule only through the command's answer (`rule_violation`,
`rule_acknowledgment_required`) and the same dialog.
**Why:** OI-094: a warning computed from part of the data can differ from the command's; no warning is better than a wrong
one, and the command's answer is always right.
*Implementation note:* "organization scope with `any`" is checked as the permission holding for the `every_soldier`
target of D-028: a grant anchored to the organization with no rank constraint.

## D-163 — Revoking an account link
2026-11-11 · accepted · refines D-030, D-149, D-152 · OI-103 · decided under the owner's autonomy instruction of 2026-11-11
- `soldier_accounts.soldier_id` is unique only among links that are not revoked (a partial unique index
  `WHERE revoked_at IS NULL`; the local database checks it in code), so a soldier can be linked again.
- `accounts.revokeLink({ id })` sets `revoked_at` and `revoked_by`; it needs `accounts:approve` on the soldier, refuses the
  actor's own link (`forbidden`) and is checked by D-156's access-manager rule. The account-links module lists linked
  soldiers with a revoke action.
- An identity whose link was revoked may ask again. `requestLink` answers an id that is already taken with
  `already_exists` without telling whose it is.
**Why:** D-152 deferred revoking to the access screens. A revoked identity asking again is the normal way back.

## D-164 — Link-request candidates stay computed
2026-11-11 · accepted · refines D-149 · OI-106 · decided under the owner's autonomy instruction of 2026-11-11
A request's candidates are computed on read, as now. A pending request with no visible candidate still shows to a
reviewer who could approve it as a new soldier (D-149), and a closed request lists none.
**Why:** OI-106: stored candidates would go stale when a soldier is linked or archived, and "never store what can be
derived" (CLAUDE.md).

## D-165 — The roles and grants modules; "more" on a phone
2026-11-11 · accepted · refines D-108, D-155 · OI-095 · decided under the owner's autonomy instruction of 2026-11-11
- **Roles:** a list of roles with a form (name, description, color) and a permission grid of D-040's valid pairs; the
  rank bindings of each role with a scope picker and a rank constraint; the baseline role chosen in the same module.
- **Grants:** a list of grants (active first, inactive on request) with a form: grantee, role, scope picker, rank
  constraint, valid from and to, reason; and revoke.
- The scope picker offers the anchors of D-028 with only the fields the anchor needs.
- On a phone, the bottom bar shows the first `PHONE_BAR_MODULES` (four) allowed modules and a "more" button whose menu
  lists the rest, each with its count. When only one module would be left over, it stays in the bar instead.
**Why:** the V10 card; OI-095: seven or more modules do not fit a phone's bar even scrolling (D-155).

## D-166 — A grant's window is whole days in the organization's zone
2026-11-11 · accepted · refines D-028, D-165 · decided under the owner's autonomy instruction of 2026-11-11
The grant form asks for a first and a last day, both optional. `valid_from` stores the start of the first day in the
organization's time zone (NULL: from now); `valid_to` stores the start of the day after the last one, so the last day
is inclusive (NULL: until revoked). The list reads them back the same way. A grant's state now is active, scheduled,
expired or revoked; active and scheduled grants come first, the others only on request.
**Why:** an officer grants "until Thursday", never an instant; a half-open window of whole days matches how leaves are
stored (D-107) and needs no time field on a phone. A granter who cannot read the organization gets the device's zone, as
on the board (D-160).

## D-167 — My requests: the soldier's own leaves, open and history
2026-11-11 · accepted · refines D-013, D-023, D-063, D-115, D-119 · decided under the owner's autonomy instruction of 2026-11-11
- A panel, `my_leaves`, with a bar button "הבקשות שלי", for a linked actor who may read their own leaves
  (`leaves:view` on their own soldier). On a phone it is the first module in the bar.
- It lists the actor's own leaves in two parts: **open**, the pending ones and the approved ones whose last day is today or
  later, the earliest first; and **history**, the rest (past approved, rejected, cancelled), the last changed first. A row
  shows the type, the days and the status, and opens the leave's details, where the thread, the comments and the actor's own
  steps already are (D-119).
- "New request" sits at the top of the panel for an actor who may create a leave for themselves. The new-leave form fills
  in the soldier when it offers only one.
- The fighter learns of an answer by the status in this list; notifications are not in the roadmap.
**Why:** the V11 card ("requests a leave, sees status and history, and comments ... the fighter sees the result") with
the screens that exist: the details panel already holds the thread and the steps, so the new piece is the list. Splitting
on what still matters to the fighter keeps the first screen short on a phone.

## D-168 — A rejected link request is told to its identity
2026-11-11 · accepted · amends D-151 · OI-105 · decided under the owner's autonomy instruction of 2026-11-11
`OnboardingState.last_rejected_at` is the time the identity's latest request was rejected, when it was and nothing is
pending (NULL otherwise). The form then says that the earlier request was not approved and that a new one may be sent.
**Why:** a rejection is a reviewer's answer to the identity's own request, given whatever matched (every request that does
not auto-link goes to review, D-151), so telling it reveals no match; seeing the same form again with no word is confusing.

## D-169 — The grants list moves to the next state on its own
2026-11-11 · accepted · extends D-166 · OI-108
While grant rows are on screen, the list recomputes their states at the next instant one of them starts or ends, as well as
when the data changes.
**Why:** a state computed when the list was read goes stale while the screen stays open (OI-108).

## D-170 — Full autonomy: Claude decides product choices and runs audits without stopping
2026-11-11 · accepted · refines D-051, D-154
- The owner's standing instruction of 2026-11-11: Claude runs the roadmap to the end on its own and does not stop to ask.
  A product choice that no decision covers is decided by Claude from the decisions and the product's direction, taking
  the option it would have recommended, and recorded as a decision whose header says "decided under D-170". Open items
  that say "needs a product-owner decision" are decided the same way at the start of their slice.
- An audit row (`A5` …) is run by a fresh subagent that has none of the building session's context, with the `/audit`
  skill's steps, read-only, without waiting for a confirmation. Its findings are triaged by Claude under this decision
  and recorded by a docs pull request, as D-051 describes, instead of waiting for the owner.
- Claude stops only for what it cannot do itself: a credential or account only the owner holds, or a permission the
  environment refuses. It then reports exactly what is blocked and carries on with everything else.
- The owner's follow-up the same day: A5 is not run on its own. When the roadmap reaches A6, one combined audit covers
  the scope of both rows (one fresh subagent, one triage, one docs pull request), so development stops once, not twice.
- This decision was first written as D-155 on a branch that never reached `main`; that number went to another decision.
**Why:** the owner's words of 2026-11-11: "run alone to the end, stop stopping to ask me". The owner accepts the
recommendations, which already follow the recorded decisions and the product's direction.

## D-171 — Import runs the built commands and stops at the first refusal
2026-11-11 · accepted · refines D-022, D-050 · OI-018 · decided under the owner's autonomy instruction of 2026-11-11
- **Operations.** `ImportOperation` holds the create commands that are built: unit levels, units, command ranks, soldiers
  (and their tags), roles, rank bindings, access grants, tag categories, tags, leave type groups, leave types, leaves and
  availability rules. Seniority overrides, leave batches, deployments and property definitions join with the slice that
  builds their command (D-076).
- **The run.** `data_transfer:import` is checked before anything else, so who may not import learns nothing of the
  input's form. The whole input is parsed next. If an operation is malformed, nothing runs and every operation is
  reported on its form alone. Otherwise the operations run in order through the same commands as the UI, in one
  transaction; each command checks its own permissions. The first refused
  operation ends the run: the results stop at it, with its error. A dry run, or a run with a refusal, writes nothing and
  announces no change; a committed run announces its changes once, after the commit.
- **The file.** A JSON file of `{ "operations": [...] }`, or a CSV of soldiers whose header names columns from
  `SOLDIER_CSV_COLUMNS` (in any letter case); each CSV row is one `create_soldier` with a new id and no placement. The
  CSV is read as UTF-8: a file in another encoding is refused by name ("save it as CSV UTF-8"), not imported with
  broken letters. Rows are numbered by data row, the header not counted. The owner sees the dry run's report, then
  commits it; the dry run refreshes nothing, and only the last file picked is shown. The export's file name carries
  the day on the organization's clock.
- **Export** is one JSON file, downloaded, of every table as stored (D-050), gated by `data_transfer:export`.
- **Where.** Import and export open from the account menu, as a drawer panel, for who may import or export. They are
  not a module button: the bar is already full on a desktop (OI-110), and this is an occasional task.
- **OI-018: no privileged restore in the app.** Import re-creates rows through commands, so leave history, audit columns
  and account links of an export are not carried over by it. Moving local data to the backend loads the export file once,
  on the server, in 8.3 (OI-109).
**Why:** a refusal inside a nested IndexedDB transaction aborts the whole transaction, and later operations usually
name rows the earlier ones create, so checking them past a refusal would report errors that are not theirs. A restore
that writes rows as stored would be a path around the commands' validation (rule 4); the one-time move to the backend
is a server task, not a screen. A CSV of soldiers is the spreadsheet the owner already holds; everything else is JSON.

## D-172 — Parallel tracks: two sessions build the roadmap at once
2026-11-12 · accepted · refines D-154, D-170 · decided under the owner's autonomy instruction of 2026-11-11
- An orchestrator session, acting for the owner, assigns roadmap rows to tracks; sessions never pick rows. Track A
  builds the V rows (V12a, V13 … V17), track B the 8.x rows (the backend). A track edits only its own ROADMAP rows.
- Number ranges keep ids from colliding: track A takes decisions D-171..D-199 and open items OI-109..OI-149; track B
  takes D-200..D-249 and OI-150..OI-199. When both add index rows, a merge keeps both sides, in numeric order.
- `docs/schema.sql` and `contracts` are shared: a track sends the orchestrator the exact change and waits for its
  approval before committing a change to either.
- Before every merge a track merges `main` into its branch, runs `npm run check` again, and merges only on green CI.
- A5's deferral stays as D-170 records it: one combined audit at A6.
**Why:** the backend and the remaining screens touch different layers, so building them side by side halves the wall
time; fixed ranges and one approver for the shared model keep the two branches from contradicting each other.

## D-173 — Navigation rebalance: daily work in the bar, setup in a side panel
2026-11-12 · accepted · refines D-104, D-108, D-116, D-121, D-131, D-141, D-165, D-171 · OI-110 · decided under the owner's autonomy instruction of 2026-11-11
- **The bar holds daily work only:** the view switcher, the date navigation, my leaves and the inbox with its count,
  "only who is missing" and the present/absent lists, a new leave, the filter control, the soldier's pins and the
  user menu. On a phone the same items share the top and bottom bars; "more" (D-165) is gone.
- **The navigation panel** opens from a menu button at the start of the bar and slides in from the start side (the
  right, in Hebrew). Its sections, in order, come from `NAVIGATION_SECTIONS` in config: structure (units, soldiers),
  leave setup (leave types, rules, tags), access (roles, access grants, account links) and data (import and export,
  moved out of the user menu). An item shows only to who may open its module (D-076); an empty section is not shown,
  and when every section is empty the menu button is not shown either. Panels keep their URL, so deep links work.
- **Pins.** A soldier may pin any panel module to the bar. Pins are stored in `soldier_preferences.preferences` as
  `pinned_modules` (a list of `NavigationModule`, no duplicates, default empty), beside D-121's default, so the
  table does not change. Every viewer of the board has a soldier row (an unlinked account sees only onboarding,
  D-005), so there is no branch for one without. Nobody starts with pins, whatever their role: the bar holds the
  dates, the view and the filters, and a soldier adds what they use. A pin to a module the viewer can no longer open
  stays stored and is not shown; the bar filters pins by the same access check as the panel, at read time.
- **Unit scope** reads as a compact label of the current unit, opening the picker. With no unit chosen it shows the
  anchor: the name of the single root unit the viewer sees, otherwise "the whole organization". The picker offers only
  the units the viewer can see; a viewer who sees a single unit gets its name as a label, with no picker.
- **The filter row** is collapsed while no condition is set. A "filter" control in the bar opens the conditions; once
  any condition is set the row shows, with a "clear all" that keeps the unit scope.
- **The rules heat row** shows only when at least one live rule concerns the unit in scope. It sits under the soldier
  list by default; `rules_row_placement` ('above' | 'below', default 'below') is chosen in the panel.
**Why:** at 1280 px the bar held eleven module buttons and cut the organization's name (OI-110); V13 adds more
views. Setting up units, rules and roles is occasional work, so it moves out of the daily surface, and pins give back
one-tap access to whoever needs a module daily. An empty heat row and an empty filter row only take room.

## D-174 — The list, the table and the calendar share the board's model and frame
2026-11-12 · accepted · refines D-108, D-112, D-147 · OI-088, OI-097, OI-098 · decided under the owner's autonomy instruction of 2026-11-11
- **One model.** `logic/board` (`useBoard`) gives every engine the same days, rows and leaves for the window, the
  filter, the leave conditions and "only who is missing" (D-132, D-133). `boardEntries` lists the drawn leaves one per
  soldier and leave, in the rows' order; `boardDays` and `calendarWeeks` lay the window out in whole weeks.
  `logic/timeline` keeps only what the timeline alone does (editing by drag).
- **One frame.** `ui/board` holds what the engines share: `BoardEngine` (loading, failure, "no soldiers yet", "nobody
  matches" and the callbacks that open a soldier or a leave), `EngineScroller` (the named, focusable region under the
  bars), `LeaveChip` and the labels of a leave. An engine is only an adapter over it; only the timeline has a core and
  a view, because only it has geometry.
- **The list** is the board's rows, virtualized: a group heading, then each soldier with their rank and their leaves in
  the window as chips with dates, or "no requests in range".
- **The table** has a row per leave in the window: soldier, unit, type, from, to, days, status. Each header sorts
  (`aria-sort`) in the page only, not in the URL; the soldier and the type open their panels. With no leaves it says so.
- **The calendar** is the window in whole weeks, seven columns from `md` and one day per line below it. A day heads with
  its weekday and number (today marked) and how many are out that day (approved absences only, D-133), then a chip per
  leave with the soldier's name. Places of a week outside the window stay empty and are hidden from readers.
- **A chip** is a button that opens its leave (D-119), in its type's color or the uniform one, dashed while pending
  (D-111, D-112). Its name is its own text, with the status a reader cannot see in between, so the name holds what is
  seen (WCAG 2.5.3).
- **Colors** (`colors`, D-112) apply to every view, so the view menu shows the choice for all of them.
**Why:** OI-088 asked to separate the timeline's pieces before more engines arrived. Every view reading one model keeps
them from disagreeing on who is in view; a shared frame keeps the empty and failed states the same. The window stays a
week for now (OI-111).

## D-175 — The bar names the unit in scope, not the organization
2026-11-12 · accepted · refines D-173 · decided under the owner's autonomy instruction of 2026-11-11
- The organization's name is the page's level-one heading for readers only, on every screen size, as it already was on a
  phone. The bar shows one name: the unit scope label of D-173, which says which unit the board shows.
- The panel's choices are drawn so they can be seen: a radio's ring has the muted text color (at least 3:1 against
  the panel, WCAG 1.4.11), and a pinned module's pin is filled as well as colored, with `aria-pressed` saying the state.
**Why:** the organization's name beside a unit's name read as two competing units; the scope label alone answers
"what am I looking at".

## D-176 — The properties module, and the rows behind reference values
2026-11-12 · accepted · refines D-016, D-065 · OI-037, OI-073 · decided under the owner's autonomy instruction of 2026-11-11
- **The module.** "מאפיינים" sits in the navigation panel's leave-setup section, after tags, for whoever holds
  `properties:*` at `organization`. It lists the live definitions by entity type (soldiers, units, leaves), each in its
  order; a row shows the label, the field type and "חובה" when required, and its menu moves it up or down or archives
  it. The form has the label, the entity type and the field type (chosen at creation only, then shown as text), the
  "required" switch and, for a select or multi-select, the options: a label and a color each, in order.
- **Writes.** `property_definitions.create` and `update` pass `propertyDefinitionIssues` (D-065) before they store
  (OI-073); the entity and the field type are not in the update input.
- **Values in forms.** The soldier, unit and leave forms end with one field per live definition of their entity, in
  order: text, a number, a date, yes/no/none, one option or none, a check list, a soldier search, a unit picker. The
  values stay beside the form library's own values and join the command's input as `properties`; values of
  definitions the form does not show (archived) are kept as stored. An empty field stores no key (D-065).
  A multi-select shows as checked only the options that still exist, so a change writes live options only. The
  definition forms open for who may create or change a definition; for anyone else the form is not there (D-076).
- **References (OI-037).** A new or changed `soldier_ref` or `unit_ref` value must point to a row of the organization
  (`reference_not_found`) that is not archived (`reference_archived`), checked by the data layer from
  `propertyReferences`. One archived later stays, like any unchanged value.
**Why:** D-016 and D-065 set the model; this records what the module and the forms show, and closes the two checks
the domain left to the data layer.

## D-177 — Property chips in the filter bar
2026-11-12 · accepted · refines D-131 · OI-080 · decided under the owner's autonomy instruction of 2026-11-11
- The filter source holds the property definitions, archived ones too, so a soldier's stored values are filtered on
  (OI-080).
- The bar reads two property conditions of soldiers: `property any_of` a list of option ids, of a select or
  multi-select property, and `property equals` true or false, of a yes / no property. Each is one chip per property,
  in the order added, named by the property's label; its values are the options' labels, or "כן" / "לא". A yes / no
  chip holds one answer: checking the other replaces it.
- "Filter" offers each live soldier property of those types that has a choice and no chip yet. A chip of an archived
  property keeps its label; an option that is gone reads "לא זמין"; a property the viewer cannot read is a chip named
  "לא זמין" that can only be removed. Any other condition on a property is "a filter the bar does not read".
- An option removed since a chip was written matches no value; the chip's other options still match. A chip that no
  longer fits its property (a property of another entity, or of a type the chip is not written for) reads "לא זמין"
  and can only be removed.
**Why:** select and yes / no are where a unit filters by a property (blood type, a license). Text, number, date and
reference conditions need operators and inputs the bar does not have; they stay in the model (D-067) and wait for a
need.

## D-178 — A new navigation module: its entry first, then the enum, then its section
2026-11-12 · accepted · refines D-173
`NavigationModule` (contracts) and `NAVIGATION_SECTIONS` (config) must agree, and the bar's entries in `ui` cover every
module. So a new module lands in three commits, each green: the `ui` entry first, checked by assignment to the
`NavigationModule` record so it may come before its enum value; then the enum value in `contracts`; then the module in
its section in `config`.
**Why:** one layer per commit (D-127) with every commit green; the order is the only one in which each step compiles.

## D-179 — Deployments, collective leave, copies of a leave and personal seniority on screen
2026-11-12 · accepted · refines D-012, D-019, D-029, D-049, D-071 · OI-069, OI-074, OI-081, OI-096 · decided under the owner's autonomy instruction of 2026-11-11
- **Deployments** are a module of the leave setup section, after rules (D-178 order). A deployment is a target of its
  unit, as a scoped rule is (D-053); moving it needs `update` on both units. The `organization` target of
  `deployments` only asks whether the actor sees any deployment, to open the module; the data layer checks unit
  targets. Without a live unit the empty module says that a unit comes first, since a deployment belongs to one.
  "Active" is read from the dates (never stored). The list is the latest first, then by name.
- **Members** are edited as one list under the deployment's version: a member's own dates may only narrow the
  deployment's, and blank means the deployment's own day. Members the actor cannot see are kept as they are. New
  deployment dates must still hold every member's own dates.
- A rule's form offers a deployment when one exists, and the rules read deployments and their members, archived ones
  too: a rule of an archived deployment counts nobody (D-071, OI-096).
- **A collective leave** is a switch in the new-leave drawer, shown only when there is more than one soldier to choose:
  a batch name, the soldiers, one type and the same days. **A copy of a leave** is a form inside the leave's drawer:
  the soldiers and days are new, and the type, effect override, reason and properties are copied; never the status or
  the history. Both run each new leave through `planLeaveCreation` and its permissions, judge the rules on them all at
  once, save all or none, and write one `created` event per leave with the acknowledged rules (OI-074). "Approve now"
  shows only to who may approve every soldier chosen (D-013). A batch is visible with any of its leaves.
- **Personal seniority** is a section of the soldier's page: an override is created and revoked, never edited, and a
  revoked one stays as history. Only live overrides may not overlap; the overlap answer names only the date, since it
  counts overrides the actor may not see (OI-069). The filter source reads the overrides (OI-081).
  A create or revoke is checked again after the write, on the soldier as stored from the override's first day,
  since seniority feeds the junior constraints (D-157); one's own seniority changes only with an unconstrained
  (`any`) source.
- **A deployment** is a row in its own drawer. New dates that would cut a member's own days off answer on the date
  that cuts them. A rule's deployment reference must be one the actor sees and still live.
**Why:** these are the V15 card's four pieces. They are built on the existing targets and commands, so they add no
new permission concept, and every write goes through the same plan and rule gate as a single leave.

## D-180 — The organization's setup: steps, who sees them, where it opens
2026-11-12 · accepted · refines D-033 · OI-114 · decided under the owner's autonomy instruction of 2026-11-11
- **The steps**, in order (`SETUP_STEPS` in `config`): unit levels, units, command ranks, rank bindings, leave types,
  tags, soldiers. The organization step of D-033 is left out: its name is given when it is claimed and there is no
  form to edit it (D-076). Soldiers close the list, since a setup is not usable without them; import (D-022) stays
  the other way in.
- **A step shows** only to who may `create` what it sets up across the organization (the rank bindings step asks for
  `roles`). With no step allowed there is no setup at all: not in the panel, not on the board (D-076).
- **A step is done** once a live row of what it sets up exists (rank bindings: a live binding; tags: a live tag).
  Nothing is stored. Progress reads "X of Y steps done".
- **A step opens its own module** (the tags step opens tag categories, which come first), so each step uses the forms
  that module has, and the way back is the navigation panel or the empty board. Any step may be skipped or redone.
- **Where it opens:** first in the navigation panel, never pinnable, since it is for setting up and not for daily
  work; and on a board with no soldiers, beside "soldiers".
- **Row answers (OI-114):** a collective leave or a copy that the server answers on one of its rows
  (`leaves.N.<field>`, `copies.N.<field>`) shows the answer on the form's field it came from.
**Why:** D-033 asked for a guided first run with no second code path and no stored flag. Linking each step to its
module keeps one form per entity, and deriving the marks from the rows keeps them true after an import or an edit.

## D-200 — Backend: Supabase and Vercel, free plans
2026-11-11 · accepted · supersedes D-027 · OI-014 · decided under D-170
Supabase hosts the database (Postgres), authentication (Google) and the server function (an Edge Function). Vercel
hosts the built app. Both run on their free plans: nothing that costs money is created or enabled; a step that would
cost money becomes an open item instead. Public client values (the project URL and its anon key) live in the hosting
provider's environment variables, and `.env.example` lists their names only; no secret is in the repository.
The Supabase project is `sagol` (ref `etmyjbhkqoufoqsjbhev`, region `eu-central-1`, free plan); the Vercel project is
`sagol` (Hobby plan, linked to the repository, so every push gets a preview deploy).
**Why:** the reasons of D-027 (Postgres matches `schema.sql`, row-level security matches the policy model, Google sign-in is
built in), and the owner's instruction to use these two providers at no cost.

## D-201 — One command gateway runs the adapter's own code on Postgres
2026-11-11 · accepted · refines D-008 · OI-025, OI-029
- **Migrations.** `supabase/migrations` is the executable form of `docs/schema.sql`: the first migration is the schema
  itself, later ones add server objects (D-202) and, from 8.2, policies. `npm run test:db` rebuilds a local database from
  the migrations (`scripts/db-reset.ts`, which refuses a non-local URL) and compares its catalog (columns, constraints,
  indexes) with a database built from `schema.sql` (`scripts/db-schema-drift.ts`); a difference fails the run. CI runs it
  on a Postgres 16 service.
- **The gateway.** Instead of one SQL function per command, one server function (`supabase/functions/commands`) takes
  `{kind, group, method, args}` and runs the local adapter's command core (`src/data/local/core.ts`) over a `Store` backed
  by Postgres (`src/data/server/postgresStore.ts`), in one SERIALIZABLE transaction per request. Validation, visibility,
  policy, state and integrity checks (D-090) are the same code on both sides, so they cannot drift; a lost serialization
  race runs the request again, up to four tries, then answers `unavailable`. The answer carries the result and the
  changes, for the caller's change feed. The kinds are `session`, `transfer`, `repositories` and `commands`; `session`
  and `transfer` are single services, so their group is the kind itself. An import (`transfer.importBatch`) runs inside
  the request's transaction, a dry run and a refusal roll back through a savepoint, and the body cap bounds its size.
- **Identity.** The actor comes only from the bearer token, which the function checks with Supabase's auth server
  (`/auth/v1/user`); only a Google identity is accepted. No token means signed out. A token the server refuses answers 401;
  an unreachable auth server answers 503. The request body never names an actor.
- **Server entry.** `src/data/server/index.ts` is a second entry of `data`, imported only by the function. It holds no
  driver and pulls in no browser code (Dexie, storage events); the app's layers keep using `src/data/index.ts`. The
  function's `deno.json` maps the aliases to `src`, and CI runs `deno check` on it.
- **Driver.** `postgres` (postgres.js) 3.4.9, pinned exactly (D-037), in the function and in the DB tests. The 4.x line was
  weeks old, and Deno's minimum dependency age refused it.
- **Tests.** The repository contract suite runs over the gateway (`postgres.contract.dbtest.ts`), each call crossing a JSON
  boundary as over HTTP. `triggers.dbtest.ts` checks the database's own guarantees in plain SQL.
**Why:** a second implementation of every command in SQL would have to agree with the first forever (OI-025, OI-029 asked
for shared tests to keep them aligned); running one implementation on both sides removes the question. SERIALIZABLE gives
each request the single-writer view the local adapter has in an IndexedDB transaction, so post-write checks such as the
one that keeps an organization's last administrator (D-059) cannot be raced.

## D-202 — The database's own guarantees: triggers
2026-11-11 · accepted · OI-064
The gateway checks every rule before it writes; these hold whatever writes the row, and refuse with SQLSTATE 23514:
- `unit_closure` is maintained from `units.parent_id` only (insert, move, detach); a cycle or a parent of another
  organization is refused (D-009).
- A soldier holds at most one tag of a `single` category, checked at the end of the statement, so a set can be replaced
  in one transaction (D-015).
- An update of a versioned row must raise `version` by exactly one (D-017). The writer sets `updated_at` and `updated_by`
  from its own clock and actor (D-083).
- `leave_events` is append-only, and the events of one leave get strictly increasing times: an event written at or
  before the leave's last event lands 1 ms after it (OI-064).
- Row-level security is on for every table with no policy until 8.2, so the Data API answers nothing; the gateway
  connects as the database owner.
The functions listed in `schema.sql`'s server-side block are the gateway's commands (D-201); `has_permission()` and the
policies come with 8.2.
**Why:** derived data (the closure) and history must stay right even for a write that does not come through the gateway,
such as a migration or a manual fix.

## D-203 — No client reaches a table: the policy stays in the domain
2026-11-11 · accepted · amends D-202 · refines D-201, D-007 · OI-022
- **No row policies, no `has_permission()`.** Row-level security stays on for every table with no policy (D-202), and a
  migration (`20261111000200_rls.sql`) revokes every privilege on the public schema's tables, sequences and functions
  from the API roles (`anon`, `authenticated`, and `PUBLIC` for functions), now and by default for later objects. The
  Data API answers nothing to a publishable key or a session token; the only way in is the command gateway (D-201),
  which connects as the owner and runs the domain policy (D-003, D-053 … D-060) itself. D-053 … D-060 are not ported to
  SQL.
- **The matrix against the database.** The sample world and `MATRIX` move to `src/domain/testing` (D-135), read by the
  domain's own test and by `src/data/server/policy.dbtest.ts`. The DB test writes the world through the migrated schema
  (its constraints and triggers), loads the policy snapshot through the Postgres store the gateway reads, and checks every
  row with `can`. `rls.dbtest.ts` checks that every table holds RLS, that the API roles hold no privilege, and that each
  of them is refused a read and a write of every table, and that a table created later starts closed.
- **The Data API itself.** `src/data/server/rls.resttest.ts` (`npm run test:rest`, in the CI `db` job after `test:db`)
  asks a real PostgREST, in front of the migrated database, for a read, an insert and a delete of every table, with an
  `anon` token (what a publishable key acts as) and an `authenticated` one; each is refused with `42501`.
  `db-reset` grants the API roles everything by default first, as Supabase does, so the migration's revokes are what
  the tests prove.
- **Advisors.** Supabase's advisors report "RLS enabled, no policy" (INFO) for every table. That is this decision, not a
  finding: an audit leaves it be.
- **Imports.** A layer's `testing/index.ts` may be imported by other layers' test files, `*.dbtest.ts` included, through an
  alias (`@domain/testing`); dependency-cruiser allows only that file and only from tests.
- **Local roles.** `scripts/db-reset.ts` creates `anon` and `authenticated` (no login) when missing, with Supabase's
  default grants, so the migration and the tests run the same locally, in CI and on Supabase.
**Why:** a second copy of the policy in SQL would have to agree with the domain forever, the same reason D-201 runs one
command core on both sides. With every read and write behind the gateway, row policies would only guard a door that is
already shut; revoking the privileges shuts it explicitly, and the tests prove it stays shut.

## D-204 — The remote adapter: one POST per call to the command gateway
2026-11-12 · accepted · refines D-201 · OI-020
- **Shape.** `createRemoteDataAdapter` (`src/data/remote/adapter.ts`) has the local adapter's type: every group and method
  of one exists on the other (a method table the compiler checks, D-076). Each call is one `POST` of
  `{kind, group, method, args}` to `REMOTE.commandsPath` under the backend URL, with the publishable key (`apikey`) and,
  when someone is signed in, `Authorization: Bearer <access token>`. Nothing is decided on the client: the server derives
  the actor from the token and runs every check (D-201).
- **Access token (OI-020).** The adapter takes `accessToken: () => Promise<string | null>` as a dependency, from the auth
  provider's client that `app` creates. `IdentitySource` in `contracts` is unchanged: the token is transport, not identity.
- **Errors.** A 401 answers `unauthenticated`; a 5xx, a network failure, a timeout (`REMOTE.requestTimeoutMs`) or a body
  that is not JSON answers `unavailable`; any other non-OK status, or an answer of the wrong shape (checked with zod),
  answers `internal`. Otherwise the result is the server's own `Result`.
- **Changes.** The answer's `changes` go to the adapter's change feed, which reaches the other tabs too
  (`CHANGE_FEED_CHANNEL`). A change made on another device is not heard until a read runs again (OI-151).
- **Session.** The session is read again when the identity source reports a change.
- **Tests.** The repository contract suite runs over the remote adapter end to end, through the gateway on Postgres
  (`remote.contract.dbtest.ts`, replacing `postgres.contract.dbtest.ts`); `adapter.test.ts` covers what the gateway never
  answers (status codes, wrong shapes, headers).
- **Gateway token check.** The function checks the token itself with the auth server (D-201), so it is deployed with the
  platform's JWT check off: publishable keys are not JWTs.
**Why:** one implementation on both sides (D-201) leaves the client only the transport; keeping the token out of the
contract keeps `IdentitySource` the same for the local and the Google identity.

## D-205 — The inbox's closed section reads a span of dates around today
2026-11-12 · accepted · refines D-120 · OI-065
The pending section reads every pending leave (it empties as leaves are answered). The closed section reads rejected and
cancelled leaves whose dates meet `today - INBOX.closedPastDays` … `today + INBOX.closedFutureDays` (60 days back, a year
ahead) through the repository's date window, and loads until today is known. A closed leave outside the span stays on
the soldier's own list (D-167). No paging: the span bounds the read.
**Why:** the closed list only grows, and on a server every read crosses the network. Old closed requests are history,
not inbox work; a span uses the read the repository already has instead of a new paging contract.

## D-206 — A local export loads into the backend once, through a SQL function
2026-11-12 · accepted · OI-109
- `load_organization_export(payload jsonb) RETURNS uuid` (migration `20261112000000_load_export.sql`) stores an export
  (`transfer.exportOrganization`, format 1) as it is: every row with its audit columns, leave history and account links.
  Only the database owner runs it, from the SQL editor or psql; every privilege on it is revoked from the API roles
  (D-203). It is not a screen and not a path around the commands for users (D-050, D-171).
- It refuses (SQLSTATE 22023) another format version, an export without exactly one organization, a table that is not a
  public base table or is derived (`unit_closure`), a value that is not a list, and a row of another organization; it
  refuses an organization already in the backend with 23505. A refusal writes nothing.
- One statement writes every table (data-modifying CTEs), so the cyclic foreign keys (an organization's baseline role,
  `created_by` soldiers, an owner's rank) are checked once every row is in. Units go parents first, so the triggers
  derive `unit_closure`; no row is updated, so the version guard (D-202) is not involved. Leave events go in their stored
  order; the order trigger moves a tie a millisecond later, as on every server write (the local adapter keeps ties).
- The accepted version is a constant in the function; `load.dbtest.ts` holds it equal to `EXPORT_FORMAT_VERSION` and
  checks that the server exports the loaded organization again, row for row.
**Why:** a script outside the layers cannot reach the adapter's code, and the server must keep stored history as it is,
which the commands cannot (they write new events and audit values). One function runs where the data lands, in one
transaction.

## D-181 — The dark set, and the soldier's choice of appearance
2026-11-12 · accepted · extends D-121, D-173 · V17 · decided under the owner's autonomy instruction of 2026-11-11
- **Choices:** light (the default), dark, or the device's (`Appearance` in `contracts`: `light`, `dark`, `system`).
  "The device's" follows `prefers-color-scheme` live, so a change on the device repaints the open screen.
- **Where it is kept:** `soldier_preferences.preferences` as `appearance`, beside D-121's default and D-173's pins.
  A missing key reads as light, so the table does not change. Web storage is only for the identity (D-086), so
  the choice follows the soldier between devices, and the screens before a soldier is known (sign-in, onboarding)
  stay light.
- **Where it is chosen:** the user menu, in its own single-choice section. Anyone who reaches the workspace may set
  it, whatever their permissions, because it changes nothing but their own screen.
- **The dark set** is a second value for every theme token, under `[data-appearance='dark']` on the root element,
  with `color-scheme: dark`. No component names a color of its own: the glass surfaces, the bar captions on a fill
  (`on-fill`) and the shadows are tokens too. The palette keeps its twelve hues, lifted for a dark surface. Every
  text color reaches 4.5:1 on its surface in both sets; axe checks the board and a drawer in the dark set.
- **Why:** reservists open the board at night, in a vehicle or a tent, where a white screen is the brightest thing
  around. Light stays the default because the board is mostly read in daylight and printed screenshots stay legible.

## D-182 — The installable app: manifest, icons and head, from the theme and i18n
2026-11-12 · accepted · V18 · decided under the owner's autonomy instruction of 2026-11-11
- **Tooling.** `vite-plugin-pwa` 2.0.0 with `@vite-pwa/assets-generator` 2.0.0, pinned (D-037), build-time only. They
  write the manifest, the icons and the head links into the build. Nothing they generate is committed (rule 3).
  `npm audit` reports moderate advisories in `workbox-build`'s `glob`/`minimatch`: they run on the build machine
  over the build's own files, never in the browser.
- **Manifest.** `name` and `short_name` are `app.name` from `i18n`; `lang` `he`, `dir` `rtl`, `display` `standalone`,
  `start_url` and `scope` `/`. `theme_color` and `background_color` are the light set's canvas, read from
  `src/ui/theme/tailwind.css` when the build starts, so the theme stays the only place a color is written.
- **Icons.** One source, `src/ui/theme/app-icon.svg`: the owner's bison emblem (handed over through the orchestrator
  on 2026-11-12) in the brand gradient, on the light set's `surface` in a rounded square. The gradient's stops are
  the theme tokens `brand-light`, `brand` and `brand-deep`; the asset file keeps its raw values, as an SVG must. The
  build makes the 64, 192 and 512 icons, a maskable 512 (the emblem inside the safe zone, padded on `surface`, so a
  round or squircle mask cuts only ground), the 180 Apple touch icon and the favicon. The build fails if the icon
  uses any color other than `surface` and the three brand tokens.
- **Head.** `theme-color`, `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `apple-mobile-web-app-title`
  (`app.name`), and `apple-mobile-web-app-status-bar-style` `default`: the status bar keeps its own strip, so no
  content runs under it, and `viewport-fit=cover` with the bottom bar's `bottom-safe` keeps the home indicator
  clear. In the workspace, `theme-color` follows the soldier's appearance (D-181), so a dark board has a dark bar.
**Why:** reservists open Sagol from the phone's home screen far more than from a bookmark. Reading the name and the
colors from `i18n` and the theme keeps one source for each, and the build check keeps the icon's colors honest.

## D-183 — The service worker caches the app shell only, and a new version waits for the soldier
2026-11-12 · accepted · refines D-201, D-210 · V18 · decided under the owner's autonomy instruction of 2026-11-11
- **What it caches.** Workbox's generated worker precaches the build's own files (scripts, styles, `index.html`,
  fonts, icons), and a navigation inside the scope gets the precached `index.html`. There is no runtime caching at
  all: the command gateway (`REMOTE.commandsPath`) and Supabase Auth (`REMOTE.authPath`) are on the backend's origin
  and always go to the network, and both paths are on the navigation fallback's denylist too. No read and no command
  is ever answered from a cache, so every check of D-201 runs on every request (rule 4).
- **Where it runs.** Production builds only. `app` registers it through `workbox-window` (7.4.1, pinned, the only
  runtime addition) before it reads the env; the dev server and the slice demos run without a worker.
- **A new version.** The new worker installs beside the old one and waits. The open app shows a polite toast,
  "גרסה חדשה זמינה", with "רענון": the worker takes over and the page reloads once it is active. Nothing in the
  workspace reloads by itself, so a form being filled is never lost: when "רענון" in one tab activates the new
  worker, the other tabs show the toast instead of reloading. Before the workspace opens (loading, offline, a failed
  start) there is no form to lose, so a waiting version takes over at once, and a broken deploy never traps an
  installed app on its failure screen. The app asks for an update when it opens and every hour (`PWA.updateCheckMs`).
- **The install offer** is used once: whether the soldier accepts, refuses, or the browser rejects the prompt, the
  menu item goes (D-076).
- **The port.** `logic` reads the worker and the install offer (D-184) through a `shell` port that `app` provides,
  beside `data`, `auth` and `time`, so `ui` never touches the browser's worker API and its tests use a fake.
**Why:** the shell is the same for everyone and changes only on a deploy, so caching it makes the installed app open
at once; the data is per soldier and per permission, and a cached answer would be a bypass. A waiting worker with a
toast is the one update flow that neither serves an old shell forever nor reloads under the soldier's hands.

## D-184 — The install offer in the user menu, and sign-in in the installed app
2026-11-12 · accepted · refines D-207 · V18 · decided under the owner's autonomy instruction of 2026-11-11
- **Where.** The user menu, in its own section above sign-out, and only when there is something to do (D-076):
  - the browser fired `beforeinstallprompt` (Chrome, Edge, Android): "התקנת האפליקציה" shows the browser's own
    install dialog, and the item goes once it was used or the app was installed;
  - iOS outside the installed app, where Safari has no such event: the same item opens a short hint, Share and then
    "Add to Home Screen";
  - otherwise, and always inside the installed app: no item.
- **Sign-in.** Google's OAuth stays a full-page redirect in the same window (D-207), back to the origin, which is the
  manifest's scope. The return is a navigation: the worker answers it with `index.html`, and the code exchange goes
  to Supabase Auth over the network. Nothing in the flow opens a popup or a second window.
**Why:** the menu is where the soldier's own device settings live (D-181), and a menu item that shows only when it can
act is the one install control that is never dead. An iPhone cannot install from a button, so it gets the words.

## D-185 — Offline: the shell opens, a remote build waits for the network
2026-11-12 · accepted · refines D-074 · V18 · decided under the owner's autonomy instruction of 2026-11-11
- **Local mode** keeps its data on the device (D-006) and works offline as it is.
- **A remote build** that starts without a network shows the offline screen, "אין חיבור לרשת", with a retry, in
  place of the generic failure. It also shows when the start fails while the browser is offline. When the network
  returns, the app starts by itself.
- **Inside the workspace** a lost connection stays what it is today: each failed read or command shows its own
  `unavailable` notice. There is no offline queue of commands: a command decided on stale data would skip D-201's
  checks of the moment it is applied (OI-116).
**Why:** a cached shell with no data is a blank board that looks broken; one screen that says why, and recovers
by itself, is honest. Offline writes would need conflict rules the product does not have.

## D-207 — Google sign-in through Supabase Auth, loaded only in production modes
2026-11-12 · accepted · refines D-005, D-204 · supersedes D-086 (unsupported modes) · OI-020 · decided under D-170
- **Client.** `@supabase/auth-js` 2.118.0, pinned (D-037): Supabase's own auth client, with only `tslib` beneath it; the
  full `supabase-js` would bring the Data API, Realtime and Storage clients, which nothing uses (D-203). The data layer
  loads it with a dynamic import, so it is a chunk of its own that a local build never fetches.
- **Contract.** `GoogleAuthProvider.signIn()` answers `AsyncResult<null>`: it only starts the OAuth redirect, and the
  identity arrives through `current()` and `subscribe()` once the browser comes back (approved by the orchestrator for
  the shared contracts). `signOut()` ends the session on this device (`scope: 'local'`).
- **Flow.** PKCE; the redirect returns to the page's own origin. `app` awaits the provider before it mounts, so the
  client has exchanged the code and cleaned the URL before the router reads it. The client keeps its session in
  `localStorage` under its own key and refreshes the token; the remote adapter takes each request's access token from
  the same client (`accessToken`, OI-020). The identity is read from the session's user exactly as the server reads it
  (`identityOfSupabaseUser`): a user that is not a Google identity, or has no email, is signed out.
- **Pairs.** The env accepts two pairs only: `local` auth with the `local` adapter (development, D-006) and `google`
  auth with the `remote` adapter. Any other pair is an env issue (`unpaired`) on the start screen, and the `not_built`
  start failure of D-086 goes: every valid env is built.
- **Screens.** In Google mode the sign-in screen holds one "Sign in with Google" button; the email form, the identity
  list and the menu's identity switcher exist only in local mode, as hooks of the local provider.
**Why:** OAuth is a full-page redirect, so a promise of an identity could never resolve in the page that asked. One
reading of the user on both sides means the client never shows an identity the server would refuse.

## D-208 — The bootstrap claimant is a data dependency: the owner email on the server
2026-11-12 · accepted · refines D-005, D-201
- The adapter core takes a `claimant`, the rule for who may claim an empty organization, besides the verified email
  that D-005 always requires. The server's gateway gets `bootstrapOwnerEmail` and lets only that address claim
  (trimmed, case-insensitive); the function refuses to start without its secret `BOOTSTRAP_OWNER_EMAIL`. The local
  adapter lets any verified identity claim (D-086).
- The same rule answers `bootstrap_available`, so nobody else learns that the organization is empty.
- Tests: the shared contract suite signs in as `CONTRACT_OWNER_EMAIL`, which the server harness names as its owner; the
  server harness also checks that another verified email is refused and that case does not matter.
**Why:** before this the server let any verified Google account claim an empty project, which D-005 forbids. The rule is
the deployment's, so it enters as a dependency and the command code stays one.

## D-209 — Environments, the Vercel deploy and the function bundle
2026-11-12 · accepted · extends D-200 · refines D-201 · OI-150, OI-045
- **Environments.** Development: `.env.development` (local, local), `npm run dev`. Staging: Vercel's Preview
  deployments (every pushed branch). Production: Vercel's Production deployment of `main`. Preview and Production run
  `google` with `remote`; their four `VITE_` values are Vercel environment variables, scoped per environment, and
  `.env.example` lists the names only. A production build refuses local auth (D-006), so a preview cannot run the dev
  mode.
- **Staging backend.** Preview should use a second Supabase project on the free plan (two active projects are free).
  Until one exists, Preview points at the production project: sign-in and every rule are the same there, so a preview
  shows real data only to the people who already see it (OI-152).
- **Vercel.** `vercel.json` sets the framework (Vite), `npm run build`, the `dist` output and one rewrite of every path to
  `index.html` (the router owns paths). Node comes from `engines` (24).
- **The function's origins.** `APP_ORIGINS` (function secret) lists origins, comma-separated; an entry may hold one `*`,
  which stands for one or more of `a-z`, `0-9` and `-` (one DNS label part). That admits Vercel's preview origins
  (`https://sagol-*-<team>.vercel.app`) without admitting any other site.
- **The function bundle (OI-150).** The function imports `src` through `deno.json` aliases, which a deploy that uploads
  only the function's folder cannot follow. `npm run build:function` bundles it with Rolldown (already Vite's) into
  `dist/functions/commands/index.ts`: the layers' code inlined, and every npm package left as the `npm:` specifier
  `deno.json` pins. The bundle is built at deploy time and never committed; CI builds it and runs `deno check` on it.
**Why:** each environment is a Vercel scope with its own values, so no file holds a deployment's identity (rule 2), and
the one function source stays the one the tests run.

## D-210 — Code splitting: the env's adapter pair and libraries in chunks of their own
2026-11-12 · accepted · OI-045
- **Measured.** Before 8.4 the production build was one 1.68 MB script (491 kB gzip): both adapter pairs, Dexie
  included, and every library.
- **Adapter pairs.** `@data` exports the adapters only through `loadLocalData()` and `loadRemoteData()`, each a dynamic
  import; its other exports are types. The composition loads the pair the env names, so a Google build never downloads
  Dexie and a local build never downloads the remote adapter or Supabase's auth client (D-207).
- **Libraries.** `vite.config.ts` puts React, the react-aria family (with `@internationalized`), TanStack, Motion and
  zod in chunks of their own. They change only on an upgrade, so a deploy of the app's code leaves them cached. No chunk
  passes Vite's 500 kB warning (the largest, react-aria, is 400 kB, 121 kB gzip); the warning limit stays as it is.
- **Not now: route-level splitting.** Every screen is one app the user stays in, and the first load of a Google build is
  about 470 kB gzip. Splitting the modules by route is for when a measured first load is slow, not before.
**Why:** a build should download only what its env runs, and the libraries' bytes should outlive a deploy.

## D-186 — Who creates or changes an entity reads its property definitions
2026-11-12 · accepted · refines D-176, D-065 · OI-113 · decided in audit A5+A6 under D-170
- **Reads.** A property definition of an entity type (`soldier`, `unit`, `leave`) is readable by whoever holds
  `properties:view` at `organization`, as before, and also by whoever holds `create` or `update` of that entity's
  resource (`soldiers`, `units`, `leaves`) on any target. Such a reader gets the definitions of that entity type only,
  live and archived alike, so a form shows every required field and keeps archived values as stored (D-176). The
  `properties` module stays for `properties:*` holders only.
- **The check stays.** `propertyValueIssues` still runs on every create and change, for every actor (rule 4): a required
  property is required of whoever creates the entity. What changes is that the form can show it.
- **Why not skip the check.** A required property is the organization's rule about the entity, not about the actor;
  skipping it for whoever cannot read the definitions would let a self-service leave request, or a soldier added by a
  commander without `properties:view`, store an entity the organization declared incomplete.
**Why:** OI-113: a soldier role with `leaves:create` and no `properties:view` (the normal shape of one) was refused with
`property_required` on a field its form could not show. A definition is the organization's form layout, not a person's
data, so reading it reveals nothing D-046 protects.

## D-187 — A preference save that fails says so, and the menu shows the stored row
2026-11-12 · accepted · refines D-181, D-173 · OI-115 · decided in audit A5+A6 under D-170
- The preference setters in `logic` (`togglePin`, `setRulesRow`, `setAppearance`, and the menu's "approve my leaves")
  return the command's `Result` instead of dropping it. A failure invalidates the stored preferences, so the menu, the
  panel and the appearance read the row as stored again.
- The user menu and the navigation panel show a failed save as the app's error message (the `AppError` code's text, as
  every other command does, D-046). `stale_version` reads as "changed on another device"; the soldier chooses again over
  the fresh row. No silent retry: a choice made elsewhere is not overwritten without the soldier seeing it.
**Why:** OI-115: a save refused with `stale_version` left the choice on screen as if it had been saved, and no command
in the app fails without saying so.

## D-188 — Postgres extensions live in the `extensions` schema
2026-11-12 · accepted · refines D-201, D-203 · decided in audit A5+A6 under D-170
- `btree_gist` (the exclusion constraints on date ranges) is created `WITH SCHEMA extensions`, as Supabase recommends,
  in `schema.sql` and its migration; a new migration moves the live one with `ALTER EXTENSION btree_gist SET SCHEMA
  extensions`. The gist operator classes are found by the constraints already built, so no constraint changes.
- Every later extension goes to `extensions` too. The public schema holds the app's own objects only, which D-203's
  revokes cover; extension functions are not the app's and keep the grants their extension gives.
**Why:** Supabase's security advisor reports `extension_in_public` (WARN) for `btree_gist`: in `public`, its 188
functions are executable by `anon` and `authenticated` and sit on the Data API's RPC surface. `supabase_admin` owns
them and granted that, so D-203's revokes, run as `postgres`, cannot take it back. They are harmless operator helpers,
but D-203's rule is that the API roles reach nothing in the app's schema; outside it, the rule holds without them.

## D-189 — Bars rebalance and declutter: a phone tab bar, icons with tooltips
2026-11-12 · accepted · supersedes D-173's bar layout; refines D-108, D-116, D-155, D-173 · decided under the owner's autonomy instruction of 2026-11-11
- **On a phone, three rows.** The top bar holds only the week with its navigation and, at the inline end, the user
  menu as an avatar. Under it a context row holds the scope label, the view switcher and the filter controls in one group,
  followed by the chips while a condition is set (what the filter controls hold is the filter bar's own, V19); it scrolls
  sideways and is always there, so the board starts under it (`under-bars-filtered` on a phone). The bottom bar is a
  tab bar of destinations, each an icon over a short name: the board (current while no panel is open; it closes the
  panel and returns to the week of today), my requests, the inbox with its count, the soldier's pins, and "תפריט",
  which opens the navigation panel and carries the count of what waits there. Every tab is permission-derived as
  before (D-076, D-173); there is no toggle or counter that is not a destination. The organization's name stays the
  page's `h1`, read aloud only on a phone.
- **On desktop, two bars as before** (D-108): the menu button, the name, scope, view and filters on the inline start;
  the week, "today", the destinations and the avatar on the inline end. The destinations, "today", the view switcher,
  "סינון", the presence count and the avatar are icons; the name of each is its accessible name and a tooltip
  (`NameTooltip`, `TOOLTIP` in config: 500 ms in, 200 ms out). "רק מי שחסר" keeps its label, because a switch's
  state needs its words.
- **Every `IconButton` has a tooltip** with its name, on every screen, so an icon is never a guess.
- **Declutter.** The avatar shows no name: the tooltip and the accessible name carry it.
- **The rotation is never on the bars.** Requests (my requests, the inbox) become a destination only while a rotation
  exists, once the rotation model lands (V19); until then they follow the permissions alone.
**Why:** the phone's bottom bar mixed destinations with filters, switches and counters, scrolled sideways, and put the
avatar where a tab bar keeps its last destination. A standard tab bar is what a phone's owner already reads; the
range and the account are global, so they stay at the top. On desktop the labels made the two bars crowd the name
again at 1280 px (OI-110), and icons with tooltips keep them short without losing a name.

## D-190 — A phone on its side keeps the phone's bars, and a wide phone folds the context row into the top
2026-11-12 · accepted · extends D-189 · decided under the owner's autonomy instruction of 2026-11-11
- **The desktop layout needs height too.** `md` (the theme variant) and `useIsDesktop` (`DESKTOP_MEDIA_QUERY`) both
  require at least 768 px of width and 512 px of height (`DESKTOP_MIN_HEIGHT_PX`). A phone on its side is 360–430 px
  tall, so it keeps the phone's structure: the same bars and the same tab bar as upright, never a desktop squeezed
  into a strip.
- **A wide phone folds the context row into the top bar.** From `sm` (640 px, `WIDE_PHONE_MEDIA_QUERY`) the scope,
  view and filter controls sit at the inline start of the top row and the range and the avatar at its inline end;
  the chips row shows only while a condition is set. The board keeps at least half of the screen's height between
  the top bars and the tabs.
- **Nothing clips, wraps or scrolls the page.** A bar's label never takes a second line and the page never scrolls
  sideways; a bar that holds more than fits scrolls inside itself.
**Why:** the owner's phone, turned on its side, got the desktop bars in about 400 px of height, which left no room
for the board and wrapped labels. One structure for both orientations is what a phone's owner expects; folding the
context row is what keeps the room.

## D-191 — Edge to edge: the canvas under the cutouts, what can be pressed inside the safe area
2026-11-12 · accepted · extends D-189 · decided under the owner's autonomy instruction of 2026-11-11
- The viewport is `viewport-fit=cover`, and the workspace's canvas paints every edge, under the notch and the home
  indicator. Bars, the board, the new-leave button, drawers and the navigation panel sit inside a frame padded by the
  safe-area insets, through theme tokens (`--safe-top`, `--safe-bottom`, `--safe-inline`) and the `inset-safe`,
  `frame-safe`, `px-safe` and `top-safe` utilities; no component reads `env()` itself.
- The inline inset is symmetric: the larger of the left and right insets on both sides, because the side of the
  cutout changes as the phone turns, and a logical start or end cannot name it.
- The raw-values check exempts `env(safe-area-inset-left|right)`: it names what the device reports, not a side the
  layout picks.
**Why:** on the owner's phone the bars sat under the notch in landscape, and the canvas stopped short of the edges.

## D-192 — The board's corner and name column are one opaque surface
2026-11-12 · accepted · decided under the owner's autonomy instruction of 2026-11-11
- The timeline's sticky corner and its name column share one opaque `surface` token, and the day header strip is
  flat: no glass, blur, shadow or rounded end where it meets the corner. The days scroll under the column with no
  fade and no seam.
**Why:** the glass header showed the days through the corner as they scrolled, which read as a fade over the names.
## D-211 — The range picker: day, week, month or a whole rotation
2026-11-12 · accepted · refines D-103 · V19 · decided under D-170
- **URL.** `range` holds the kind (`day`, `week`, `month`, `rotation`); absent means a week (`DEFAULT_RANGE_KIND`).
  `from` is the anchor: the window is the day, the week or the month that holds it. Without `from`, a day, week or
  month holds today and follows the clock (D-107). `rotation` holds the rotation's id with `range=rotation`.
- **Older links.** A `from`..`to` pair with no `range` is still a free window (`custom`), as D-103 had it. A one-sided,
  inverted or too long pair is the week of its anchor, so a link never breaks the workspace.
- **Cap and density.** A window holds at most `DATE_WINDOW.maxDays` = 186 days (about six months). A longer rotation,
  or one with no end yet, shows its first 186 days. The timeline's least day width depends on the length:
  `TIMELINE_DENSITY` bands of 64 px up to a week, 32 px up to a month, 24 px beyond; the weekday name hides below 44 px,
  the date stays. Every engine reads the same window, so every engine honors the range.
- **Navigation.** The arrows step by the kind: a day, a week or a month; a rotation steps to the scope's previous or next
  rotation, and an arrow with nowhere to go is disabled. "Today" keeps the kind on today; from a rotation it opens the
  rotation running today, else this week (also when the rotation shown runs today past its capped days). Changing the
  kind keeps the window's middle day, so a week across two months becomes the month most of it lies in. It shows only while the window does not hold today (D-076). An unknown or
  unreadable rotation falls back to the week, so a link never breaks.
- **Picker.** The window label opens a menu: the kinds, then the scope's rotations (the selected unit's, its ancestors'
  and descendants'; all of them for the whole organization) that are running or still to come, with their dates. With
  none, it offers "סבב חדש" only to whoever may create a deployment in a live unit, opening the deployment form; to
  anyone else the section is absent (D-076). Nothing persists: it is URL state, so D-082 has nothing to port.
**Why:** the owner plans by rotations and months as well as weeks. 186 days covers the longest rotation the owner
described with room, and keeps the timeline's rows a size the browser lays out quickly; the density bands keep a
month and a rotation on screen without a horizontal scroll that hides the point of the range.

## D-212 — "סבב" in the interface; `deployment` in code
2026-11-12 · accepted · refines D-179 · V19 · decided under D-170
- Every Hebrew string that said פריסה / פריסות says סבב / סבבים. Code, contracts, the schema and the URL keep
  `deployment`; only `i18n` changes.
- The setup wizard gains a "first rotation" step (`SETUP_STEPS`), shown by `deployments:create` and done once a live
  deployment exists (D-180).
**Why:** סבב is the word the units use. Renaming the model would touch the schema, the backend and every layer for a
word only the screen shows.

## D-213 — "Only who is missing" is a filter condition
2026-11-12 · accepted · refines D-133, D-173 · V19 · decided under D-170
- The bar's switch is gone. "Only who is missing" is one of the conditions in the filter control's dialog; on, it
  shows as a chip in the filter row like any condition, and the chip's remove and "clear all" turn it off. Off, nothing
  shows (D-173). The search param stays `missing`, and D-133's meaning is unchanged.
**Why:** a switch that is always in the bar is clutter for a choice most screens do not make; as a condition it sits
where the other narrowing choices are and is seen only while it acts.

## D-214 — The board's sort
2026-11-12 · accepted · refines D-105, D-174 · V19 · decided under D-170
- **Keys.** Name, command rank, seniority (effective, with overrides, D-179), unit and days absent in the window
  (approved `unavailable` leave, D-133's meaning). Ascending or descending. In the URL as `sort` and `order`; the default,
  seniority descending, writes neither.
- **Order.** Rows stay grouped by unit (D-105). The unit key orders the groups by the unit tree, reversed when
  descending, and inside a group keeps the default. Other keys order the rows inside each group. A row with no value
  (no rank) comes last either way; the name breaks ties.
- **The table** shares the state: its soldier column is `name` and its unit column `unit`, both in the board's own row order, and its own
  leave columns (`type`, `from`, `to`, `days`, `status`) write the same params. A board key with no table column keeps
  the board's order. A control in the bar ("מיון"), next to the filter, holds both lists.
**Why:** commanders look for the most senior, the most absent or a name; grouping stays because the unit is the
board's frame. One state for the board and the table means a link reopens the same order in either.

## D-215 — Data and controls, not prose
2026-11-12 · accepted · refines D-076 · V19 · decided under D-170
- A screen shows data and the controls that act on it. Explanatory hints are removed; the presence and seniority hints
  stay because they say what a number means.
- An empty state is a title and its action. A body shows only when there is no action, to say why.
- An icon-only button carries an accessible name and a tooltip with the same words. Touch targets stay 44 px; axe
  stays clean. An i18n key no screen uses is deleted.
**Why:** the owner asked for a calmer screen. Hints repeated what the controls already say, and on a phone they pushed
the data below the fold.

## D-193 — The day report (דוח 1): who is present, absent, leaving and returning
2026-11-12 · accepted · supersedes D-134 in part (the panel) · V22 · decided under the owner's autonomy instruction of 2026-11-11
- **What it is.** D-134's present and absent lists grow into the day report, and its drawer panel gives way to a
  centered dialog over the board. The URL keeps `panel=presence` and `day`; a span adds `until`, the last day. The
  presence button opens it on today, as before.
- **Entry.** In the engines that show days, a day's header (the timeline's day column, the calendar's day cell) is a
  button that opens that day's report; keyboard and screen readers reach it by its whole date. The table and the list
  show no days, so they reach it through the presence button. Arrows in the dialog step a day back or forward.
- **Population.** As D-134: who the board's soldier filter selects on the day, among the soldiers whose leaves the
  viewer may read (D-161). Approved leaves only (D-133). The model has no planned strength, so the report shows none
  (D-076): the total is the population.
- **Categories.** Present and absent partition the population (D-032, D-070). Leaving and returning are part of absent
  and read the absence, not the leaves: a soldier **leaves** on a day they are absent and were present the day before,
  and **returns** on a day they are absent and are present the day after (`end_date` is inclusive, so the last day
  away is the return day). A one-day absence both leaves and returns. Back-to-back or overlapping leaves count one
  departure and one return. A marker, a pending, rejected or cancelled leave, or an override to available never moves
  anyone (`dayMovements` in `domain`).
- **Breakdown.** The counts first (present, absent, leaving, returning, out of the total), then one section per unit in
  the tree order of the board (D-105), each with its own counts and collapsible name lists.
- **Rotations (D-211).** The dialog names the scope's rotations that run on the day. When the scope has rotations, a
  day none of them runs on is not reportable: its header is not a button, and the arrows skip past it. A scope with no
  rotation reports every day, so a unit that does not plan by rotations still has the report.
- **Span.** "כמה ימים" opens a "עד יום" date field: the report runs from the day to that last day, its reportable
  days only, at most `DAY_REPORT.maxSpanDays` calendar days. A last day on or before the day is ignored; "יום אחד"
  returns to one day. Each day is its own section, in order, under its own date.
**Why:** the owner's "דוח 1": the morning question of a command post is who is here, who is out, who leaves and who is
back today. The presence panel already answered half of it; one place is calmer than two (D-215). Reading the
absence rather than the leaves means a soldier who swaps one leave for another the next day is not reported as coming
back and leaving again.

## D-194 — Reasons in the day report: off by default, remembered per device, only what the viewer may read
2026-11-12 · accepted · refines D-193 · V22 · decided under the owner's autonomy instruction of 2026-11-11
- A switch "סיבות" shows, beside each absent soldier, the type of the leave that makes them absent and its reason text.
- Off by default. The choice is a convenience of the device, kept per signed-in soldier in the device store (D-197),
  never in `soldier_preferences`: a commander who shows reasons on their own phone does not show them on the screen of
  the command post.
- The switch shows only when the viewer may read a reason for someone in the report: a leave type readable to the
  viewer or a reason text on a leave they read. It reads what the viewer already may read, through the same
  checks; nothing is fetched or shown that the leave's own sheet would not show them (no bypass). With nothing to
  show, the switch is absent (D-076).
- The text copy and the image carry the reasons only while the switch is on.
**Why:** reasons are personal and the report is often shown or sent to others, so the safe default is off, and the
choice belongs to the screen it is made on.

## D-195 — The day report as text for a messaging app
2026-11-12 · accepted · refines D-193 · V22 · decided under the owner's autonomy instruction of 2026-11-11
- "העתקה" copies plain text and a toast confirms it. Its order: a `*bold*` header with the date and the scope, the
  counts, then one section per unit with a `*bold*` name and one line per soldier under absent, leaving and returning.
  A span has one such block per day. Present names are left out: the counts carry them, and the message stays short.
- RTL-safe: every line starts with a right-to-left mark, so a line that starts with a number or a Latin name stays
  aligned. No other markup.
- The order of the parts lives in `config` (`DAY_REPORT.text.sections`), the words in `i18n`, and the text is built in
  `logic`. Sending inside Sagol or to an app is not built (D-076).
**Why:** the report's daily use is a message to a group. `*bold*` is what WhatsApp and Telegram render; anything more
shows as noise elsewhere.

## D-196 — The day report as an image: drawn on a canvas in the light tokens
2026-11-12 · accepted · refines D-193 · V22 · decided under the owner's autonomy instruction of 2026-11-11
- "תמונה" makes a PNG of the report: the same lines as the text copy (D-195), the reasons only while on, drawn with the canvas API from the report itself. No library: an HTML-to-image library rasterizes
  the DOM through SVG `foreignObject`, which loses web fonts and backdrop blur on Safari, and adds a dependency for
  one screen.
- The image always uses the light tokens, whatever the theme: it is read in a chat, on someone else's screen.
- A span is one tall image, one section per day: one file to send.
- Where the browser can share a file (`navigator.canShare({ files })`), the button opens the share sheet; elsewhere
  it downloads the file. Only the path that works is offered.
**Why:** the image is for a group chat where text formatting is lost; a canvas drawing is the same on every browser
and is tested by its pixels and size.

## D-197 — A device store for conveniences
2026-11-12 · accepted · refines D-021, D-074 · V22 · decided under the owner's autonomy instruction of 2026-11-11
- A `DeviceStore` port in `logic`, implemented by `data` over `localStorage` (and `sessionStorage` for what lasts the
  session), under keys in `config` (`DEVICE_KEYS`), scoped to the signed-in soldier. It holds conveniences of one
  screen only: never data, never a permission, never what another device needs. A value that does not read back as
  its type reads as the default.
- `scripts/guardrails.config.ts` allows web storage in `src/data/device/` beside the local identity.
**Why:** D-194 and focus mode (V23) remember a choice per device. Rows in `soldier_preferences` follow the soldier to
every device, which is wrong for these.

## D-216 — Every request belongs to a rotation
2026-11-12 · accepted · refines D-012, D-179 · V19 · decided under D-170
- **Model.** `leaves.deployment_id` (NOT NULL, FK to `deployments`). The leave's soldier is a member of that deployment
  (`deployment_members`), and its dates fall within the member's dates; a NULL member side means the deployment's own,
  and a deployment with no end bounds nothing at the end.
- **Commands.** `createLeave` names the rotation; `createLeaveBatch` names one rotation for all its leaves; a copy of
  `duplicateLeave` stays in the source's rotation. The rotation is live (`reference_archived` otherwise), the soldier is
  its member (`not_a_member`) and the dates fit (`outside_rotation`). `updateLeave` never moves a leave to another
  rotation; new dates must still fit. Changing a member's dates, removing a member or changing a rotation's dates is
  refused with `leaves_outside_rotation` when it would strand a live request (pending or approved); cancelled and
  rejected requests do not hold a rotation in place.
- **Server.** The gateway runs the same checks (D-201). Constraint triggers, deferred to commit, re-check every live
  leave of a changed pair (`20261112000200_leave_deployment.sql`), so a write that skipped the commands fails as
  `internal`. RLS is unchanged: a leave is read and written as before, by its soldier's unit (D-082).
- **Migration.** Non-destructive and applied by the orchestrator: the column is added, filled where exactly one live
  rotation fits, and set NOT NULL. A leave no rotation fits stops the migration, which rolls back; the file holds the
  query that counts them first.
- **Export.** `EXPORT_FORMAT_VERSION` 2: leaves carry `deployment_id`. The loader accepts 2 only.
**Why:** the owner runs the unit by rotations: a request outside a rotation has no commander to answer it and no board
to show on. The database guarantees it because the dates and the membership change in other commands than the leave's.

## D-217 — The workspace is scoped to the active or upcoming rotation, silently
2026-11-12 · accepted · refines D-211, D-103 · V19 · decided under D-170
- **Default.** With no range in the URL, the workspace opens on the rotation in scope (D-211's scope) that runs today,
  else the next one to start; its window is the whole rotation (`rotation` kind). The day, week and month kinds work
  inside it as before.
- **No control, no label.** The bars gain no rotation control, and no label names the rotation: the dates say it.
  Past and upcoming rotations are reached only from the range picker's "whole rotation" choice; with more than one
  rotation in scope it opens a short list of them, by start.
- **Editing** rotations stays in the navigation panel's deployments module and in the empty state (D-218).
- **Helpers** for other slices: `rotationOn(rotations, date)` says which rotation holds a date, and `scopeRotation`
  picks the active or upcoming one; both in `logic/view-state`, with the window model they feed.
**Why:** the owner asked for a workspace that is about the rotation without spending bar space on it. The range picker
already holds rotations, so it is the one place to switch.

## D-218 — No request surface without a rotation in scope; one empty state
2026-11-12 · accepted · refines D-076, D-215 · V19 · decided under D-170
- With no rotation running or to come in scope, the request surfaces do not exist (D-076): the inbox, "my requests",
  the new-request button and the request filters. Permanent modules (soldiers, units, settings and the rest) stay.
- A soldier sees the request surfaces only for rotations they are a member of; a manager sees them for the rotations in
  their scope.
- The viewport shows one empty state, "אין סבב פעיל". Whoever may create a deployment gets "פתיחת סבב", which opens the
  deployment form; anyone else gets one line saying their commander opens it. Before any unit exists, whoever may
  found the tree gets "הגדרת מבנה היחידות" instead, since a rotation belongs to a unit.
**Why:** a request needs a rotation (D-216); a button that cannot lead anywhere is a dead control.

## D-219 — The setup wizard ends by opening the first rotation
2026-11-12 · accepted · refines D-180, D-212 · V19 · decided under D-170
- The "first rotation" step is the wizard's last. It asks for the dates and the unit, and its members default to all
  of the unit's soldiers (the unit and its sub-units, placed on the start date); the form's member list can narrow it.
- Done once a live deployment exists, as before.
**Why:** after D-216 nothing can be requested before a rotation exists, so the wizard leaves the organization ready to
work.

## D-220 — Rotation membership in practice: references, reads and the form
2026-11-12 · accepted · refines D-216, D-217, D-218, D-219 · V19 · decided under D-170
- **References.** A leave names a rotation of its own organization. An archived rotation keeps its leaves and takes no
  new ones; a transition back to a live status (pending or approved) checks the rotation, membership and dates again.
- **Reads.** A soldier reads the rotations they serve in and their own membership rows (server rules), so the form and
  the request surfaces work without `deployments` view. The server's helper functions are revoked from `public` and
  granted only where a policy needs them.
- **The form picks the rotation.** The new-request and collective forms offer the rotations in scope that hold the
  chosen soldier on the chosen dates, preselect the one in view, and send its id; the logic layer never guesses it.
- **Request surfaces count a rotation** only when one of its members is visible to the actor (D-218).
- **URL.** A bare URL opens on the rotation (D-217); an explicit kind (day, week, month) is written to the URL so a
  shared link keeps it. With no rotation, the dates, the view switcher and the filter controls are hidden with the board.
- **Range menu.** "Whole rotation" is a single item with one rotation in scope and a list, by start, with more.
  D-211's "סבב חדש" item goes: with no rotation the picker itself is hidden, and the empty state opens one.
- **Members.** A new rotation's members default to its unit (D-219) only while it has no stored members; once saved,
  the editor shows what is stored. Creating a rotation opens its members editor at once.
**Why:** these are the edges D-216..D-219 left open; each one follows the rule that a request belongs to a rotation its
soldier serves in, without a second place that decides it.

## D-250 — Two vocabularies: everyday words, and the words of managing a unit
2026-11-12 · accepted · refines D-212, D-215 · V24 · decided under the owner's autonomy instruction of 2026-11-11
- **Everyday words** are the only domain words on the board, the bars, the requests hub, the day report and the
  profile: יחידה, חייל, סבב, בקשה (the act of asking), היעדרות (a soldier's absence, as the board shows it) and דוח 1.
  A soldier who never manages anything meets no other domain word.
- **Management words** show only inside "ניהול יחידה" (D-254). Every module there carries one plain line under its
  name that says what it is for, and that line is data-screen text, not a hint (D-215 allows it the way it allows
  presence and seniority).
- **The term map** in `docs/Design.md` ("Simplification: information architecture") is the source for every rename:
  each current term is kept, renamed, hidden or merged there, and V25 applies it in `i18n` only. Code, contracts, the
  schema and URL keys keep their English names (as D-212 did for `deployment`).
- **Fixed choices of the map:** חופשה leaves the interface (a leave is an היעדרות, its kind a סוג היעדרות);
  תפקיד (a role) → רמת הרשאה; דרגה (a command rank) → דרג פיקודי; דרג (a unit level) → סוג יחידה; מאפיינים
  (properties) → פרטים נוספים; בכירות → ותק; a tag category stays קטגוריה, and קבוצה names only a group of absence
  types, inside that module; a link request is a בקשת הצטרפות, so בקשה alone always means an absence asked for;
  סטטוס is a leave's state and מצב a mode of the screen (שגרה, סבב, מיקוד).
**Why:** the owner counted thirteen domain words on the main screens, several with two or four meanings. Two
vocabularies keep the daily screens to six words, and a word that stays has one meaning.

## D-251 — "ארגון" never shows; the user manages "היחידה שלי", the root unit
2026-11-12 · accepted · refines D-005, D-104, D-175, D-180 · V24 · decided under the owner's autonomy instruction of 2026-11-11
- No string on any screen says ארגון. Where the interface meant the organization it names the root unit: the scope's
  "whole organization" choice reads the root unit's name, a rule's global target reads "כל היחידה", the setup is
  "הקמת היחידה", and errors and empty states say יחידה.
- **One root unit per organization.** The claim (D-005) creates the organization and its root unit together, with the
  same name from one field; a unit is created under a parent from then on, so the unit form has no "no parent" choice.
  `organizations.name` stays the tenant's label in code and in the schema, and the screen never reads it; renaming the
  root unit is how the user renames "the unit". V27 builds the claim's root unit; an organization that already has
  several roots keeps them, and the scope picker shows them as before.
- **The organization stays the tenant** in code, contracts, the schema, RLS and the backend (D-011). Linking several
  organizations under one command is future infrastructure, with no decision yet and nothing on screen (D-076).
**Why:** users run one unit and never chose an "organization"; two names for the same root made every screen ask
which one they meant. Keeping the tenant in the model costs nothing and leaves room for linked units later.

## D-252 — One navigation model: a context strip at the top, a destination strip at the bottom
2026-11-12 · accepted · supersedes D-189's bars and D-190's folded top row; refines D-108, D-116, D-155, D-173, D-191 · V24 · decided under the owner's autonomy instruction of 2026-11-11
- **Two floating pills, the same on every screen size and orientation.** Each is a `glass-bar` pill that hugs its
  content and centers on its edge, inside the safe area, never full width; a phone on its side shows the same two.
  The strips scroll sideways inside themselves only when their content cannot fit, and the page never does.
- **The top strip is context, never a destination:** the unit in scope, the time (the current rotation's name or
  "שגרה", then the range and its arrows, D-211), the view, the filter and the sort, and the avatar at its inline end.
  The chips row stays under it while a condition is set (D-213).
- **The bottom strip holds the daily destinations,** each an icon over its short name: לוח, בקשות (with the count
  of what waits for the viewer's approval) and, once V22 lands, דוח 1 (today's report, D-193); then "ניהול" for whoever
  may manage anything (D-254). A destination shows only when the viewer may use it; a soldier with no management
  permission sees לוח and בקשות.
- **One primary quick action per role sits in the bottom strip,** at its inline end, set apart from the destinations
  as a filled round button with its name read aloud (on desktop a tooltip as well): "בקשה חדשה" for whoever may
  request, in a rotation's mode; "פתיחת סבב" in routine for whoever may create a rotation (D-257). A viewer with
  neither has no quick action (D-076): a soldier in routine gets no "פתיחת סבב". The action is chosen per role first and
  per mode second; which role gets which action in each mode (a routine-mode request too, if routine absences come)
  is settled by the per-role journeys matrix (D-263, pending). It is an action, not a destination: it opens the form
  over the current screen.
- **Focus mode (V23) hides both strips and the chips row** and leaves one restore button; nothing else on the board
  floats, so the strips are the whole chrome V23 has to hide.
- The page's `h1` is the root unit's name in scope (D-175), read aloud only.
**Why:** the phone had a full-width top bar, a context row and a full-width tab bar, and the desktop two different
pills; the owner could not tell where a thing lives. One model on every screen means one thing to learn, and pills
that hug their content leave the board visible at both edges.

## D-253 — The profile is personal only
2026-11-12 · accepted · supersedes D-121's place of the "approve now" default; refines D-173 (the "תצוגה" section), D-181, D-184 · V24 · decided under the owner's autonomy instruction of 2026-11-11
- The avatar's menu holds what is about the person and this device: the name, appearance (light or dark, D-181; where
  the rules row sits, from the navigation panel's "תצוגה", D-173), install (D-184), the identity switch in a local
  build, and sign-out. Nothing about the unit or its work is there.
- The "approve now" default moves to the requests hub (D-255); its stored row (`soldier_preferences`) is unchanged.
**Why:** the owner looked for the approval preference among the requests and found it in the profile. A menu of
the person's own settings is easy to predict when it holds nothing else.

## D-254 — One entry for managing the unit: "ניהול יחידה"
2026-11-12 · accepted · supersedes D-173's pins and the navigation panel's sections; refines D-178, D-180 · V24 · decided under the owner's autonomy instruction of 2026-11-11
- "ניהול" in the bottom strip opens the panel "ניהול יחידה" (the navigation panel, renamed and regrouped). Its groups
  and modules, each with its name and its one plain line (D-250):
  - **היחידה:** מבנה היחידה (units, with סוגי יחידה as its section), חיילים (with דרג פיקודי as its section), סבבים.
  - **נוכחות:** סוגי היעדרות (with their groups), כללי נוכחות.
  - **פרטי חיילים:** תגיות (with קטגוריות), פרטים נוספים.
  - **הרשאות:** רמות הרשאה (with "לפי דרג פיקודי"), הרשאות אישיות, בקשות הצטרפות.
  - **נתונים:** ייבוא וייצוא.
  - "הקמת היחידה" sits above the groups while the setup is not done (D-262), and leaves once it is.
- **Pins are removed.** A module is one press away inside the panel, and a pin was a second place for the same thing.
  The stored pin preference is no longer read; V25 removes it with its control.
- The deep links (`panel`, `entity`) and the waiting counts are unchanged; the "ניהול" destination carries the sum of
  the counts, as the menu button did.
**Why:** the owner found management split between a grouped hamburger, pins on the bar and buttons on the empty board.
One entry, grouped by what the commander is doing, with a line that says what each module is for, replaces all three.

## D-255 — One requests hub: mine, awaiting me, and a new request
2026-11-12 · accepted · supersedes D-115's floating "+", D-167's own tab and D-120's separate destination; refines D-119, D-121, D-145 · V24 · decided under the owner's autonomy instruction of 2026-11-11
- **"בקשות"** is one destination. Its sheet holds, for whoever may approve someone, "ממתינות לאישורי" with its count
  first, then "הבקשות שלי" (D-167's open and history),
  then the closed requests the viewer approved or rejected (D-120's closed section). A soldier who approves no one
  sees "הבקשות שלי" only.
- **"בקשה חדשה" is the bottom strip's primary quick action (D-252),** not a button inside the hub and not a separate
  floating button: the main journey keeps one press to start a request from any screen.
- **The approve-now default** (D-121) is a switch in the hub's header, "לאשר מיד בקשות שאני יוצר", shown only to who
  may approve their own requests; the form's switch still starts from it.
- **Removed:** the floating "+" as a separate button (its action moves into the strip) and the second requests tab.
  A drag on the timeline still creates a request (D-143), because it is the board's own gesture, not another entry.
- The panel keys (`my_leaves`, `leave_inbox`, `leaves`) stay as the hub's sections, so old links still land.
**Why:** a request could start from three places and be followed from two, and its preference lived in a third. One
hub holds the whole life of a request for both sides.

## D-256 — One path for each action
2026-11-12 · accepted · refines D-173, D-180, D-189, D-211, D-252 · V24 · decided under the owner's autonomy instruction of 2026-11-11
- **The rule: one entry per destination, plus one primary quick action per role (D-252).** Shortcuts are not banned;
  a second entry to the same destination is.
- The empty board shows one action: "הקמת היחידה" for who may, otherwise its title alone; the second "soldiers"
  button goes.
- A rotation is created in "ניהול יחידה → סבבים", and, in routine mode, from the strip's quick action "פתיחת סבב"
  (D-252, D-257), which opens the same form; the routine notice names the mode and holds no button of its own, and the
  range menu lists rotations to view and offers no "סבב חדש".
- "היום" is the range's own control; the לוח destination returns to the board and does not move the dates.
- The presence count in the bar goes; דוח 1 is the destination, and a day's heading still opens that day (D-193).
- The setup's steps open the modules themselves, not copies of their forms (D-180 as before).
**Why:** each duplicate made the owner ask whether the two did the same thing. An action that lives in one place
is found once and trusted.

## D-257 — A rotation is a mode of the system: one at a time, and routine without one
2026-11-12 · accepted · refines D-179, D-189, D-211, D-212 · V24 · decided under the owner's autonomy instruction of 2026-11-11
- **One rotation at a time per organization, by dates.** No two live (not archived) deployments of an organization
  overlap in dates. The rule is about dates, not about being open: an ended rotation that is not closed yet may stand
  beside a future one. V26 enforces it in the database with an exclusion constraint over `organization_id` and the date range (an
  open end is unbounded), with `btree_gist` from `extensions` (D-188), and in the domain with the same rule and its
  own error, so the form says it before the command fails.
- **The mode is derived from today and the rotations:** the rotation whose dates hold today, else the nearest
  upcoming one, else the most recently ended one that is still open (not closed, D-258), else routine (שגרה). Nothing
  stores the mode.
- **Routine is a real mode, not an empty state.** Every feature declares its context: rotation, routine or both
  (the slice cards in `FEATURE_MAP.md` carry it). Routine's own features come in later slices and join the same strips
  as their destinations and its quick action; nothing in the strips assumes a rotation exists.
- **In a rotation's mode** the range opens on that rotation (D-211), the top strip names it, the requests hub and
  דוח 1 are destinations, and a new request's dates default inside it.
- **In routine** the board shows the roster with the persistent tags and a routine notice; for who may create a
  rotation the strip's quick action is "פתיחת סבב" (D-252). The requests hub and דוח 1 are not destinations (D-189's rule, now with the
  model behind it); existing leaves stay valid data and stay on the board.
- A rotation keeps its `unit_id`; the form defaults it to the root unit (D-251).
**Why:** a reserve unit lives from call-up to call-up; between them there is nothing to request or report. One
rotation at a time makes "the current rotation" a fact the whole screen can lean on, and a derived mode cannot go
stale.

## D-258 — A rotation's life: dates, plus one stored fact for its close
2026-11-12 · accepted · refines D-019, D-179 · V24 · decided under the owner's autonomy instruction of 2026-11-11
- **Stages, derived:** upcoming (before `start_date`), running (from `start_date` to `end_date`, or open-ended), ended
  (after `end_date`, not closed) and closed.
- **A rotation never closes on its end date.** Work after the last day is normal (requests to settle, the report), so
  it stays open until it is closed explicitly.
- **The one stored fact is the close:** `deployments.closed_at TIMESTAMPTZ NULL` with `closed_by`, set by an explicit
  "סגירת סבב" command (V26) that only the rotation's creator (`created_by`) or whoever holds the permission to manage
  rotations may run. Closing needs an end date on or before today; a rotation without one gets today's date in the
  same command.
- **Closing is not deletion.** A closed rotation stays readable, with its dates, members, rotation tags and leaves as
  its history, and none of them change while it is closed. **"פתיחה מחדש"** (the same actors) clears `closed_at` and
  `closed_by`, so an extension is an ordinary edit of the dates; the no-overlap rule (D-257) still holds.
- **"סבב חדש מסבב קודם":** a new rotation may start from a previous one. It copies, as ordinary commands, the member
  list when the previous one had a list (D-259) and its rotation tags (posts and duties, D-260) to the new rotation;
  the dates and the name are new. Nothing links the two after the copy.
- Nothing else is stored: not "active", not "ended", not the mode (D-019).
**Why:** the end of a rotation in the calendar is not the end of its work: commanders settle requests and the report
after the last day, and extensions happen. Only the moment they say "done" is a fact the dates cannot give, and it must
be reversible. Amended on 2026-11-12 with the owner's lifecycle (explicit close, reopen, a new rotation from a previous
one).

## D-259 — Who is in a rotation: the whole unit by default, a list when chosen
2026-11-12 · accepted · refines D-179 · V24 · decided under the owner's autonomy instruction of 2026-11-11
- A rotation with no `deployment_members` rows holds every soldier of its unit for its days, derived from the unit's
  memberships; nothing is copied.
- Member rows make it an explicit list, as D-179 built. The first use is "command staff first": a rotation opens with
  a list of the command ranks the commander picks, and turning it to "the whole unit" removes the rows. The form shows
  the choice as "כל היחידה" or "רשימה", with the list's editor only for the second.
- A member's own dates still narrow the rotation's (D-179).
**Why:** in a call-up the whole unit comes; asking the commander to tick every name repeats what the unit already
says, and a stored copy would drift when the unit changes.

## D-260 — Tags have two lifetimes: persistent, or for one rotation
2026-11-12 · accepted · refines D-015, D-130 · V24 · decided under the owner's autonomy instruction of 2026-11-11
- **The lifetime belongs to the assignment, not the category:** the same tag can be persistent for one soldier and
  for one rotation for another. "מ\"כ" is persistent for the squad's leader and this rotation only for a soldier filling
  in; "מפעיל רחפן" is a qualification for one soldier and this rotation's assignment for another.
- **A rotation tag is held for one rotation:** `soldier_tags.deployment_id UUID NULL REFERENCES deployments`, allowed
  for every category: NULL is persistent, set is that rotation only. The key becomes an `id`, with at most one row per
  soldier and tag where `deployment_id` is NULL and one per soldier, tag and rotation where it is set.
- **The category keeps a default only:** `tag_categories.default_lifetime` (`persistent` or `rotation`) pre-selects the
  choice when a tag is assigned; it never constrains a row, and changing it changes no existing row.
- The board and the filters read persistent tags and the current rotation's tags; a closed rotation's tags stay as its
  history and are read only inside it. Nothing copies tags silently: a rotation started "מסבב קודם" copies them once
  (D-258), and the soldier's card offers "כמו בסבב הקודם" as one command that adds the same rows for one soldier.
- V26 makes the change in `schema.sql`, `DECISIONS.md` and `contracts` together, first in the slice (rule 5).
**Why:** a driver is a driver in every rotation, and the kitchen duty of this rotation is not; but whether a tag lasts
depends on who holds it and why, so the row says it. The category's default keeps the common case one tap, and the
rotation reference makes "this rotation's tags" a query.

## D-261 — Templates: a starter unit in config, names in i18n, applied through the commands
2026-11-12 · accepted · refines D-022, D-033 · V24 · decided under the owner's autonomy instruction of 2026-11-11
- A template is structure in `config` (ids and relations only) with every name in `i18n`. The first and only one in
  V27 is **"פלוגה"**: the company as the root unit with מפל"ג and three platoons of three squads; unit types (פלוגה,
  מחלקה, כיתה); command levels (מ"פ, סמ"פ, מ"מ, סמל, מ"כ, לוחם) bound to permission levels; qualification tags
  (persistent by default) with colors; absence types in their groups; and rule defaults sized to a company.
- **Applying a template is a sequence of the ordinary commands** the actor may run, through the same validation and
  permission checks (rule 4); there is no import path or bulk insert for it. A failure stops at the step that failed
  and says which, and what was created stays and shows in the setup.
- A template is not data and is never stored: once applied, the unit is ordinary rows the commander can change.
**Why:** an empty form for every module is thirty clicks before the first request. A starter that the commander adjusts
is faster and teaches the shape of the unit, and running it through the commands keeps every guarantee.

## D-262 — The setup: pick, adjust, done
2026-11-12 · accepted · refines D-033, D-180 · V24 · decided under the owner's autonomy instruction of 2026-11-11
- **The claim** asks for the unit's name and the commander's name; the time zone is the device's, shown and changeable
  in the same form. It creates the organization, its root unit (D-251), the owner and the owner's access.
- **Then three steps in one sheet:** pick a template ("פלוגה", or "ריקה"); adjust it (the number of platoons and
  squads, their names, which absence types and tags to keep, all as ready choices with the template's values filled
  in); done, which applies it (D-261) and lands on the board in routine mode with "פתיחת סבב" (D-257).
- The checklist of D-180 stays as the unfinished-setup view inside "ניהול יחידה" for who skipped a step; a step is done
  when its data exists, as before.
**Why:** the owner found the setup long and empty. Ready choices let a commander finish in a minute and change
anything later in the modules where it lives.

## D-263 — Five journeys are the acceptance tests of V25, V26 and V27
2026-11-12 · accepted · refines D-154 · V24 · decided under the owner's autonomy instruction of 2026-11-11
- **Pending:** the journeys are being characterized per role (soldier, mid-level commander, company headquarters and
  clerk, company commander) and per tier (daily, weekly, per rotation, once) with the owner. The agreed matrix will
  replace the draft below and decide the home screen per role; until then the draft stands.
- `docs/Design.md` writes five journeys step by step: the first sign-in to a running unit, a rotation from call-up to
  its close, a soldier's request, a commander's approval, and the daily report. Each slice that touches one makes its
  e2e walk the journey's steps as written, and updates the steps in the same commit when it changes them.
**Why:** the owner judged the product by its journeys, not its modules. A journey written as steps is a test the next
slices can fail.

## D-264 — Order of the simplification slices
2026-11-12 · accepted · refines D-154 · V24 · decided under the owner's autonomy instruction of 2026-11-11
- Track A: V24 (this map) → V22 (the daily report, its entry fitted to D-252) → V25 (navigation and words) → V23 (focus
  mode, on V25's strips). Track B: V26 (rotation as a mode, the schema change) → V27 (templates and setup) → V21 after V27.
- V25 changes `i18n`, `config` and `ui` only; V26 owns every schema and contract change of D-257 to D-260; V27 owns
  D-251's claim change and D-261, D-262.
**Why:** words and bars do not wait for the model, and the model must land before templates that create rotations
and tags. Splitting by layer keeps the two tracks off each other's files.

## D-265 — Home follows permissions: the board, or "שלי"
2026-11-12 · accepted · supersedes D-255's "הבקשות שלי" section; refines D-252, D-263 · V24 · decided under the owner's autonomy instruction of 2026-11-11
- **The roles, in plain words** (the system stays permission-driven, never title-driven): a soldier and a squad leader
  care about themselves, and open the app to add or follow a request, or when asked to. A platoon commander or
  sergeant is the first real manager: approves the unit's requests, their own included, and may delegate. A company
  commander plans, with a wide view and control, and rarely approves (company HQ's requests, mostly a formality).
  מפל"ג (company HQ) is soldiers with dedicated roles directly under the company commander: in the template it is a unit
  under the company next to the platoons, with no model change.
- **Home is derived from permissions.** Whoever approves or manages someone else lands on the board, scoped to their
  widest scope. Everyone else lands on "שלי". The two are one press apart in the bottom strip, and the last one chosen
  is remembered on the device; a link that names a panel or a view still wins.
- **"שלי" is a destination for whoever has a soldier record:** my next days, in or out; my requests and their status
  (D-167's open and history); the quick action. The "בקשות" destination is the approval inbox, for whoever may approve
  someone: "ממתינות לאישורי" with its count, then the closed requests, with the approve-now switch in its header (D-255).
- The panel keys stay: `my_leaves` lands on "שלי", `leave_inbox` and `leaves` on the inbox.
**Why:** the owner described a soldier who only follows their own requests and a commander who works the board. One
home for both made each look for their thing in the other's screen.

## D-266 — The quick action follows the role, then the mode
2026-11-12 · accepted · refines D-252, D-255, D-257 · V24 · decided under the owner's autonomy instruction of 2026-11-11
- "בקשה חדשה" for whoever may request while a rotation is current or upcoming: requests are collected before a
  rotation, so a planned one counts. "פתיחת סבב" only for whoever may create a rotation, in routine. Otherwise none
  (D-076): a soldier in routine has no quick action.
- **Requests come from the soldiers.** A commander should not need to enter them; entering one for a soldier stays a
  secondary path (the form's requester, a drag on the board, D-143), never a quick action.
- Until the mode is derived (V26, OI-211), "בקשה חדשה" follows the creation permission alone; fitting it to the mode,
  with "פתיחת סבב", comes after V26 (OI-219).
**Why:** a quick action that does nothing useful in routine is a dead control, and the commander's main journey is
approving, not typing other people's requests.

## D-267 — Several requests at once
2026-11-12 · accepted · refines D-115, D-179 · V28 · decided under the owner's autonomy instruction of 2026-11-11
- **One sheet of rows:** dates, type and reason per row; "add a row"; and a recurring row, a pattern that expands into
  separate leaves when the sheet is sent. The pattern is an input helper and is not stored.
- **Sent atomically;** each row becomes its own leave, approved, rejected and edited on its own. No grouping is stored:
  the requests of one soldier are derivable (D-019).
- **A new command, `createLeaves`,** for one soldier and several leaves, atomic (D-049). `createLeaveBatch` is not
  reused, because it stores a `leave_batches` row, which is the grouping this rules out. The command is a contracts
  change of V28.
**Why:** a soldier with several days off in a rotation sent them one form at a time; the commander still decides on
each day separately.

## D-268 — The board's visual language: presence is quiet, absence is a hole
2026-11-12 · accepted · refines D-108, D-174, D-179 · V29 · decided under the owner's autonomy instruction of 2026-11-11
- **Presence is the quiet default; absence reads as a hole,** dimmed or hatched, with the type's color as an accent
  edge or icon, never a solid fill. Green never means away. Pending stays distinguishable from approved.
- **Planned rounds and requests are two layers.** A round (the routine rhythm commanders plan, such as 8 days in and 6
  home) renders as a background layer; soldiers' requests render on top. The kind is derived, not stored (D-019): a
  leave in a batch (collective leave, D-179, or V31's planner) is a round, any other is a request.
- Recorded in V24, built in V29.
**Why:** a filled green block marked who is away and read as "present", and a collective leave painted half the
company; the board said the opposite of what it meant.

## D-269 — דוח 1 as a workflow: each unit confirms, one owner sends it up
2026-11-12 · accepted · extends D-193 · V30 · decided under the owner's autonomy instruction of 2026-11-11
- **Each platoon commander confirms the unit's list for a date:** whoever holds that permission on that day. The
  live list is always visible, confirmed or not.
- **The report owner** is set per rotation (typically someone in מפל"ג) and sees the consolidated report: each unit
  confirmed, not yet confirmed, or changed since its confirmation; one consolidated message copies upward (to the
  battalion). In routine, without a rotation, whoever may read the root unit's report sees it.
- **Stored:** the confirmation fact only (unit, date, who, when) and the rotation's report owner. "Changed since" is
  derived from leave changes after the confirmation time. Both are a schema change of V30, after V22 lands as it is.
**Why:** the daily report is a chain, not a screen: platoons confirm, HQ consolidates, the battalion receives one
message.

## D-270 — The leave-round planner
2026-11-12 · accepted · refines D-179, D-268 · V31 · decided under the owner's autonomy instruction of 2026-11-11
- Inside a rotation, a commander generates the routine rhythm (for example 8 days in and 6 home) for groups of
  soldiers. The planner creates ordinary leaves in a batch, so they read as rounds on the board (D-268).
**Why:** commanders build the same rhythm by hand every rotation; it is a pattern, and the leaves it makes are
ordinary ones.

## D-271 — Order of the slices after the journeys matrix
2026-11-12 · accepted · amends D-264 · V24 · decided under the owner's autonomy instruction of 2026-11-11
- Track A: V24 → V22 → V25 → V28 → V29 → V30 → V23. Track B: V26 → V27 → V31 → V21.
- V28 owns the `createLeaves` contract, V30 the confirmation table and the rotation's report owner; each asks before
  its model commit, as every schema change does.
**Why:** the matrix adds three requests-and-report slices to the track that holds the requests, and the planner to
the track that holds rotations.

## D-272 — The spreadsheet review: refinements of existing slices, no new ones
2026-11-12 · accepted · refines D-174, D-211, D-268 · V29 · reviewed with the owner on 2026-11-12
- The owner's two company spreadsheets (a hand-drawn leave grid per platoon, and a commander's generated board) show
  how rotations were planned before Sagol. They are a picture of the pains, not a specification: a single wide
  timeline drawn by hand, no single source of truth, soldiers asking verbally, coverage checked by fragile formulas,
  and mid-rotation changes breaking the sheet.
- Each pain is already answered by a built or planned slice: one board on the unit tree, self-service requests
  (V28, "שלי"), availability rules with soft acknowledgment (D-014, D-047, D-071 … D-073), several views on one model
  (D-174) with ranges up to a rotation (D-211), and the planner (D-270, unchanged). Nothing in them adds an entity.
- Two refinements go to V29: the board opens on the view that fits the device when no link or remembered choice
  names one (OI-220), and a rule's breach shows in every view, not only the timeline's heat row (OI-221). A sheet's
  summary row is not copied; the same derived figures show where the commander already looks.
- A situation picture (days in base per soldier and unit, fairness, rules over the rotation; derived, never stored)
  is a new module that needs joint design with the owner first (OI-222).
**Why:** the owner asked that the review deepen the understanding of the problem without duplicating features,
adding complexity or working around what is built.
