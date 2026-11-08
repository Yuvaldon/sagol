# Session V0 — Walking skeleton

Date: 2026-11-08 · Slice: V0
Roadmap row: V0 · Commits, one per layer:

- `e08ff2b build(tooling): commit-layer guard and slice tooling`
- `a40b55a feat(contracts): TimeSource for the data adapter`
- `b6a3666 refactor(contracts): leaf file for development-only auth modes`
- `3c2704a feat(domain): organization time-zone check`
- `ffa182b feat(config): routes, change-feed channel and startup codes`
- `bdfaf5a build(tooling): scope class rules of the raw-value scan to ui and app`
- `9afec67 feat(data): local adapter with session and owner bootstrap`
- `26dfb32 feat(logic): session service, query cache and form issues`
- `fb9ace1 feat(ui): Stone 3 tokens, Hebrew dictionary and first screens`
- `6dc50d5 feat(app): env parsing, composition, router and mount`
- `65619cb refactor(ui): remove the placeholder root`
- `40d9e8f test(e2e): walking skeleton demo in Playwright`

## Done

- **tooling:** `scripts/check-commit-layers.ts` in the pre-commit hook, tested on a crossing commit.
  `fake-indexeddb`, `@fontsource-variable/heebo`, `.claude/launch.json`, the committed
  `.env.development`, `tsconfig.tools.json`. The production guard reuses contracts and config.
- **contracts:** `TimeSource`, and `DataAdapterFactory` takes it.
- **domain:** `isKnownTimeZone`, `timeZoneIssues`.
- **config:** `ROUTES`, `CHANGE_FEED_CHANNEL`, `STARTUP_ERROR_CODES`.
- **data:** Dexie schema with all 28 tables, local identity provider, session resolver, policy
  snapshot loader, change feed across tabs, `session.*`, `organizations.current`, `bootstrapOwner`
  (with the post-write access-manager check). Contract suite with a `seed` port in
  `src/data/contract-tests/suite.ts`.
- **logic:** narrow ports, query cache invalidated by the feed, identity data dropped when the identity
  changes, session hooks, claim logic, form issues.
- **i18n + ui:** Stone 3 tokens, glass with solid fallbacks, dictionary, total error maps, primitives,
  sign-in, onboarding, "no access yet", workspace frame, user menu with the identity switcher, startup
  error screen, `docs/Design.md`.
- **app:** env parsing, `systemTime`, composition, router with a session gate, mount.
- **e2e:** one spec on desktop and mobile, RTL, axe on every screen, plus the CI job.

## How to see it

Run `npm run dev` and open <http://localhost:5173>. No setup file is needed.

1. You land on the sign-in screen. Enter any email (`owner@example.test`) and a name, then "כניסה".
2. On an empty store you get "הקמת הארגון". Submit it empty to see the field errors. Fill in the name,
   keep or change the time zone, enter your name, then "הקמת הארגון".
3. You see the empty workspace: a floating bar with the organization name and your name, at the top on
   desktop and at the bottom on a narrow window.
4. Reload. You stay in the workspace.
5. Open the user menu, choose "יציאה", and sign in with another email. You see "אין עדיין גישה" and
   nothing of the organization. Typing `/` in the address returns you there.
6. Under "זהויות במכשיר הזה", return to the first identity. The workspace is back.
7. Open a second tab on the claim form before claiming, and claim in the first: both move to the
   workspace.

To start over, clear the site data for `localhost:5173` in the browser's developer tools.

## Decisions

- D-083 and D-084 were recorded by the 0.8 session while this one was reading. V0 built them as
  written. The owner first answered "contracts" for the time zone, on an older copy of the documents,
  and then confirmed domain when the conflict was shown.
- D-085: the `can` hint moves to V1, computed by the adapter (OI-043). Approved by the owner.
- D-086: `.env.development` committed; any verified local identity claims an empty store; time-zone
  picker; startup error screen for what is not built; the identity key's content; class rules of the
  raw-value scan only in `ui` and `app`. Approved by the owner, except the last line, which came up
  during the slice: the scan read Dexie compound keys as Tailwind classes.
- Time zones and technical values read left to right inside the RTL layout (`docs/Design.md`).

## Checks

- `npm run check`: green (423 tests). `npm run build`: green. Playwright: green, 7 passed and 1 skipped
  (the mobile-only touch-target test on desktop).
- Contract suite: signed-out, unlinked and linked behavior, field codes, one transaction, audit from the
  session and the time source, every valid pair at organization scope, a second bootstrap refused, and
  denial paths with seeded rows.
- A production build was opened by hand with no env and with `VITE_AUTH_MODE=google`: both show the
  startup error screen and no console error. No automated test covers this, because Playwright runs
  against the dev server.
- **Not run:** the CI job, because there is no git remote (OI-008). The `prefers-reduced-transparency`
  fallbacks were not exercised, because Playwright cannot emulate that setting.

## Open items

- Closed: OI-002, OI-003, OI-004, OI-005, OI-006, OI-007, OI-035.
- Opened: OI-043 (V1), OI-044 (V10), OI-045 (8.4).
- Updated: OI-021, OI-023, OI-024 (now V5 only), OI-033 (now V1, V3).

## Input for the next session

- **Next: V1, unit tree.** Card in `docs/FEATURE_MAP.md`, section 4.
- **Starts with a contracts commit:** the `can` read (OI-043, D-085), which moves `PolicyTarget` to
  contracts.
- **Built here for V1 to extend:** `LocalDataAdapter` and `DataPort` (add groups to both),
  `describeAdapterContract` (add cases), `failure.ts` (`asResult`, `parseInput`, `parsedRow`),
  `createdBy` in `organizations.ts` (move it to a shared helper with its second caller),
  `loadPolicySnapshot`, and the `QUERY_KEYS` table scope in logic.
- **Not built, because nothing used it:** the `expected_version` helper. V1 writes it with the first
  update command. The same goes for the access-manager helper (OI-021 a): bootstrap calls
  `accessManagerIssues` directly, and V2 extracts a helper with the second caller.
- **`TimeSource` reaches `logic` in V3,** the first slice that needs "today". V0's logic has no use for it.
- **Forms:** `ui/patterns/forms.ts` holds what the two forms share, and V1 settles the pattern. An empty
  email answers `invalid_format`, not `required` (D-068 as written).
- **Layer order trap:** when `ui` removes an export that `app` uses, keep it one commit and remove it
  after the `app` commit, as with `AppRoot`.
- **Shell heredocs:** on this machine a long bash heredoc with Hebrew or quotes failed to parse. Write
  files with the file tool.

## Recommendation for the next session (D-052)

- Model: Opus 5.5 · Effort: high
- Reason: V1 sets the generic reference commands, the drawer and form patterns every module repeats,
  and a contracts change to the `can` hint. Next audit: A2, after V2.
