# Session 1.4 — Config

Date: 2026-11-05 · Layer: config
Roadmap row: 1.4 · Commits: `feat(config): env schema and constant vocabularies`

## Done

- **`src/config/env`**: `ENV_VARIABLES`, `EnvSchema`, `parseEnv(raw, { production })` →
  `Env` or issues (`missing`, `invalid`, `development_only`, `required_for_remote`).
- **`src/config/palette`**: 12 `PALETTE_KEYS`, `PaletteKey`, `isPaletteKey`.
- **`src/config/breakpoints`**, **`views`**, **`url`**, **`storage`**, **`dates`**: constants
  as listed in D-074.
- `config.test.ts` (15 tests); `.dependency-cruiser.cjs` lets config tests import vitest;
  `.env.example` comment updated.
- Docs: D-074, index rows, ROADMAP 1.4, ARCHITECTURE folder line, OPEN_ITEMS.

## Decisions

- D-074. Owner chose the 12-color palette and Tailwind breakpoints. Proposed by the
  session, not asked: default view `timeline`, URL param names, storage names, Sunday week
  start, `he-IL`. Change by a later entry if wrong.
- Tooling edit inside a config session: one dependency-cruiser rule so config tests can use
  vitest (precedent D-039, D-061), recorded in D-074.

## Checks

- `npm run check`: green (372 tests, 15 new). Build not run (no UI change).
- Tests cover env (local, remote, blank values, missing, invalid, remote-required,
  production refusal, contract vocabularies), palette vs `ColorKey`, uniqueness of URL and
  storage names, breakpoint order, `Intl` formatters in `he-IL`.

## Open items

- Closed: OI-001. Moved: OI-011 → 2.1 / 2.2 (palette part done; data checks membership).
  Note added to OI-002 (still 4.2).
- OI-015 trigger: start-of-session documents are ≈ 135 KB (≈ 36k tokens). Owner decides
  whether that crosses ~10% of the window (D-062).

## Input for the next session

- Next: audit **A1** (phase 1: contracts and domain against the decisions). Open a separate
  read-only session with the prompt in `docs/AUDIT.md`. (D-051)
- Later consumers: 4.1 declares the same breakpoint values in the Tailwind theme and maps
  `PALETTE_KEYS` to token pairs; 4.2 calls `parseEnv(import.meta.env, ...)`; 3.3 owns URL
  param value types and the `filter` encoding.

## Recommendation for the next session (D-052)

- Model: Opus 5.5 (strongest available) · Effort: high
- Reason: an audit reads all of contracts and domain against 73 decisions and must catch
  subtle gaps; use a different, stronger session than the one that wrote the code.
