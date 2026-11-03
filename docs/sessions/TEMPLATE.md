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

- Known gaps, follow-ups, anything left deliberately undone and why.

## Input for the next session

- What the next session (name it by roadmap number) needs from this one: APIs exported,
  files to read, constraints, fixes that belong to another layer.

---

Conventions
- File name: `docs/sessions/NN-<name>.md`, NN = running session number (00, 01, ...).
- Commits follow Conventional Commits: `<type>(<scope>)?: <subject>`, types
  build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test. Scope = layer or
  track (e.g. `feat(domain): ...`). Enforced by the commit-msg hook.
- Update the status column in `docs/ROADMAP.md`.
