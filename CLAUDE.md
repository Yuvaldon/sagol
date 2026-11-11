# Sagol

Unit staffing and leave management web app. Vite + React 19 + TypeScript, layered (`src/<layer>/index.ts`).
The owner writes in Hebrew: answer in Hebrew. Code, identifiers and docs are in English. UI is Hebrew, RTL, light by default.

## Commands

- `npm run check`: typecheck, lint, layers, raw values, i18n, unit tests (about 2 min). Must pass for every commit.
- `npm run build` · `npm run e2e` (two workers; desktop, mobile, RTL, axe) · `npm run dev` (port 5173)
- Commits are Conventional Commits. lefthook enforces one `src` layer per commit (`i18n` + `ui` may pair), types, lint and boundaries.

## Where things are (read only what the task needs)

- `docs/ROADMAP.md`: slice order and status. `docs/FEATURE_MAP.md`: the slice cards.
- `docs/ARCHITECTURE.md`: layers and current state. `docs/Design.md`: screens.
- `docs/DECISIONS.md` (large): read the index at the top, then only the entries you need
  (`grep -n "^## D-123" docs/DECISIONS.md`, then read from that line). Decisions win over habit.
- `docs/OPEN_ITEMS.md`: every `open` item targeted at the slice is in scope. `docs/schema.sql`: read the tables you touch.
- Slice and audit workflows: the `slice` skill and the `/audit` skill.

## Rules no tool checks

1. Layers talk only through each other's `index.ts`, via aliases (`@contracts`, `@domain`, ...).
2. No hardcoded values: strings → `i18n`; constants → `config`; entity names and vocabularies → `contracts`;
   colors and sizes → theme tokens; identities → environment.
3. No mock data outside test files. Never store what can be derived.
4. No bypasses: no code path skips validation or permission checks, in any mode.
5. Entity and column names come from `docs/schema.sql`. A model change updates `schema.sql`, `DECISIONS.md`
   and `contracts` together, in one commit, first in the slice.
6. No stubs and no dead controls: what is not built does not exist in a type or on screen (D-076).
7. No workarounds: a fix goes in the layer that owns it. Otherwise it becomes an open item with one target slice.
8. A choice not covered by `DECISIONS.md`: technical ones you decide by these rules and record;
   product ones go to the owner in plain Hebrew with a recommendation.
