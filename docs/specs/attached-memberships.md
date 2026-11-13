# Spec — Attached memberships ("סיפוח")

Status: proposed, not scheduled. The slice gets its V-number, and P-n get D-numbers, when it starts.
Context: both. Rank 2 of the Later items (see `README.md`).

#### Vnn — Attached soldiers
**Owner sees:** in a soldier's details, "סיפוח ליחידה": a unit and dates. During those dates the soldier
appears on the host unit's board, in its דוח 1 and in its rules' counts, marked "מסופח מ{home}"; the home
unit still sees them, marked "מסופח ל{host}". The host commander handles their requests; the home commander
still can. An attachment ends by itself on its last day, or early with "סיום סיפוח".
- **contracts:** inputs `AttachSoldierInput`, `ChangeAttachmentInput`; issue codes `attachment_overlap`, `outside_unit_dates`,
  `attachment_redundant`; `UnitOnDay` gains the attached unit; `ATTACHED_COVERAGE` (the permission pairs an
  attachment extends, P-4). No new table or column; one added exclusion constraint (P-2).
- **domain:** `attachedUnitOn`, `dutyUnitOn` (P-3) in `hierarchy`; `attachmentIssues`; policy
  `CoverageFacts.unitsOf` and the coverage rule of P-4; filters, availability rules and the day report read the
  duty unit.
- **data:** `soldiers.attach`, `soldiers.changeAttachment`; `changeMembership` keeps refusing to touch
  attached rows; reports and rules evaluation by duty unit.
- **logic:** rows and grouping by duty unit (refines D-105); rotation whole-unit membership by duty unit at
  the rotation's start; soldier details read model with attachments.
- **ui + i18n:** "סיפוח" block in the soldier details; attach / change / end dialogs; row badge; group
  header count; filter label.
- **Open items:** none open today; journeys (a)–(e) re-run with one attached soldier.
- **Decisions:** D-008, D-017, D-019, D-025, D-036, D-038, D-044, D-045, D-046, D-068, D-074, D-075, D-076;
  D-010, D-028, D-053, D-054, D-055, D-097, D-105, D-106, D-159, D-221, D-259.

## User stories

- Commander of the host company: "Battalion sent me a medic for three weeks. I attach him to my company for
  those dates, so he is on my board and in my דוח 1, and I approve his leaves."
- Commander of the home unit: "My driver is attached elsewhere this rotation. I still see him, marked, and he
  is not counted in my presence."
- Commander: "The medic goes back early. I end the attachment from today."
- Soldier: "I see in שלי that I am attached to company X until date Y, and my requests go to its commanders."
- Platoon commander inside the host: "The medic is attached to my platoon, not the whole company, so he
  counts in my platoon's minimum."

## Meaning

- An **attachment** is a `unit_memberships` row with `membership_type = 'attached'`, a `unit_id` (the host),
  `valid_from` and `valid_to` (NOT NULL for attachments: an attachment always ends, P-1).
- A soldier has **at most one attachment on any day** (P-2), alongside at most one primary (existing).
- **Duty unit on a day** (P-3): the attached unit if an attachment covers the day, else the primary unit.
  Derived, never stored. Primary-only readers today (`primaryUnitOn` in rules, filters, reports, roster,
  deployments, policy) are each assigned to "duty unit" or "primary" below, explicitly.

| Reader | Uses |
|---|---|
| Board rows and grouping (D-105), "who is missing", present / absent lists | duty unit |
| Filters `unit` condition (D-067 per day) | primary **or** attached (either matches) |
| Availability rules, unit scope counts | duty unit |
| דוח 1 and its confirmations | duty unit |
| Rotation whole-unit membership (D-259) at the rotation's start | duty unit (spans already accept attached, `wholeUnitRotationIssues`) |
| Policy: holder's home unit (anchors, D-054) | primary only (an attachment grants no authority) |
| Policy: subject coverage | primary, plus attached for `ATTACHED_COVERAGE` pairs (P-4) |
| Soldier's "יחידה" column / roster | primary, with the attachment as a second line |

## Data model (proposed diff, not applied)

No new table or column (D-010 holds). Two constraints:

```sql
-- unit_memberships
+	-- An attachment always ends (P-1).
+	CONSTRAINT "unit_memberships_attached_ends" CHECK ("membership_type" <> 'attached' OR "valid_to" IS NOT NULL),
+	-- At most one attachment per soldier on any given day (P-2).
+	CONSTRAINT "unit_memberships_one_attached" EXCLUDE USING gist (
+		"soldier_id" WITH =,
+		daterange("valid_from", "valid_to", '[]') WITH &&
+	) WHERE ("membership_type" = 'attached')
```

