# Sagol — Audit sessions

An audit is a separate, **read-only** session that the product owner opens at the end of a
milestone (rows `A1` … `A7` in `docs/ROADMAP.md`). It checks that what was built matches the
intent, in places the automated checks cannot see. It never fixes anything (D-051, D-078).

## Who does what

- **Execution sessions never audit.** When the next roadmap row after a session is an audit
  row, that session ends by reminding the owner, in its closing message and its handoff
  ("Next: audit A<n>, open a separate session with `docs/AUDIT.md`").
- An execution session that starts while an earlier audit row is still `☐` reminds the
  owner and asks whether to continue without it. It does not run the audit itself. A1 may run
  alongside V0 without asking (D-078).
- **The audit session** reads and reports only. It writes no file and makes no commit.
- **The owner** decides which findings matter.
- **A following docs session** records the accepted findings as items in
  `docs/OPEN_ITEMS.md` (each with a target slice), writes the audit report to
  `docs/audits/A<n>.md`, and marks the audit row `☑`. Fixes happen in the target slice, in the
  owning layer's commit, under the normal rules.

## What the audit checks

The automated checks (`npm run check`, the commit hooks, CI) already cover: types, lint,
layer boundaries, raw values, i18n keys, schema drift (contracts ↔ `schema.sql`) and unit
tests. **Do not re-check them**: run `npm run check` once and report only if it fails.

Focus on what no tool verifies:

1. **Intent.** Does the built behavior match the decision text and its *Why*, not just its
   letter? For example: a permission check that exists but is skipped in one command path
   (iron rule 6), or a value stored that should be derived (iron rule 5).
2. **Coverage of decisions.** Every accepted decision that falls in this milestone's slices is
   implemented, or explicitly deferred in `FEATURE_MAP.md`, `ROADMAP.md` or `OPEN_ITEMS.md`.
3. **Tests that prove the right thing.** Tests exist for the invariants the decisions name
   (policy matrix, partition invariant, leave state machine...), and they assert the rule,
   not only the happy path.
4. **Documentation in sync.** ARCHITECTURE, ROADMAP status, OPEN_ITEMS and the handoffs
   describe what is actually in the code.
5. **Open items health.** Items moved more than once, items whose target session already
   passed, items that block a later phase.
6. **Drift between sessions.** The same idea named or shaped differently in two layers.

## What the audit must not report

- Anything that a decision explains. If a choice looks odd, find the D-number first. A
  disagreement with a decision is a **question to the owner**, not a defect.
- Work the roadmap assigns to a later slice, or an open item that is already recorded.
- Style preferences, refactors "for elegance", or rewrites of working code.
- Fixes. A finding states the problem, the evidence and which layer owns it. It never
  proposes a patch, a workaround or a cross-layer shortcut.

## Prompt for the audit session

Paste this into a new session, with `<n>` and the milestone filled in:

> You are running audit A<n> for milestone <milestone> of Sagol. This is a **read-only** session:
> do not edit, create or delete files, do not commit, do not run commands that change
> anything. Answer in Hebrew.
>
> 1. Read `CLAUDE.md`, `docs/AUDIT.md` (your rules), `docs/ARCHITECTURE.md`, all of
>    `docs/DECISIONS.md`, `docs/ROADMAP.md`, `docs/FEATURE_MAP.md`, `docs/OPEN_ITEMS.md`,
>    `docs/schema.sql`, and every handoff in `docs/sessions/` of this milestone.
> 2. Before auditing, write back in a few lines: the product's goal, what this milestone was
>    supposed to deliver, and which decisions govern it. Wait for my confirmation.
> 3. Run `npm run check` once. Then audit only what `docs/AUDIT.md` lists under "What the
>    audit checks", and respect "What the audit must not report".
> 4. Report each finding as: title · severity (blocker / should fix / note) · evidence
>    (file and line, or document and section) · the decision or iron rule it relates to ·
>    the layer and target slice that own it. No fixes.
> 5. End with: questions for me (disagreements with decisions, unclear intent), and what
>    you checked and found in order.

## Model and effort

Use the strongest available model at high effort. An audit is judgment over the whole
project, and a missed problem costs more than the tokens.
