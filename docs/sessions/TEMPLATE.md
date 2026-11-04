# Session N.M — <title>

Date: YYYY-MM-DD · Layer/track: <contracts | domain | config | data | logic | ui | app | docs | tooling>
Roadmap row: N.M · Commits: `<hash> <conventional commit header>`

## Done

- What was built, by folder. Only this session's layer (plus i18n keys / theme tokens in UI
  sessions, D-025).

## Decisions

- D-NNN added or applied, with one line each. Anything decided here that is not in
  `docs/DECISIONS.md` must be added there first (ask the product owner).

## Checks

- `npm run check`: green. `npm run build`: green.
- New tests and what they prove.

## Open items

- Ids only; the text lives in `docs/OPEN_ITEMS.md` (D-043).
- Closed: OI-NNN (one line on how). Opened: OI-NNN (target session). Moved: OI-NNN → new
  target, with the reason (also written in the Notes column).
- If none: "No open items touched."

## Input for the next session

- What the next session (name it by roadmap number) needs from this one: APIs exported,
  files to read, constraints, fixes that belong to another layer.
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
- Update `docs/OPEN_ITEMS.md`: close resolved items, add new ones (never delete rows).