Production holds no attached rows (no command wrote one), so the migration cannot fail on existing data;
the migration checks it with a `SELECT count(*)` guard first.

Contracts:

```ts
AttachSoldierInput = z.strictObject({
  id: UnitMembershipId, soldier_id: SoldierId, unit_id: UnitId,
  valid_from: CalendarDate, valid_to: CalendarDate,          // refine: valid_to >= valid_from
})
ChangeAttachmentInput = z.strictObject({
  id: UnitMembershipId, expected_version: ExpectedVersion,
  valid_from: CalendarDate, valid_to: CalendarDate,          // end early = valid_to earlier
  cancel: z.boolean().default(false),                        // P-5: delete an attachment that has not started
})
IssueCode += 'attachment_overlap' | 'attachment_redundant' | 'outside_unit_dates'
ATTACHED_COVERAGE: readonly { resource, action }[]   // P-4
```

## Permissions (refines D-054, P-4)

- Attaching or changing an attachment needs `memberships:update` covering **the host unit** (unit target)
  **and** `soldiers:view` covering the soldier. The host commander may "pull" a soldier they can see; the home
  commander may "push" one of theirs, which also needs `memberships:update` over the host unit. Without both,
  the action is not offered (D-076) and the command answers `forbidden`.
- Ending or changing an attachment: `memberships:update` over the host unit **or** over the soldier's primary
  unit (either side can end it).
- **Coverage of an attached subject** (`scopeCovers`, soldier target): covered if the primary unit is covered,
  or, for `(resource, action)` in `ATTACHED_COVERAGE`, if the attached unit on today is covered.
  `ATTACHED_COVERAGE` = `soldiers:view`, `leaves:view|create|update|approve`, `leave_comments:view|create`,
  `internal_comments:view|create`, `availability_rules:view`, `deployments:view`.
  Not in it: `soldiers:update|archive`, `soldier_private:*`, `memberships:*` (primary), `seniority_overrides:*`,
  `access_grants:*`, `accounts:*`, `tags:*`, `properties` values. Those stay with the home chain.
- The holder side is unchanged: an attached commander's relative anchors resolve from the primary unit.
- Every check stays in the policy (rule 4); the data layer calls it with the right target. `changeMembership`
  keeps targeting the primary unit only.

## Server commands

| Command | Checks (in order) | Writes |
|---|---|---|
| `soldiers.attach` | parse; permissions above; soldier not archived; host unit active, not archived, `kind` any; `attachmentIssues` | one `attached` row |
| `soldiers.changeAttachment` | parse; row exists, is `attached`, version; permissions; `attachmentIssues` with the new dates | update dates, `version + 1` |

`attachmentIssues(soldier memberships, candidate)`:
- `attachment_overlap` (path `valid_from`): another attachment of the soldier shares a day.
- `attachment_redundant` (path `unit_id`): on some day of the span, the host is the soldier's primary unit or
  an ancestor of it (they are there already). A descendant of the primary is allowed (company HQ → platoon).
- `invalid_order` (path `valid_to`): `valid_to < valid_from`.
- No primary on some day is allowed (a reservist with no unit yet can still be attached).

**End early** = `changeAttachment` with `valid_to` = the chosen day (default yesterday, so today is already at
home; the dialog offers "today" too). An attachment that has not started can be **cancelled**: `valid_to =
valid_from - 1` is illegal, so cancel deletes the row only if `valid_from > today` (P-5); it is a
`changeAttachment` with `cancel: true`. A started attachment is never deleted (history, D-010).

Leaves are not touched by any of these: a leave belongs to the soldier, not to a unit (D-012).

## Screens and flows

**Soldier details → block "סיפוח"** (between the unit and the tags)
- No attachment now or ahead: action "סיפוח ליחידה" (only if allowed).
- Current: "מסופח ל{host} עד {date}" with "שינוי תאריכים" and "סיום סיפוח".
- Upcoming: "יסופח ל{host} מ{date} עד {date}" with "שינוי תאריכים" and "ביטול הסיפוח".
- Past attachments: a collapsed "סיפוחים קודמים" list (unit, dates). Read only.

