# Sagol — instructions for every session

Read before doing anything (D-081): `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`,
`docs/OPEN_ITEMS.md`, the latest file in `docs/sessions/`, and `docs/FEATURE_MAP.md` sections
2 and 3 with this session's slice card. In `docs/DECISIONS.md`, read the index, the baseline
entries, the entries the card lists, whatever their "Changed by" column names, and any other
entry the work touches. In `docs/schema.sql`, read the tables the slice touches. Audits and
docs sessions that change decisions read `DECISIONS.md` in full. When unsure, read more.
Every `open` item in `docs/OPEN_ITEMS.md` targeted at this slice is in scope (D-043).

## Iron rules

1. One session = one vertical slice of `docs/FEATURE_MAP.md` (or one non-code track).
   One commit = one layer, and every commit passes `npm run check`. `i18n` with `ui` is the one
   allowed pair (D-025, D-075, D-127).
2. Layers talk only through each other's `index.ts`, via aliases (`@contracts`, `@domain`, ...).
3. No hardcoded values: strings → `i18n`; constants → `config`; entity names and
   vocabularies → `contracts`; colors/sizes → theme tokens; identities → environment.
4. No mock data outside test files.
5. Single source of truth: never store what can be derived.
6. No bypasses: no code path skips validation or permission checks, in any mode.
7. Entity and column names come from `docs/schema.sql`. Changing the model means updating
   `schema.sql`, `DECISIONS.md` and `contracts` together, in one commit, first in the slice.
8. No stubs and no dead controls. What is not built does not exist in the adapter's type or on
   screen (D-076).

## Workflow

- **Branches (D-110):** work never lands on `main` directly. Each session works on its own branch
  (`v4-leaves`, `a3-audit`, `docs-<topic>`), pushes it, and opens a pull request. When CI is green the
  session merges it itself (keeping the commits) and deletes the branch; when CI is red it fixes it, or
  reports and leaves it unmerged. So `main` is up to date when a session ends. Start every session from
  an up-to-date `main` (`git pull`), and first merge or report any pull request still open. Sessions may
  run in the cloud or locally; GitHub is the only shared copy.
- Plan before code. If a task needs a decision that is not in `DECISIONS.md`, ask.
- No workarounds or patches: a fix goes in the layer that owns it, in its own commit in the same
  slice when the slice needs it. Otherwise it becomes an open item with a target slice.
- Finish a slice with `npm run check`, `npm run build` and the whole Playwright suite green (desktop,
  mobile, RTL, axe; the CI worker count), Conventional Commits, a read-only review of the branch's own
  diff (the `code-review` skill or a fresh subagent; fix what is in the slice, open items for the rest),
  and a handoff note in `docs/sessions/NN-<name>.md`: done, how to see it, decisions, checks and the
  review, open items, input for the next session. The slice is done when its pull request merges with
  CI green (D-126).
- Anything left for another session goes into `docs/OPEN_ITEMS.md` (new id, one target slice). Close
  resolved items and move their rows to `docs/OPEN_ITEMS_ARCHIVE.md`, which is not read at the start
  (D-128). Handoffs refer to items by id, never copy them.
- Keep the current state current: a slice that changes an area updates its lines in
  `docs/ARCHITECTURE.md` and its screens in `docs/Design.md` (D-128).
- Update the status column in `docs/ROADMAP.md`.
- **Audits (D-051, D-078):** never run an audit inside an execution session. If the next roadmap
  row is an audit (`A1` … `A7`), end by telling the owner to open a separate audit session with
  `docs/AUDIT.md`. If an earlier audit row is still `☐` when you start, remind the owner and ask
  whether to continue (A1 may run alongside V0 without asking). An audit session itself follows
  `docs/AUDIT.md` and is read-only.
- **Next-session recommendation (D-052):** the handoff and the closing message name the next
  session (roadmap row), and recommend a Claude model and effort level for it, with a one-line
  reason (see `docs/sessions/TEMPLATE.md`).

## Communication

The product owner writes in Hebrew. Answer in Hebrew. Code, identifiers and docs are in English.
UI is Hebrew, RTL, Light Mode by default.
