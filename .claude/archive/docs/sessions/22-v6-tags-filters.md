# Session V6 — Tags and filters

Date: 2026-11-10 · Slice: V6
Roadmap row: V6 · Branch: `v6-tags-filters` · Commits, in order:

- `807915b docs: V6 decisions D-130 to D-134 (session V6)`
- `423cd01 feat(config): panels for tags and presence, search params for leave conditions, missing and day (D-130 to D-134)`
- `afddc52 feat(domain): a tag category in use cannot be archived (D-130)`
- `7de5fd7 feat(data): tag categories, tags and a soldier's tags, with setTags (D-130)`
- `e5ee99f feat(logic): tags, the filter bar's conditions, leave conditions, only who is missing, and the presence lists`
- `1205eb5 feat(ui): the tags drawer, a soldier's tags, the filter bar and the presence lists`
- `dc52c19 test(e2e): V6 demo of tags, filter chips, only who is missing and presence; shared helpers in the timeline demo (OI-087)`
- `620c24a build(tooling): a layer's testing/ folder for shared test helpers (D-135, OI-086)`
- `32a304a refactor(logic): one fake-ports helper for the tests, one way to build a check, and a file named for leave types`
- `ccd4999 refactor(data): the file of the account commands is named for them (OI-089)`
- `2979379 refactor(ui): one list of leave type options, and the leaves panel's file named for its module (OI-089)`
- `ae3919d test(e2e): a hidden input's touch target is its label`
- `e957366 fix(logic): pending only marks who is present, and the presence lists open on today (review of V6)`
- `2a48f49 fix(ui): leave chips beside a filter the bar does not read, the presence pill opens on today, and "+" stays while open (review of V6)`
- `febb247 test(e2e): the presence pill reopens on today, and leave chips stay beside a custom filter`
- `5c47885 test(e2e): the V6 demo waits for the saved profile before closing the drawer`
- `docs: close V6 (session V6)`

The session started from an up-to-date `main` with no pull request open. The owner answered the four product questions of
the plan (all four recommendations) and, at the end, OI-078's question.

## Done

- **docs:** D-130 to D-136.
- **config:** panels `tags`, `tag_categories`, `presence`; search params `leaves`, `missing`, `day`.
- **domain:** `archiveTagCategoryIssues`.
- **data:** `tag_categories` and `tags` as reference tables of the `tags` resource (order, archive, unique name per
  category, color checks, the switch to `single`); `soldier_tags` reads with `soldiers:view`; `soldiers.setTags` (D-130).
  The local adapter now builds every soldier command. Contract suite: `contract-tests/tags.ts`, denial paths included.
- **logic:**
  - `tags/`: the pure model (sections, forms, a soldier's tag groups, the whole set to send) and hooks.
  - `filters/source.ts`: one source of filter data and the population rule (OI-079, D-131).
  - `view-state/filter.ts` reads and writes the bar's conditions; `conditions.ts` and `board.ts` hold the leave
    conditions, "missing" and the presence day (D-132 to D-134).
  - The timeline keeps rows with a matching mark, or who is absent on a day in view, and mutes their present days.
  - `presence/`: the present and absent lists of a day (OI-090).
  - The board stays settled once its placement hints answered (OI-082); the new-leave form offers active soldiers only
    (D-125, D-136).
- **i18n + ui:** the tags drawer (tags by category, categories); a soldier's tags on their page; `CheckList` and
  `RadioList`; the filter bar with chips, "+", "רק מי שחסר" and the presence pill; the presence panel; the board's empty
  states for a filter and for "missing"; the muted present days read aloud.
- **e2e:** `e2e/filters.spec.ts`, desktop and mobile, with axe after each step.
- **Cleanup:** OI-086 (one fake-ports helper, under the new D-135), OI-087, OI-089.

## How to see it

Run `npm run dev` and open <http://localhost:5173>. Sign in and claim the organization if the store is empty.

1. Press "תגיות" in the bar. The drawer says a category comes first. Under "קטגוריות" add "תפקיד" (a color) and "מצב
   משפחתי" with "תגית אחת". Under "תגיות" add "חובש" and "נהג" to תפקיד, "רווק" and "נשוי" to מצב משפחתי.
2. Open "חיילים", add two soldiers, and open one. Under "תגיות" press "עריכת תגיות": check "חובש", choose "רווק" and then
   "נשוי" (one choice), and save. The page shows חובש and נשוי.
3. Close the drawer. Under the bars, press "+" and choose "תפקיד", then "חובש". A chip "תפקיד חובש" appears, the board
   keeps that soldier, and the link holds the filter. Reload: the same. Press the chip's "x" to remove it.
4. Add a leave type and an approved leave for yourself over today. Press "+", "סטטוס בקשה", "ממתין": nobody has a pending
   request, so the board says so. Remove it, and choose "מאושר": only you remain.
5. Turn on "רק מי שחסר": only who is absent this week stays, and the days they are present are greyed.
6. Press "חסרים היום": the drawer lists you under "חסרים" with the type, and the others under "נוכחים". Move a day
   forward or back, and back to "היום".

## Decisions

- D-130 tags and who assigns them; D-131 the filter bar and its soldier conditions; D-132 leave conditions in their own
  param (OI-012); D-133 "only who is missing", approved leaves only; D-134 present and absent lists of a day. The owner
  approved them in the plan, taking every recommendation.
- D-135 a layer's `testing/` folder for shared test helpers (OI-086), a technical decision within D-036.
- D-136 the new-leave form stays with active soldiers: the owner's answer to OI-078.
- Decided while building, inside those decisions: a chip's text is its accessible name (the condition, then every value,
  cut by width only); "+" keeps the picked condition open after its first value; saving tags reopens the profile form on
  the soldier's new version once it arrives, because the change came from the same page.

