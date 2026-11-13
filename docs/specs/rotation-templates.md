# Spec — Rotation templates ("פתיחה מהסבב הקודם")

Status: proposed, not scheduled. The slice gets its V-number, and P-n get D-numbers, when it starts.
Context: rotation (D-257). A Later item (see `README.md`).

#### Vnn — Plan from the previous rotation
**Owner sees:** in the leave-round planner (D-270, D-316), "פתיחה מהסבב הקודם": the planner fills itself with
the previous rotation's rhythm (days in, days home) and its groups (same soldiers together, same order of
turns), moved to the new rotation's dates. The commander reviews, changes what they like and creates as usual.
Nothing is stored as a "template": the previous rotation's leaves are the template.
- **contracts:** none.
- **config:** `ROUND_TEMPLATE.minRounds` (2: a soldier needs two leaves to show a rhythm).
- **domain:** none (`roundDays` in `src/domain/leaves/rounds.ts` already turns a rhythm into days).
- **data:** none.
- **logic:** pure `previousRoundPlan(previous, leaves, members, target) → { values, skipped }` in
  `src/logic/leaves/planner.ts`; `useLeaveRoundSetup` also returns the previous rotation and its leaves.
- **ui + i18n:** one action in the planner's header; a summary line of what was filled and who was skipped.
- **Open items:** none.
- **Decisions:** D-008, D-019, D-076, D-222, D-257, D-259, D-270, D-302, D-316.

## User stories

- Company commander: "Every rotation I build the same three groups at 8/6. I want last rotation's plan back,
  on the new dates, in one press."
- Commander: "A soldier joined this rotation. He is not in any old group; I add him myself."
- Commander: "Last rotation was 10/4. The new plan should start at 10/4, not the default 8/6."

## Meaning

- **Previous rotation:** `previousRotation` (`src/logic/deployments/deployments.ts:156`), the same rotation a new
  rotation's members copy from (D-222), closed or not.
- **Its rounds:** the approved leaves of its members, of one leave type (the type most of them used), inside its
  dates. Single leaves that do not repeat are noise and are ignored.
- **Rhythm:** days home = the most common leave length; days in = the most common gap between one leave's end
  and the next one's start, over all those soldiers. Ties take the shorter.
- **Groups:** soldiers whose first leave starts on the same day form a group; groups are ordered by that day.
- **Moved:** each group's first day home = its old first day + (new start − old start). A day before the plan's
  start rolls forward by one rhythm cycle; a day after the plan's end drops the group (reported).
- **Who:** only soldiers who are members of the new rotation. Old soldiers who left are skipped silently; new
  ones are in no group and are reported as "not placed".

## Data model

None. `leave_batches` holds no rhythm or groups (`docs/schema.sql`, D-316 stores leaves), and this feature
does not add them: the rhythm is derived from leaves (D-019).

## Permissions

The planner's own: reading the previous rotation's leaves is scoped by the policy; a soldier the actor cannot
read is not in any group. Creating is unchanged (`leaves.createBatch`, D-302).

## Server commands

None new. The prefilled plan is sent through `leaves.createBatch`, and every rule check runs as for a hand-made
plan.

## Screens and flows

**Planner** — header action "פתיחה מהסבב הקודם", shown only when the chosen rotation has a previous rotation
with at least one inferred group (D-076). Press: the form is reset to `previousRoundPlan(...).values`
(the name becomes "{rotation} · כמו {previous}"). If the form was edited, a confirm comes first.
Under the header, a line: "8 ימים בבסיס, 6 בבית · 3 קבוצות · 2 חיילים בלי קבוצה".

## Hebrew wording

| Where | Text |
|---|---|
| Action | פתיחה מהסבב הקודם |
| Confirm | להחליף את מה שמילאת בתכנון מהסבב הקודם? |
| Summary | {in} ימים בבסיס, {home} בבית · {groups} קבוצות · {count} חיילים בלי קבוצה |
| Dropped group | קבוצה אחת לא נכנסה בתאריכי הסבב |

## Edge cases

- The previous rotation was planned by hand, leave by leave, at no rhythm: no type repeats `minRounds` times,
  so the action is hidden.
- Two rhythms in one rotation (changed halfway): the most common wins; the commander edits.
- The new rotation is shorter: groups whose first day falls after the end are dropped and reported.
- The previous rotation is closed: `useLeaveRoundSetup` today keeps open rotations only
  (`src/logic/leaves/plannerHooks.ts:21`); the lookup reads all rotations of the unit, the choice list does not
  change.
- Leave type archived since: the plan's type is left empty, like a new plan.

## Acceptance tests

Unit (`previousRoundPlan`):
- Three groups at 8/6 over a 30-day rotation, moved 45 days: same groups, same order, rhythm 8/6, dates moved.
- A first day before the new start rolls forward one cycle; one after the end is dropped and reported.
- A soldier no longer a member is skipped; a new member is reported as not placed.
- Hand-made leaves without repetition: no plan.
- Mixed types: the majority type wins.

e2e:
- Commander opens the planner in the new rotation, presses the action, sees the summary, creates; the board
  shows the same pattern as the previous rotation, moved.
- The action is absent in the first rotation of a unit.
- Mobile, RTL, axe on the planner with the summary line.

## Proposed decisions

- **P-1** A rotation template is the previous rotation's leaves, read again; nothing is stored as a template.
- **P-2** Rhythm and groups are inferred (most common length and gap; same first day = same group) and only
  prefill the planner; the commander always reviews and creates.
- **P-3** Groups move by the offset between the rotations' start days; out-of-range days roll forward a cycle or
  drop, and are reported.

## Integration map

**Where it lives.** Inside the leave-round planner: `previousRoundPlan` in `src/logic/leaves/planner.ts`, next to
`newLeaveRoundValues` (:72), which it mirrors; the action in
`src/ui/modules/leaves/LeaveRoundPlanner.tsx`, which already resets from computed defaults (`useState` at :83).

**Reuse.** `previousRotation` (deployments.ts:156), `newRoundGroup` (planner.ts:64), `nextFirstHome`, the
`LeaveRoundValues` shape, `roundDays` for the preview, `useCreateLeaveRounds` → `leaves.createBatch`. The
existing leaves query gives the old leaves; no new query.

**Genuinely new.** Only the inference function and one header action. Caveat found: `previousRotation`'s comment
says "ended last" but it sorts by `start_date`; the two differ only for overlapping rotations, and the slice fixes
the sort to `end_date` in logic (its owner).

**Entry points.** Commander and unit manager with `leaves` create rights: the planner (LeavesModule
`LEAVE_MODES`). Soldier: none.

**Indicators.** The summary line, since a silent prefill hides skipped soldiers. None elsewhere.

**Effects.**
- Rules/heat row: the created leaves run the usual rules on create.
- דוח 1, filters V33, saved views: none.
- Rotations V26/V31: reads the previous rotation; never writes to it.
- Permissions V10: policy-scoped reads; test a commander who sees only part of the old leaves.
- Import/export V12, PWA: none.
- Local/remote parity: pure logic over read models, so identical; test both with a closed previous rotation.

**Rules.** Pure logic, limits in config, strings in i18n, server validation unchanged.

## Dependencies

None (builds on the shipped planner, D-316).

## Assumptions

- Commanders repeat last rotation's pattern more often than a fixed named template; a saved template library is
  not wanted.
- "Same first day home" is what a group means.
- Prefill only: never create leaves without the commander pressing create.
