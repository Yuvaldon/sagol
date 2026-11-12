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
| OI-032 | owner (later) | 0.7 | Focus mode (the mock's "מצב מיקוד") has no decision behind it. Define it and give it a slice when wanted (D-077). | open | Needs a product-owner decision. |
| OI-037 | V14 | A1 | The rows that `soldier_ref` and `unit_ref` values point to are checked by no item, and no domain function lists the ids that properties reference, unlike `filterReferences` (D-065, A1 finding 9). | open | Definitions arrive in V14, so no such value exists before it. |
| OI-045 | 8.4 | V0 | The production bundle is one 874 KB script, above Vite's 500 KB warning. Decide on code splitting (routes, heavy libraries) before deploy, when real network sizes matter. | resolved | D-210: each adapter pair and the libraries load in chunks of their own; no chunk passes 500 kB. |
| OI-069 | V15 | OI-021 | `seniorityOverrideOverlapIssues` on seniority-override writes. | open | Split from OI-021 (c). |
| OI-073 | V14 | OI-023 | `propertyDefinitionIssues` on property-definition writes (D-065). | open | Split from OI-023 (b). |
| OI-074 | V15 | OI-023, OI-027 | `leaves.duplicate` and `leaves.createBatch` decide through `planLeaveCreation`, check every permission it names on each soldier (D-063, D-114), and pass `leaveChangeViolations` and `ruleGate` over unfiltered rule data, storing the acknowledged ids in their events (D-047, D-073). | open | Split from OI-023 (a) and OI-027. |
| OI-080 | V14 | A3 | Property values reach the filter source of OI-079. | open | A3 finding 4. |
| OI-081 | V15 | A3 | Seniority overrides reach the filter source of OI-079. | open | A3 finding 4. |
| OI-088 | V13 | A3 | Pieces of the timeline sit in shared places: `logic/timeline` is the only rows model, and `ui/shell/ViewSwitcher.tsx:78` branches on `view === 'timeline'`. Separate what belongs to the timeline before more engines arrive. | open | A3 part 2. logic, ui. |
| OI-096 | V15 | V7 | Deployments and their members reach `logic/rules` (`ruleDataOf` gives none), and the rule form gets the deployment field (D-140). The command already checks the reference (D-139). | open | No deployment can exist before V15. |
| OI-097 | V13 | V8 | While a drag crosses a day, the board builds every row's model again (`timelineRows` in `TimelineEngine.tsx` is not memoized, and the drag's state lives in the same component). Fine for a company; a large board may stutter. Memoize the rows apart from the drag, with OI-088's split of the timeline's pieces. | open | Review of V8, nit 5. ui. |
| OI-098 | V13 | A4 | Build D-147: the filter source of the board, the bar and the presence lists reads units with archived ones, so "a unit and below" counts a soldier on the days they served in a sub-unit archived later, as rules and commands do (`logic/filters/source.ts:39`, `logic/rules/evaluation.ts:36`). Update the comment of `source.ts` that says V7's rules will read it. Add a test with an archived sub-unit for the board and the presence lists. | open | A4 finding 1. logic. |
| OI-102 | owner (later) | V9 | Invite links (was OI-026): a link directs, it does not approve; a request made through it attaches to the link's unit and matching searches only that unit's soldiers; expiry and use limits; optional "approve all exact matches". Needs a schema change (link table, request reference) and changes `linkCandidates` and the reviewer filter (D-030, D-149, D-152). | open | Needs a product-owner decision when wanted. Its own slice. |
| OI-104 | owner (later) | V9 | Restore an archived row (units, levels, ranks, soldiers, ...). An archived soldier's personal number stays taken until then (D-098, D-152). | open | Needs a product-owner decision when wanted. |
| OI-150 | 8.4 | 8.1 | The function `supabase/functions/commands` imports `src` through `deno.json` aliases and uses Deno's `sloppy-imports` (extensionless imports). Verify that a Supabase deploy bundles it; if not, bundle at deploy time (never a committed bundle). | resolved | D-209: `npm run build:function` bundles it with Rolldown at deploy time; CI runs `deno check` on the bundle. |
| OI-151 | owner (later) | 8.3 | The remote adapter hears only its own writes and other tabs' (D-204): a change made on another device shows after the next read. Add live changes (Supabase Realtime or polling) when users need it. | open | Free-plan limits apply. |
| OI-152 | owner (later) | 8.4 | Vercel Preview (staging) points at the production Supabase project (D-209). Create a second free Supabase project for staging, apply the migrations, deploy the function there and point Preview's `VITE_REMOTE_*` at it. | open | The free plan allows two active projects; the orchestrator holds the account. |
