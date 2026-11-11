---
name: audit
description: Read-only milestone audit (roadmap rows A1-A7). Owner-invoked only - /audit A<n>.
disable-model-invocation: true
allowed-tools: Read Grep Glob Bash(npm run check) Bash(git log *) Bash(git diff *) Bash(git show *) Bash(gh pr list *) Bash(gh pr view *)
---

# Audit $ARGUMENTS (D-051, D-078, D-154)

This audit is **read-only**. Edit nothing, create nothing, commit nothing. Answer in Hebrew.
It reads `main`, which holds only slices merged with CI green (D-126).

## Steps

1. Read `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` in full, `docs/ROADMAP.md`, `docs/FEATURE_MAP.md`,
   `docs/OPEN_ITEMS.md`, `docs/schema.sql`, and the merged pull requests of this milestone
   (`gh pr list --state merged`, then `gh pr view <n>`).
2. Write back in a few lines: the product's goal, what this milestone was supposed to deliver, and which
   decisions govern it. Wait for the owner to confirm.
3. Run `npm run check` once, and report only if it fails. Types, lint, layers, raw values, i18n, schema drift
   and unit tests are already covered by tools. Don't re-check them.
4. Check only what no tool verifies:
   1. **Intent.** The behavior matches the decision's text and its *Why*, not just the letter.
      For example, a permission check that is skipped in one path, or a stored value that should be derived.
   2. **Coverage.** Every accepted decision in this milestone is implemented, or explicitly deferred in
      FEATURE_MAP, ROADMAP or OPEN_ITEMS.
   3. **Tests that prove the rule.** The invariants that decisions name have tests that assert the rule,
      not just the happy path.
   4. **Docs in sync.** ARCHITECTURE, ROADMAP status and OPEN_ITEMS describe the code as it is.
   5. **Open items health.** Items moved more than once, items whose target already passed, items that
      block a later phase.
   6. **Drift.** The same idea named or shaped differently in two layers.
5. Don't report:
   - Anything a decision explains. A disagreement with a decision is a question for the owner.
   - Work assigned to a later slice, or items already recorded.
   - Style preferences or refactors.
   - Fixes or patches.
6. Report each finding as: title · severity (blocker / should fix / note) · evidence (file:line or doc and
   section) · related decision or rule · owning layer and target slice. End with questions for the owner,
   then what you checked.

## Afterwards (not in this session)

The owner picks which findings matter. A docs session records them as open items (one target slice each)
and marks the audit row `☑`. The findings themselves go in that docs pull request's description.
Use the strongest model at high effort for the audit itself.
