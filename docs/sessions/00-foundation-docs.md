# Session 0.1 — Foundation docs

Date: 2026-11-03 · Track: docs · No source code touched.

## Done

- Project copied from the original download folder into this working folder
  (`node_modules` excluded; original left untouched).
- `docs/DECISIONS.md` created: D-001 … D-027 from the planning conversation.
- `docs/schema.sql` revision 3: permissions model, memberships, accounts, tag categories,
  leave events/comments/batches/groups, deployment members, availability rules, custom
  properties, audit block, multi-tenancy. Change list at the top of the file.
- `docs/ARCHITECTURE.md` revision 2: `domain` layer, server-authoritative data layer,
  identity and access, workspace/URL state, design-system and RTL rules, env, folder
  target, quality gates.
- `docs/ROADMAP.md`: phases 0–8 with single-layer sessions and the 0.2 guardrail list.
- `CLAUDE.md`: rules loaded by every session.

## Follow-up clarifications (same session)

- D-028: one scope model with relative anchors for rank bindings and grants.
- D-029: personal seniority overrides (temporary or permanent).
- D-030: linking without email: candidates by personal ID or names, approved by a commander.
- D-031: availability rules with group_by, global scope and priority.
- D-032: leave types fully user-managed, per-leave effect override, partition invariant.
- D-033: simple first-run wizard (roadmap 4.7).
- schema.sql bumped to revision 3.1.

## Open items

- Git repository initialized on branch `main` with the session 0.1 commit. Git warns about
  LF→CRLF conversion; session 0.2 adds `.gitattributes` (LF) and renormalizes.
- `npm install` has not been run in this folder.
- Backend provider still provisional (D-027).

## Input for session 0.2 (tooling)

Follow "Session 0.2 guardrails" in `docs/ROADMAP.md`. Do not write domain/contracts code;
create only empty layer folders and `index.ts` entry points (including `src/domain`),
tooling config, scripts and CI.