**Attach dialog** (sheet on mobile): unit picker (units the actor may attach to, tree order, `kind` badge for
temporary units), "מתאריך" (default today, or the selected rotation's start when the board is in a rotation),
"עד תאריך" (default the rotation's end, else empty and required). Errors inline from issue codes.

**Pulling a soldier from outside**: in the host's "ניהול → אנשים → חיילים", action "סיפוח חייל מיחידה אחרת":
a search over soldiers the actor can view but whose duty unit is outside the actor's units; then the same dialog
with the unit preset.

**Board**: an attached soldier is a row in the host's group on the days attached (duty unit, reference day of
D-105). Badge after the name: "מסופח" with tooltip "מסופח מ{home} עד {date}". In the home unit's view, on the
reference day, the row sits in the "יחידה אחרת" group (D-106) with "מסופח ל{host}". Days outside the
attachment are muted in the host's view, like any row that does not match a day (D-105).

**שלי (soldier)**: under the unit line, "מסופח ל{host} עד {date}".

**דוח 1**: an attached soldier is counted in the host unit, with the badge; never in both.

## Hebrew wording

| Where | Text |
|---|---|
| Block title | סיפוח |
| Action | סיפוח ליחידה |
| Pull action | סיפוח חייל מיחידה אחרת |
| Current | מסופח ל{unit} עד {date} |
| Upcoming | יסופח ל{unit} מ{from} עד {to} |
| Host badge / tooltip | מסופח · מסופח מ{unit} עד {date} |
| Home badge | מסופח ל{unit} |
| End | סיום סיפוח |
| End dialog | סיום הסיפוח של {name}. היום האחרון ביחידה: {date} |
| Cancel | ביטול הסיפוח |
| Change | שינוי תאריכים |
| History | סיפוחים קודמים |
| Fields | יחידה · מתאריך · עד תאריך |
| `attachment_overlap` | בתאריכים האלה החייל כבר מסופח ליחידה אחרת |
| `attachment_redundant` | החייל כבר שייך ליחידה הזאת בתאריכים האלה |
| `outside_unit_dates` | היחידה לא קיימת בכל התאריכים האלה |
| Success toast | {name} סופח ל{unit} |

Term map: "שיבוץ ליחידה" stays the primary membership; "סיפוח" is the attached one. Never "שיוך זמני".

## Edge cases

- Attached to a unit **below** the primary (HQ → platoon): one row in the company view, grouped in the
  platoon on attached days; counted once.
- Attached to a **temporary unit** (`units.kind='temporary'`): allowed; dates must lie inside the unit's
  `valid_from`/`valid_to` (issue `outside_unit_dates`, new, on the side that leaks). This is the bridge to "temporary task
  units".
- Primary changes during an attachment: the attachment is unaffected; coverage of the home side follows the
  new primary.
- Host unit archived during an attachment: archiving a unit with an active or upcoming attachment is refused
  with the existing `unit_not_empty` issue (attachments count as members).
- Soldier archived: open and upcoming attachments end on the archive day in the same transaction, like the
  primary.
- A leave created by the host commander, approved; the attachment ends; the home commander keeps full rights
  on that leave, the host commander loses them the next day (coverage is evaluated today).
- A rotation with explicit members (D-259): an attached soldier is added like anyone else; whole-unit rotations
  include attached soldiers whose duty unit at the rotation's start is in the unit.
- Rules with a seniority or tag scope work unchanged; only the unit part reads the duty unit.
- An attached soldier with no account: everything works; only notifications and שלי need an account.
- Import (data_transfer) does not create attachments in this slice.

## Acceptance tests

Unit:
- `attachedUnitOn`, `dutyUnitOn` across: no memberships, primary only, primary + attachment, attachment with no
  primary, the attachment's first and last day.
- `attachmentIssues`: overlap, redundant (same unit, ancestor), descendant allowed, temporary unit bounds.
- Policy: host commander can view and approve an attached soldier's leave but not update the soldier, change
  primary membership or read `soldier_private`; home commander keeps all; coverage ends the day after
  `valid_to`; holder anchors ignore attachments.
- Filters: unit condition matches on primary or attached day by day.
- Rules and day report: counts by duty unit; no double count at a common ancestor.
- Data: `attach` and `changeAttachment` permission matrix (pull, push, neither); stale version; cancel of an
  upcoming attachment deletes, of a started one is refused; archive ends attachments; schema-drift test sees
  the two constraints.

e2e:
- Host commander attaches a soldier from another platoon for a week; the row appears in the host group with
  the badge; דוח 1 of the host counts them; the home view shows "מסופח ל…".
- Host commander approves the attached soldier's request from בקשות.
- End attachment today; reload; the row returns to the home group from tomorrow.
- A commander without `memberships:update` over the host sees no "סיפוח ליחידה" action.
- Axe and RTL on the block and the dialog; mobile sheet.

## Proposed decisions

- **P-1** An attachment always has an end date (`valid_to NOT NULL` when `attached`, by CHECK).
- **P-2** At most one attachment per soldier per day (exclusion constraint), alongside one primary.
- **P-3** "Duty unit" on a day = the attachment's unit if one covers the day, else the primary. Board rows,
  presence, rules, דוח 1 and whole-unit rotations count by duty unit; the unit filter matches either; the
  holder's anchors stay primary (refines D-054, D-105, D-259).
- **P-4** An attachment extends coverage of the soldier, for the pairs in `ATTACHED_COVERAGE` only, to scopes
  that cover the host unit. Identity, private data, membership, rank, grants and accounts stay with the home
  chain. Both chains may handle leaves during the attachment.
- **P-5** An attachment that has not started can be cancelled (row deleted); a started one only ends early.
- **P-6** Attaching needs `memberships:update` over the host unit and `soldiers:view` over the soldier;
  ending needs `memberships:update` over either side.

## Integration map

**Where it lives.** The soldier's membership commands in `src/data/local/soldiers.ts` (next to
`changeMembership`, :466); the hierarchy readers in `src/domain/hierarchy/memberships.ts` (next to
`primaryUnitOn`); the UI in `src/ui/modules/soldiers/SoldierPage.tsx` (`PlacementSection`, beside `MoveDialog`).
No new module.

