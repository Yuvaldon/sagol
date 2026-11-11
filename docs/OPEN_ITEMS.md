# Sagol — Open Items

The single source of truth for work that one session leaves for another (D-043).
Handoff notes record what happened in a session. This file records what must still happen.

## Rules

1. **Start of session:** read this file. Every `open` item whose target is this session
   (or this session's layer, when the target is a layer) is in scope: resolve it, or move it
   explicitly (new target + reason in the Notes column).
2. **End of session:** close what was resolved (status `closed`, closing session in Notes) and
   move those rows to `docs/OPEN_ITEMS_ARCHIVE.md`, unchanged (D-128). Add new items, and in the
   pull request description refer to items by id (`opened OI-016`, `closed OI-009`) instead of copying their text.
3. **Never delete a row.** Ids are permanent and never reused. A closed row is moved to the
   archive, which is not read at the start of a session. An item that turns out to be
   unnecessary is closed with the reason.
4. **Target** is one roadmap row (`V3`, `8.1`) or a track (`docs`). Work that spans slices is one
   item per slice, and the Notes column is not a change log (D-128). `owner` means the product
   owner acts outside a session.
5. Items that need a product decision say so. The target session asks the owner first.

Status: `open` · `closed`

## Items

| Id | Target | From | Item | Status | Notes |
|----|--------|------|------|--------|-------|
| OI-014 | 8.1 | 0.1 | Backend provider is provisional (D-027, Supabase recommended). Decide at phase 8. | open | Needs a product-owner decision. |
| OI-018 | V12 | 1.1b | Moving an export to the backend through `importBatch` re-creates rows through commands, so leave history (`leave_events`), audit columns and account links are not carried over. Decide whether a privileged restore of a full export is needed (D-022, D-050). | open | Needs a product-owner decision. 0.7: retargeted from 2.3 (D-075). Ask at the start of V12. |
| OI-020 | 8.3 | 1.1b | `IdentitySource` exposes no access token. The remote adapter is expected to share the provider client created by `app`. If it cannot, add a credentials method to the contract in a contracts session. | open | |
| OI-022 | 8.2 | 1.2a | The policy matrix lives in `src/domain/policy/policy.test.ts` (sample world + `MATRIX`). Phase 8 runs it against `has_permission()` and RLS, so it must be extracted into a form both runners read, and D-053 … D-060 ported to SQL. | open | |
| OI-025 | 8.1 | 1.2b | Port D-063 … D-067 to the backend: leave transitions and edits in the server functions, personal-id normalization before the unique index (D-066), and a SQL (or server-function) filter evaluator with the same semantics and canonical key for rule enforcement (D-067). Extend the shared tests so both runners agree (like OI-022). | open | |
| OI-029 | 8.1 | 1.3 | Port D-070 … D-073 to the backend: rule enforcement inside the leave server functions with the same targets, populations, thresholds, groups, priority and "only when worse" comparison. Extend the shared tests so both runners agree (like OI-022, OI-025). | open | |
| OI-032 | owner (later) | 0.7 | Focus mode (the mock's "מצב מיקוד") has no decision behind it. Define it and give it a slice when wanted (D-077). | open | Needs a product-owner decision. |
| OI-037 | V14 | A1 | The rows that `soldier_ref` and `unit_ref` values point to are checked by no item, and no domain function lists the ids that properties reference, unlike `filterReferences` (D-065, A1 finding 9). | open | Definitions arrive in V14, so no such value exists before it. |
| OI-045 | 8.4 | V0 | The production bundle is one 874 KB script, above Vite's 500 KB warning. Decide on code splitting (routes, heavy libraries) before deploy, when real network sizes matter. | open | Local use is not affected. V2: it keeps growing with each slice, now with the calendar and the virtual list. |
| OI-050 | V12 | A2 | A membership id that is already taken answers `internal` instead of `already_exists`: only the soldier id is checked before `add` (`data/local/soldiers.ts:272`, `:396`; `failure.ts:47`). No test covers it (D-044, D-046). Import keeps ids (D-050), so it will happen there. | open | A2 finding 4. |
| OI-064 | 8.1 | V5 | Two events of one leave written in the same instant have no order: `leave_events` has only `created_at`, and the thread breaks a tie by id. One edit sends `reschedule` then `update`, milliseconds apart. The server must give events of a leave strictly increasing times, or the table needs a sequence (a schema decision). | open | Seen in the V5 demo, whose clock stands still: the history lines come out of order there only. |
| OI-065 | 8.3 | V5 | The inbox reads every pending leave, and every rejected or cancelled one, with no paging (`PENDING_QUERY`, `CLOSED_QUERY`, D-120). The closed list only grows. Decide paging or a time limit before real data sits on a server. | open | Local use is not affected. |
| OI-069 | V15 | OI-021 | `seniorityOverrideOverlapIssues` on seniority-override writes. | open | Split from OI-021 (c). |
| OI-073 | V14 | OI-023 | `propertyDefinitionIssues` on property-definition writes (D-065). | open | Split from OI-023 (b). |
| OI-074 | V15 | OI-023, OI-027 | `leaves.duplicate` and `leaves.createBatch` decide through `planLeaveCreation`, check every permission it names on each soldier (D-063, D-114), and pass `leaveChangeViolations` and `ruleGate` over unfiltered rule data, storing the acknowledged ids in their events (D-047, D-073). | open | Split from OI-023 (a) and OI-027. |
| OI-080 | V14 | A3 | Property values reach the filter source of OI-079. | open | A3 finding 4. |
| OI-081 | V15 | A3 | Seniority overrides reach the filter source of OI-079. | open | A3 finding 4. |
| OI-088 | V13 | A3 | Pieces of the timeline sit in shared places: `logic/timeline` is the only rows model, and `ui/shell/ViewSwitcher.tsx:78` branches on `view === 'timeline'`. Separate what belongs to the timeline before more engines arrive. | open | A3 part 2. logic, ui. |
| OI-096 | V15 | V7 | Deployments and their members reach `logic/rules` (`ruleDataOf` gives none), and the rule form gets the deployment field (D-140). The command already checks the reference (D-139). | open | No deployment can exist before V15. |
| OI-097 | V13 | V8 | While a drag crosses a day, the board builds every row's model again (`timelineRows` in `TimelineEngine.tsx` is not memoized, and the drag's state lives in the same component). Fine for a company; a large board may stutter. Memoize the rows apart from the drag, with OI-088's split of the timeline's pieces. | open | Review of V8, nit 5. ui. |
| OI-098 | V13 | A4 | Build D-147: the filter source of the board, the bar and the presence lists reads units with archived ones, so "a unit and below" counts a soldier on the days they served in a sub-unit archived later, as rules and commands do (`logic/filters/source.ts:39`, `logic/rules/evaluation.ts:36`). Update the comment of `source.ts` that says V7's rules will read it. Add a test with an archived sub-unit for the board and the presence lists. | open | A4 finding 1. logic. |
| OI-099 | 8.3 | A4 | A live rule warning answers "nothing broken" while its data loads or when the read fails, and each day a drag crosses starts a new read (`logic/rules/hooks.ts:199`). Show a loading or failed state, and keep the previous answer while a new span loads, before a remote adapter makes the delay real. | open | A4 finding 2. logic, ui. |
| OI-102 | owner (later) | V9 | Invite links (was OI-026): a link directs, it does not approve; a request made through it attaches to the link's unit and matching searches only that unit's soldiers; expiry and use limits; optional "approve all exact matches". Needs a schema change (link table, request reference) and changes `linkCandidates` and the reviewer filter (D-030, D-149, D-152). | open | Needs a product-owner decision when wanted. Its own slice. |
| OI-104 | owner (later) | V9 | Restore an archived row (units, levels, ranks, soldiers, ...). An archived soldier's personal number stays taken until then (D-098, D-152). | open | Needs a product-owner decision when wanted. |
| OI-105 | V11 | V9 | An identity whose request was rejected sees the form again with no word about it (D-151). Decide whether it is told, which `OnboardingState` can carry without revealing matches. | open | Needs a product-owner decision. |
| OI-107 | V11 | V10 | e2e for the rule warning on the edit form, a hard rule refusing a drop, and the rule dialog on the details steps, the close dialog and the inbox (the rest of OI-100). | open | V10: the agreement of warning and command is proven below the screen (OI-100); these are screen paths only. |
