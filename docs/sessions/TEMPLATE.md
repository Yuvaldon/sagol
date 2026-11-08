# Session N.M — <title>

Date: YYYY-MM-DD · Slice/track: <V0, V1, ... | docs | tooling>
Roadmap row: <V0> · Commits: one per layer, `<hash> <conventional commit header>`

## Done

- What was built, by layer. Each layer's work is in its own commit (D-075).

## How to see it

- Numbered steps the owner can follow in a browser, from `npm run dev`, ending in what they
  should see. Skip this section only for a non-code track.

## Decisions

- D-NNN added or applied, with one line each. Anything decided here that is not in
  `docs/DECISIONS.md` must be added there first (ask the product owner).

## Checks

- `npm run check`: green. `npm run build`: green. Playwright demo: green (desktop, mobile).
- New tests and what they prove.

## Open items

- Ids only; the text lives in `docs/OPEN_ITEMS.md` (D-043).
- Closed: OI-NNN (one line on how). Opened: OI-NNN (target slice). Moved: OI-NNN → new
  target, with the reason (also written in the Notes column).
- If none: "No open items touched."

## Input for the next session

- What the next slice needs from this one: APIs exported, patterns to reuse, files to read,
  constraints. A slice that was split is recorded in `docs/FEATURE_MAP.md`.
- If the next row is an audit (`A<n>`): "Next: audit A<n>. Open a separate read-only
  session with the prompt in `docs/AUDIT.md`." (D-051)

## Recommendation for the next session (D-052)

- Model: <current model name> · Effort: <low | medium | high | xhigh | max>
- Reason: one line, based on the next row's work.
- Guide: new design, decisions or security logic (contracts, domain policy, data commands,
  audits, the first UI that sets the design language) → the strongest model, high effort.
  Well-specified work that follows existing patterns (config constants, more modules of an
  established kind, docs bookkeeping) → a mid-tier model or medium effort. Use lighter
  settings only for mechanical, low-risk changes. When unsure, choose the stronger one.

---

Conventions
- File name: `docs/sessions/NN-<name>.md`, NN = running session number (00, 01, ...).
- Commits follow Conventional Commits: `<type>(<scope>)?: <subject>`, types
  build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test. Scope = layer or
  track (e.g. `feat(domain): ...`). Enforced by the commit-msg hook.
- Update the status column in `docs/ROADMAP.md`.
- A new D-entry adds its row to the index at the top of `docs/DECISIONS.md`, and fills the
  "changed by" column of the rows it changes (D-062).
- Update `docs/OPEN_ITEMS.md`: close resolved items, add new ones (never delete rows).