**Reuse.** The schema already has `membership_type` primary/attached with `valid_from`/`valid_to` (D-010); only the two
constraints for attached rows are new (P-1, P-2). Already attached-aware and kept as is: `wholeUnitSpans`
(`src/data/local/leaveRotation.ts:75`), `inDeployment` (`src/domain/availability/rules.ts:308`) and the soldier
history. The permission resource `memberships` (view/update) and the issue codes `membership_overlap` and
`not_a_member` are reused; only `attachment_overlap`, `outside_unit_dates`, `attachment_redundant` are new.

**Genuinely new.** `attachedUnitOn`/`dutyUnitOn` beside `primaryUnitOn`, and the switch of each primary-only
reader, one by one (the table in Meaning is the contract):

| Caller today (`primaryUnitOn`) | Becomes |
|---|---|
| `src/domain/policy/context.ts:138` (`unitOf`, feeds `CoverageFacts`) | primary for anchors; `unitsOf` adds attached for P-4 pairs |
| `src/domain/filters/evaluate.ts:91` (unit condition) | primary or attached |
| `src/domain/availability/rules.ts:245` (`placedOn`) | duty unit |
| `src/logic/rules/evaluation.ts:73` (`concernsUnit`) | duty unit |
| `src/logic/roster/roster.ts:52` (`unitStateOn`: soldiers list, board grouping, דוח 1 rows) | duty unit, primary as second line |
| `src/logic/deployments/deployments.ts:137` (`defaultDeploymentMembers`) | duty unit at the rotation's start |
| `src/data/local/reports.ts:197` (day report) | duty unit |

Fixes the attached work exposes, in the layer that owns them: `placedRow` (soldiers.ts:169) hardcodes
`primary`; `placementIssues` (:135) checks neither the unit's kind nor its validity, so `outside_unit_dates`
lands there; archiving a soldier does not end their memberships (it must end an open attachment too).

**Entry points.** Commander and unit manager of either side: the soldier page "סיפוח" block (attach needs the
host's `memberships:update`, P-6). Soldier: a read-only line in שלי. No board control: attaching is an
identity-level act, not a board edit.

**Indicators.** The row badge "מסופח מ/ל" (otherwise a soldier appears in two boards without explanation) and
the group header count (presence numbers change). Nothing else.

**Effects.**
- Rules/heat row and דוח 1 V30: counts by duty unit; test a minimum rule with one attached soldier on both sides.
- Filters V33: the unit condition matches either; `UNIT_STATE_KEYS` (`src/ui/patterns/units.ts`) gains the
  attached state.
- Rotations V26/V31: membership at the start by duty unit; `servedDays` (`src/logic/leaves/planner.ts:126`)
  ignores attachments and the subtree today; unified per `situation-picture.md`.
- Permissions V10: P-4 coverage in `src/domain/policy/scope.ts`; test that an attachment grants the host no
  identity or grant rights.
- Import/export V12: export already dumps the rows as stored (attached included); import has no membership
  operation and stays without one.
- Parity: one core (D-008); the new constraint lands in both the local store and the migration.
- PWA: none.

**Rules.** Hierarchy logic stays in domain; the UI asks logic for the duty unit and never calls `primaryUnitOn`;
the server validates dates, overlap and coverage.

## Dependencies

None. `temporary-task-units.md` depends on this.

## Assumptions

- An attachment always ends (P-1); open-ended moves are a primary change.
- The host counts the soldier; the home unit sees them but does not count them.
- Both chains may handle the soldier's leaves during the attachment; identity stays with home.