## Checks

- `npm run check`: green (761 tests). `npm run build`: green, with the size warning of OI-045 (1.5 MB now).
- Playwright, the whole suite with two workers: the first run had one failure, the mobile touch-target check of V0: it
  measured the switch's hidden 13 px input, not its 44 px label. The check now measures the label of a hidden input. The
  second run, after the review fixes, had one failure: V6's own demo closed the drawer before the profile's save went back
  to the list, a race in the test; it now waits for the list, and passed four runs in a row. A third whole run follows;
  its result and CI's are in the pull request.
- New tests: the tag contract (create, order, archive, names, the switch to single, setTags with its checks and its
  permissions); logic (the tag model, the filter round trip, `withTagChip`, the population rule, leave conditions, the
  presence partition, the board rows under tags, a status chip, a leave condition and "missing", the hint latch, the new
  params in the URL, the active-only form); the adapter's present days.

## Review (D-126)

A fresh subagent reviewed the branch's diff read-only. Nothing serious in data or logic: the order of checks in `setTags`,
the version, the reads and the filter round trip held. Fixed in this slice:

- A filter the bar does not read hid the leave chips, which still acted on the board: they now show beside it (ui).
- The presence pill opened on the last day shown, not today: `usePresenceDay().openToday` (logic, ui).
- "+" closed while open when its last condition became a chip: it stays while its popover is open (ui).
- Two tag sets of one category in a hand-written link shared a React key; the rank chip dropped a rank it could not
  name when another was checked (ui).
- "ממתין" also marked absent entries; it marks present ones only, as D-134 says (logic).

Left as they are: saving tags reopens the profile form, dropping unsaved profile edits on the same page (a choice: the
change came from that page); separators as UI constants follow the adapter's `TEXT_SEPARATOR`. Opened OI-093 for the
moment a new soldier's unit reads "unknown".

## Open items

- Closed: OI-012, OI-070, OI-078, OI-079, OI-082, OI-086, OI-087, OI-089, OI-090.
- Opened: OI-092 (V10, the presence lists of soldiers whose leaves the actor cannot read), OI-093 (V10, a new soldier's
  unit before their hint answers).

## Input for the next session

- **Next: V7, availability rules.** In scope: OI-042 (asked at its start), OI-066, OI-071, OI-075, OI-076, OI-077, OI-083,
  OI-084, OI-085, OI-091.
- A rule's population is a `FilterExpression`: build it with the same bar conditions (`readFilter`, `writeFilter`,
  `withTagChip`) and evaluate with `filterContextOf(useFilterSource())`. The chip components live in `ui/shell/FilterBar.tsx`;
  a rule builder will want the chip and its `CheckList` popover as shared parts.
- Availability for a window: `createAvailabilityContext` is used directly in `logic/timeline/hooks.ts` and
  `logic/presence/presence.ts`; OI-091 builds the rule context beside them.
- New tests can use `src/logic/testing/ports.tsx` (`fakePorts`, `allowEverything`, `organizationIn`, `wrapperOf`).

## Recommendation for the next session (D-052)

- Model: Claude Opus 5.5 (the strongest available) · Effort: high
- Reason: V7 brings rule enforcement, the acknowledgment protocol and one edit command across contracts, data, logic and
  ui, with A3's items on the same commands.
