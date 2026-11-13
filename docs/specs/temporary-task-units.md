# Spec — Temporary task units ("כוח משימה")

Status: proposed, not scheduled. The slice gets its V-number, and P-n get D-numbers, when it starts.
Context: both. A Later item (see `README.md`).

#### Vnn — Task units
**Owner sees:** in the units tree, "כוח משימה חדש" under a unit: a name and dates. Soldiers are added to it from
any unit the commander covers; for those dates they are attached to it (`attached-memberships.md`), so the task
unit has its own board, דוח 1 and rules, and their home units see them marked "בכוח {name}". On its last day it
ends by itself: the attachments end with it, and the unit stays readable in history.
- **contracts:** `CreateUnitInput` accepts `kind = 'temporary'` with `valid_from`/`valid_to` (required then);
  issue `outside_unit_dates` (from attached memberships); `TaskUnitMembersInput`.
- **config:** `TASK_UNITS.maxDays` (186, the date window's bound, `DATE_WINDOW.maxDays`).
- **domain:** `unitLiveOn` moves from rules into `hierarchy` and is used by placement and filters, not only rules.
- **data:** `units.create`/`update` accept the temporary kind; `soldiers.attachMany` (one transaction, all or
  none) over the attach command; ending or shortening the unit trims its attachments.
- **logic:** the units form gets kind and dates; the tree shows the task unit only while live, plus a "past"
  section.
- **ui + i18n:** the create action, the dates in the unit form, an "add soldiers" sheet, a badge in the tree.
- **Open items:** none.
- **Decisions:** D-010, D-054, D-076, D-092, D-105, D-221, D-259; all of `attached-memberships.md`.

## User stories

- Battalion commander: "For a two-week exercise I build a task force from three companies. It needs its own
  board and its own morning report, and when it ends, everyone is back where they were."
- Company commander: "Four of mine are in the task force. I see them, marked, and they do not count in my
  presence during those days."
- Task force commander: "I approve their leaves for those two weeks."

## Meaning

- A **task unit** is a `units` row with `kind = 'temporary'` and both dates set (P-1), placed under a standing
  unit (its parent, whose commanders own it).
- Its members are **attachments** (`membership_type = 'attached'`) whose dates fall within the unit's dates. It
  never holds primary memberships (P-2).
- It is **live** on a day within its dates. Not live: it has no board entry, no rule evaluation and no new
  members; it is readable in history and in exports.
- Every count reads the duty unit, as in attached memberships: the task unit counts its members; the home units
  do not.

## Data model (proposed diff, not applied)

No new table or column (D-010: `units.kind`, `valid_from`, `valid_to` exist).

```diff
+	CONSTRAINT "units_temporary_dates_check" CHECK ("kind" <> 'temporary'
+	  OR ("valid_from" IS NOT NULL AND "valid_to" IS NOT NULL))
```

The server's membership trigger refuses a primary row in a temporary unit and an attached row outside the
unit's dates.

## Permissions

- Creating a task unit: `units:create` over its parent (as any unit).
- Adding members: per attachment (P-6 there): `memberships:update` over the task unit and `soldiers:view` over
  each soldier. A commander adds only soldiers they see.
- Holders scoped to the task unit (a grant anchored on it) cover its members only for `ATTACHED_COVERAGE`
  pairs, for its dates.

## Server commands

- `units.create` / `units.update` with `kind = 'temporary'`: dates required, span ≤ `TASK_UNITS.maxDays`.
  Shortening refuses if a leave of a member would fall outside (issue `leaves_outside_rotation`'s pattern:
  `attachments_outside_unit`), unless it trims the attachments in the same command (`trim_attachments: true`).
- `soldiers.attachMany({ unit_id, soldier_ids, valid_from, valid_to })`: one attachment each, all or none.
- No "close" command: the unit ends by date (derived, D-019).

## Screens and flows

- **Units module:** "כוח משימה חדש" in a unit's actions; the form shows "מתאריך" and "עד תאריך". The tree marks the
  unit with a badge "זמני · עד {date}". Ended task units move to a "כוחות שהסתיימו" group, collapsed.
- **Task unit page:** "הוספת חיילים" opens the soldier picker (search and filter over the soldiers the actor
  sees), with the dates prefilled to the unit's.
- **Board and דוח 1:** the task unit appears in the unit filter and the home landing like any unit, while live.

## Hebrew wording

| Where | Text |
|---|---|
| Action | כוח משימה חדש |
| Badge | זמני · עד {date} |
| Ended group | כוחות שהסתיימו |
| Add | הוספת חיילים |
| Home mark | בכוח {name} |
| Outside dates | התאריכים מחוץ לתקופת הכוח |

## Edge cases

- A soldier already attached elsewhere on some of the days: `attachment_overlap` for that soldier; nothing is
  created (all or none).
- The task unit is extended: existing attachments keep their dates; the commander may extend them in one step.
- The task unit is archived before it starts: its attachments are cancelled (not started, P-5 there).
- A rotation (D-257) of the task unit: allowed, within its dates; whole-unit membership counts attachments
  (already true in `wholeUnitSpans`).

## Acceptance tests

Unit: the contract (temporary needs both dates); `unitLiveOn` in hierarchy; `attachMany` all or none; the
shortening refusal and trim.

e2e:
- Battalion commander creates a task force for 14 days, adds 4 soldiers from two companies; its board and
  דוח 1 show them; each company's דוח 1 does not count them and marks them.
- The day after its end: the task force is in "כוחות שהסתיימו"; the soldiers are back in their companies' counts.
- Mobile, RTL, axe on the units tree and the add sheet.

## Proposed decisions

- **P-1** A task unit is `units.kind = 'temporary'` with required dates; it is live only within them.
- **P-2** Its members are attachments only; a soldier's primary unit never changes for a task.
- **P-3** It ends by date, never by a command; its attachments end at or before its end.

## Integration map

**Where it lives.** The units module (`src/ui/modules/units/UnitForms.tsx`, `src/logic/units/forms.ts`) and the
attach commands of `attached-memberships.md` in `src/data/local/soldiers.ts`.

**Reuse.** Everything of attached memberships (duty unit, coverage, badges); the schema's existing `kind` and
validity columns; `unitLiveOn` (today private in `src/domain/availability/rules.ts:261`); the soldier picker
used by rotation members; `wholeUnitSpans` (`src/data/local/leaveRotation.ts:75`) already counts attached rows.

**Genuinely new.** Only the form's kind and dates (today `toCreateUnitInput` hardcodes `standing` and null dates,
D-092, and so does `NEW_UNIT` in `src/logic/organization/template.ts:164`, which stays standing), `attachMany`,
and the "ended" group in the tree. Found gap: unit validity is enforced only by the rules today; this slice moves
`unitLiveOn` into `src/domain/hierarchy` and applies it in `placementIssues` (`src/data/local/soldiers.ts:135`).

**Entry points.** Commander and unit manager with `units:create` over the parent: the units module. Task force
commander: its board like any unit. Soldier: the "בכוח" line in שלי (from attached memberships).

**Indicators.** The tree badge with the end date (a temporary unit must look temporary); the home mark comes
from attached memberships. No count.

**Effects.**
- Rules/heat row: rules scoped to the task unit run while it is live; test a minimum rule ending with the unit.
- דוח 1 V30: the task unit has its own; home units mark and do not count.
- Filters V33 and saved views: a saved view on an ended task unit drops it (P-4 of saved views).
- Rotations V26/V31: within the unit's dates only.
- Permissions V10: grants anchored on a temporary unit end in practice with it; test no coverage after the end.
- Import/export V12: units export with kind and dates already; import of units stays as today.
- Parity: one core; the new CHECK in the migration and the local store.
- PWA: none.

**Rules.** Validity in domain hierarchy, limits in config, server-side checks for every date bound.

## Dependencies

`attached-memberships.md` (must ship first).

## Assumptions

- A task force is always time-bound; standing reorganizations are primary moves.
- Members keep their home unit for identity and grants.
- Ending is by date only; an early end is an edit of the end date.
