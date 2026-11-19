# Join linking: the commander needs only the name (R3·J)

**Built** in R3·J (D-445 … D-451). Open items: OI-382 (the new screen's wiring), OI-383 (the grant in existing organizations).

Approved by the owner on 2026-11-19 (D-170: what is not written here is decided by the builder and recorded).
Built in the contracts, config, domain, data and logic layers only. **No `ui` change in this slice**: the owner is
designing the join-requests screen separately and will hand it over later for wiring. The current interface
must keep working unchanged on top of this slice.

The idea: a commander must know only the soldier's name. Every extra detail they enter (personal id, invite email)
saves the commander and the soldier a manual approval.

## P-1 Auto-link on either detail (supersedes the "both" rule of D-005, D-030, D-066, D-148)

A sign-in (verified Google email) links without review when exactly one linkable soldier (not archived, no live
account, D-163) is found by **either**:

- **Email:** the soldier's `invite_email` equals the verified email (normalized); or
- **Personal id:** the soldier's `personal_id` equals the claimed one AND the name is close (P-2). The name guards
  against a mistyped personal id.

No auto-link, and the request stays pending, when:
- the email points to one soldier and the personal id to another;
- the personal-id soldier has an `invite_email` that differs from the verified email;
- more than one soldier matches either way.

Today: `autoLinkSoldier` in `src/domain/accounts/matching.ts` requires personal id AND invite email on the same
soldier; `requestLink` in `src/data/local/accounts.ts` (about line 290) calls it only when `email_verified`. The
server gateway (`src/data/server/gateway.ts`) reuses the same core (`createAdapterCore`), so one change covers
both. No SQL function takes part in matching (checked 2026-11-19).

## P-2 Lenient name comparison

Close = after `normalizeName` (niqqud, geresh, final letters: already there), in order or swapped first/last
(already there), plus **light typos**: a small edit distance per name part. The threshold is a constant in
`config` (rule 2), not a literal in domain. The same comparison feeds the reviewer's candidates (`linkCandidates`,
today exact-only).

## P-3 Classification of each pending request (derived, never stored: rule 3, D-164)

- `ready` ("מוכנה"): a single candidate and no contradiction. A name-only close match is `ready` (a typo is a
  normal match, not a contradiction).
- `needs_review` ("דורשת בדיקה") with a reason:
  - `personal_id_differs`: the candidate soldier holds a different personal id than the claimed one;
  - `several_candidates`;
  - `email_and_id_differ`: email and personal id point to different soldiers;
  - `invite_email_differs`: the soldier's invite email differs from the requester's email.
- `no_match` ("אין התאמה"): no candidate.

Exposed to the UI through the repository, next to `account_link_requests.candidates(id)` (contracts
`src/contracts/repositories/index.ts:188,223`): one read returning the candidates plus the classification and
reason. Vocabularies (readiness, reason) live in `contracts`. No schema column. Add `'email'` to
`LinkCandidateMatch` for a candidate found by invite email. The current UI
(`src/ui/modules/account-links/AccountLinksModule.tsx:97`) labels anything not `personal_id` as "by name"; accepted
until the owner's new screen arrives (no UI edits here).

## P-4 Bulk approve (supersedes D-283's "single personal-id match only")

`useBulkLinkApproval` (`src/logic/accounts/bulk.ts`, `certainCandidate`) approves every `ready` request, name-only
included, each through its own `accounts.reviewLink` kind `link` (permissions and validation stay, rule 4). The
others are not linked and their answer carries the reason: `{ kind: 'needs_review', reason }`. The current UI keeps
showing its generic text; the reason is there for the new screen.

## P-5 Enrichment on approval (extends D-149)

`linkEnrichment` fills what the soldier is missing from the request: `personal_id` (as today) and `invite_email`
(the requester's email). Never overwrite a name or an existing value. Skip a value another soldier already holds
(D-149's duplicate rule, now for both fields).

## P-6 Who sees and reviews a request (refines D-149)

Today `canReviewLinkRequest`: `accounts:approve` over ANY candidate, or organization scope when none. New: the
reviewer is whoever holds `accounts:approve` over the **best candidate** (personal id + name > email > name; ties
by `data.soldiers` order), usually the platoon commander; a request with no candidate goes to organization scope
(company commander). The data layer keeps filtering candidates by permission before they leave the adapter.

**Template:** in `src/config/templates/index.ts` only `company_command` has `accounts: ['view','approve']`;
`platoon_command` has none, so a platoon commander cannot see join requests at all today. Add
`accounts: ['view','approve']` to `platoon_command` (anchored on its home unit, descendants included,
`src/logic/organization/template.ts:244`). This reaches new organizations only; existing ones (production
included) get it through the permissions screen; say so to the owner. Creating a new soldier from a request still
needs `soldiers:create`, which the platoon commander lacks: they can link, not create. Kept.

## P-7 Unchanged

The requester never learns of a match and never sees candidates (no enumeration). Cancel, the rejection notice
(D-168) and unlink (D-163) stay as they are.

## Accepted risk

A personal id plus a close name links with no human in the loop: weaker than a verified email. The owner's
explicit choice; record it in the decision.

## Build order (one layer per commit, `npm run check` green on each)

1. `docs` + `contracts` (rule 5, first in the slice): new decisions from D-445 superseding the "both" rule
   (D-005, D-030, D-066, D-148) and D-283's bulk rule, refining D-149; index rows and "Changed by"; the readiness
   and reason vocabularies, the `'email'` match, the repository read. `schema.sql`: only the `invite_email` comment
   (no column change).
2. `config`: the name-typo threshold; the `platoon_command` `accounts` grant.
3. `domain`: lenient `namesMatch`, `linkCandidates` with email, `autoLinkSoldier` (P-1), the classification (P-3),
   best-candidate review (P-6), `linkEnrichment` with email (P-5). Unit tests for every rule and every reason.
4. `data`: `requestLink` with the new auto-link; the new read; `reviewLink` enrichment of both fields; the server
   gateway through the shared core.
5. `logic`: bulk approve by `ready`, answers with the reason.
6. `docs`: ROADMAP row ☑, ARCHITECTURE lines, open items, this spec marked built.
7. To the owner, in Hebrew: a short summary of what changed in behaviour, for their capability map.
