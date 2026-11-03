# Sagol — Open Items

The single source of truth for work that one session leaves for another (D-043).
Handoff notes record what happened in a session. This file records what must still happen.

## Rules

1. **Start of session:** read this file. Every `open` item whose target is this session
   (or this session's layer, when the target is a layer) is in scope: resolve it, or move it
   explicitly (new target + reason in the Notes column).
2. **End of session:** close what was resolved (status `closed`, closing session in Notes),
   add new items, and in the handoff refer to items by id (`opened OI-016`,
   `closed OI-009`) instead of copying their text.
3. **Never delete a row.** Ids are permanent and never reused. An item that turns out to be
   unnecessary is closed with the reason.
4. **Target** is a roadmap number (`1.2`), or a layer/track when the session is not fixed
   yet (`data`, `docs/contracts`). `owner` means the product owner acts outside a session.
5. Items that need a product decision say so. The target session asks the owner first.

Status: `open` · `closed`

## Items

| Id | Target | From | Item | Status | Notes |
|----|--------|------|------|--------|-------|
| OI-001 | 1.4 | 0.2 | Env Zod schema (config) was not written in 0.2. Write it in config. | open | |
| OI-002 | 1.1b, then 4.2 | 0.2, 1.1a | Define the `AuthMode` enum in contracts (1.1b). Then replace the hardcoded `local` list in `vite.config.ts` (production-build guard) with that enum (tooling follow-up or 4.2). Needed by OI-001. | open | |
| OI-003 | 4.2 | 0.2 | `src/app/mountApp.tsx` throws a hardcoded English error message. Make it an error code. | open | |
| OI-004 | date-adapter session (unassigned) | 0.2 | `RAW_DATE_ALLOWED_IN` in `scripts/guardrails.config.ts` is empty. The session that writes the date adapter adds its path there and records the location in DECISIONS. | open | |
| OI-005 | 4.1 | 0.2 | Create the `I18nKey` / `dictionary` exports with the names `check-i18n` expects (configurable in `guardrails.config.ts`). | open | |
| OI-006 | 4.1 / 4.2 | 0.2 | Playwright: browsers not downloaded, no config, no CI job. Add with the first UI. | open | |
| OI-007 | 2.1 | 0.2 | `fake-indexeddb` (Dexie tests under Node) is not in D-026. Decide (ask owner) and add. | open | Needs a product-owner decision. |
| OI-008 | owner | 0.2 | No git remote, so CI has never run on GitHub. | open | |
| OI-009 | 1.2 | 1.1a | Timestamp ordering (`access_grants.valid_to > valid_from`) is not checked in contracts. Check it in domain. | open | |
| OI-010 | 1.2 | 1.1a | Domain validations left out of contracts by design: property `options` match the data type, property values against their definitions, `single` tag-category selection, seniority-override overlap. | open | |
| OI-011 | 1.4, then 2.x | 1.1a | `color_key` / `icon_key` are only length-checked. Closed palette list goes in config (1.4). Data layer (2.x) checks membership on write. | open | |
| OI-012 | 3.3 | 1.1a | `FilterExpression` selects soldiers only. View filters on leaves (type, status) are not modeled. Decide: view state holds them separately, or the model gains a leave subject (a contracts change). | open | Needs a product-owner decision. |
| OI-013 | docs/contracts or 8.1 | 1.1a | `leave_events.from_status/to_status` have no CHECK in `schema.sql` (allow-listed in the drift test). Add one. | open | |
| OI-014 | 8.1 | 0.1 | Backend provider is provisional (D-027, Supabase recommended). Decide at phase 8. | open | Needs a product-owner decision. |
| OI-015 | docs (trigger-based) | 0.3 | Keep session reading cheap as docs grow. **Trigger:** this file passes ~30 rows (open + closed) or DECISIONS passes ~60 entries; otherwise review at the end of phase 1 or 2. **Plan:** (a) move closed items to `docs/OPEN_ITEMS_ARCHIVE.md`, not read by default; (b) add an index at the top of DECISIONS: one line per decision with topic, affected layers and superseded-by; (c) change the read rule from "read all" to "read the index, then the entries tagged for this session's layer"; (d) keep ARCHITECTURE as the condensed current state with D-numbers. **Risk to handle:** the index must tag every layer a decision affects, so a narrower read never misses one. | open | Needs a product-owner decision (a new D-entry when done). Any session that notices the trigger reports it in its handoff. |
