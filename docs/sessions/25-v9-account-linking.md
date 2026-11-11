# Session V9 — Account linking

Date: 2026-11-11 · Slice: V9
Roadmap row: V9 · Branch: `v9-account-linking` · Commits, in order:

- `docs: V9 decisions D-148 to D-153`
- `refactor(domain): one LinkCandidate, and the candidates a reviewer may name`
- `feat(data): link requests, auto-link, withdrawing and review in the local adapter`
- `feat(config): the account-links panel`
- `feat(logic): asking to link, reviewing requests, and the invite email in the soldier forms`
- `fix(logic): the candidates hook says its type`
- `feat(ui): the request to link, the review module, the invite email field and an honest empty state`
- `test(e2e): V9 demo ...`
- review fixes, and `docs: close V9`

Worked under the owner's autonomy instruction of 2026-11-11: product questions took the recommended option and were
recorded as decisions.

## Done

- **domain:** `LinkCandidate` is the contract's (OI-036); `reviewableCandidates`; `canReviewLinkRequest` stated on it.
- **data:** `accounts.requestLink`, `cancelLinkRequest`, `reviewLink`; the `account_link_requests` reads (`get`, `list`,
  `candidates`); `insertSoldier` extracted from `soldiers.create` so a new soldier from a request is written one way.
  Contract suite `contract-tests/accounts.ts`.
- **config:** the `account_links` panel. **logic:** request and review forms, hooks, `candidateRows`, the invite email in
  the soldier forms (a form without the field leaves the stored email alone).
- **ui:** onboarding request form and waiting notice; the account-links bar button and module; invite email in the new
  soldier and private forms; the board notice for a linked soldier with no access (OI-055).
- **e2e:** `e2e/account-links.spec.ts`.

## How to see it

`npm run dev`, claim the organization as the owner. Add a unit and a soldier "יעל שחר" with a personal number and an
invite email (the soldier form has the new field). Sign out and sign in as that email: ask with the same name and number, and
you are linked at once. Sign in as another email and ask: you wait; "חיבורים" in the owner's bar shows 1. Open it, link to
the candidate, create a soldier from the request, or reject.

## Decisions

D-148 (asking, auto-link, withdrawing), D-149 (who a review may name, what approval writes), D-150 (the module), D-151
(onboarding, OI-055), D-152 (deferred: invite links, revoking, restoring), D-153 (the invite email field). No schema change.

## Checks and review

- `npm run check` green (839 tests), `npm run build` green, the whole Playwright suite with two workers green.
- A fresh subagent reviewed the diff read-only: no must-fix. Fixed: the comment on the build's provider. Left as OI-103
  and OI-106: id collision and revoked-account answers, candidates computed live, missing tests.

- **CI fix after the PR opened:** the e2e job failed on five mobile tests, each a press intercepted by another element.
  The account-links button made the phone's bottom bar's fixed-width module row (seven icons and the user menu) wider than
  the bar, the page grew to 429 px on a 412 px screen, and the phone zoomed out. The module row now shrinks and scrolls
  sideways in the bar (D-154, `fix(ui)`), and the walking skeleton checks the page stays as wide as the screen
  (`test(e2e)`). A local run with two workers failed the same way before the fix and passes after it (63 passed,
  5 skipped by design).

## Open items

- Closed: OI-019, OI-026, OI-034, OI-036, OI-046, OI-055, OI-072.
- Opened: OI-102 (invite links), OI-103 (revoke a link, V10), OI-104 (restore archived), OI-105 (rejected asker, V11),
  OI-106 (candidates and tests, V10).

## Input for the next session

- **Next: V10 (roles and access).** The roadmap rows after it are V11 and audit A5. Its items include OI-103 and OI-106.
- Screenshots of the new screens are in the repo-ignored `test-results/v9-shots/`.

## Recommendation for the next session (D-052)

- Model: Claude Opus 5.5 · Effort: high
- Reason: V10 touches the policy, the escalation guard and lockout checks across every module.
