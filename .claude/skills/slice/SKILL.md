---
name: slice
description: Workflow for building the next Sagol roadmap slice (V-rows) or a docs track end to end - branch, plan, one-layer commits, verify, PR, merge on green. Use when starting or finishing slice work.
---

# Building a slice (D-154)

State lives in git and in the docs, not in handoff files. One slice = one branch = one pull request.

## Start

1. `git switch main && git pull`. If a pull request is still open, merge it when CI is green, or report it.
2. Pick the first `☐` row in `docs/ROADMAP.md`. If it is an audit row (`A1`...), stop and tell the owner to run
   `/audit A<n>` in a fresh session (D-051).
3. `git switch -c <row>-<name>` (for example `v9-account-linking`).
4. Read that row's card in `docs/FEATURE_MAP.md`, the decisions it lists (the index first, then the entries,
   located with grep), the `open` items targeted at it, and the `schema.sql` tables it touches. Nothing more up front.
5. Plan, then code. A product choice that is not in `DECISIONS.md` goes to the owner, with a recommendation.

## Build

- One commit = one layer, in layer order. A model change comes first (rule 5 in CLAUDE.md).
- The hooks enforce the rest: lint after each edit, `npm run check` before you stop, no commits on main,
  no force pushes or history rewrites, and lefthook on every commit.
- Keep tool output short: `npm run check 2>&1 | tail -30`, and run a single test file while iterating.

## Finish

1. `npm run check`, `npm run build`, `npm run e2e`. All green.
2. Review the branch's own diff with the `code-review` skill (or a fresh subagent). Fix what is in the slice;
   the rest becomes open items.
3. Docs commit:
   - `docs/ROADMAP.md`: set the row's status.
   - `docs/OPEN_ITEMS.md`: close resolved items (move their rows to `OPEN_ITEMS_ARCHIVE.md`), add new ones
     (next free id, one target slice).
   - `docs/ARCHITECTURE.md` and `docs/Design.md`: the lines for what changed.
   - New decisions: the entry, its index row, and the "Changed by" column of the rows it changes.
4. Push, then `gh pr create`. The PR description replaces the handoff note: done · how to see it (steps from
   `npm run dev`) · decisions · checks and review · open items by id · next row with a model and effort
   recommendation and a one-line reason.
5. When CI is green: `gh pr merge --merge --delete-branch`. When it is red: fix it, or report it and leave the PR open.
6. Several slices may run in one session (D-154). Nothing carries over between slices except git and the docs:
   start each one again from step 1 of "Start", and don't rely on earlier conversation. The context stays small
   through auto-compact at 200k tokens, or the owner's `/clear`. Start a fresh session only when a slice needs a
   different model or effort.
