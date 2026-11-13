# Spec — Hour-level leaves (departure and return times)

Status: proposed, not scheduled. The slice gets its V-number, and P-n get D-numbers, when it starts.
Context: both. A Later item (see `README.md`).

#### Vnn — Departure and return times
**Owner sees:** a leave may say when the soldier leaves on its first day ("יציאה 14:00") and when they are back
on its last day ("חזרה 10:00"). The times show on the leave's chip, in its details and in דוח 1 on those days.
Leaving the times empty works exactly as today.
- **contracts:** `Leave` gains `start_time`, `end_time` (`LocalTime`, nullable); the leave inputs carry them;
  `checkTimeRange` beside `checkDateRange`; issue `time_range_inverted` reuses `range_inverted`.
- **config:** `LEAVE_TIMES.stepMinutes` (15).
- **domain:** `time`: `LocalTime` parsing and formatting. Availability is **unchanged** (P-2).
- **data:** `leaves` create, update, batch and duplicate pass the times; export format 5.
- **logic:** forms carry the times; the board and דוח 1 read models expose them.
- **ui + i18n:** a `TimeField` primitive; time fields in the leave forms; a marker on the chip; the times in the
  details and in דוח 1 lines.
- **Open items:** none.
- **Decisions:** D-008, D-012, D-019, D-025, D-032, D-036, D-038, D-076; D-269, D-293, D-302, D-316.

## User stories

- Platoon commander: "Weekend leave leaves Thursday at 14:00 and is back Sunday at 10:00. The guards need to know
  who is still here Thursday morning."
- Company commander: "In דוח 1 I want to see who leaves today and at what hour."
- Soldier: "I see in שלי that I leave at 14:00, not just 'Thursday'."

## Meaning

- `start_time` is the hour the soldier leaves on `start_date`; `end_time` the hour they are back on `end_date`.
  Either may be empty. Wall-clock in the organization's time zone (`organizations.timezone`), no date shift.
- A one-day leave with both times: `end_time > start_time`.
- **Availability does not read the times (P-2).** A day the leave covers is counted by the leave type's effect,
  as today (D-032). A short absence that should not reduce presence uses a leave type, or the leave's override,
  with effect `available`. One rule, no hidden half-day arithmetic.

## Data model (proposed diff, not applied)

```diff
 	"end_date" DATE NOT NULL,                        -- inclusive
+	"start_time" TIME,                               -- leaves at, on start_date (P-1); NULL = not given
+	"end_time" TIME,                                 -- back at, on end_date
 ...
+	CONSTRAINT "leaves_times_check" CHECK ("start_date" <> "end_date" OR "start_time" IS NULL
+	  OR "end_time" IS NULL OR "end_time" > "start_time")
```

Additive and nullable (D-012): existing rows and old clients are unaffected.

## Permissions

Unchanged: the times are fields of the leave, under `leaves` create/update.

## Server commands

`leaves.create`, `leaves.update`, `leaves.createBatch`, `leaves.createMany`, `leaves.duplicate` accept the two fields; the contract
parse and the CHECK validate them. A batch (round planner, D-316) applies the same times to every leave.

## Screens and flows

- **Forms** (`LeaveEditForm`, `LeaveSheetForm`, `LeaveBatchForm`, `LeaveDuplicateForm`, `LeaveRoundPlanner`): next
  to each date, an optional "שעה" field. Empty by default.
- **Chip:** a small clock marker when either time is set; the label adds the hour only when the chip is wide
  enough (the existing label tiers).
- **Details and שלי:** "יציאה ה׳ 14:00 · חזרה א׳ 10:00".
- **דוח 1:** on the leave's first day, "יוצא 14:00" after the name; on its last day, "חוזר 10:00".
- **Timeline drag:** moving a leave moves its dates and keeps its times; resizing an edge keeps that edge's time.

## Hebrew wording

| Where | Text |
|---|---|
| Field | שעה |
| Details | יציאה {day} {time} · חזרה {day} {time} |
| דוח 1 | יוצא {time} · חוזר {time} |
| Inverted | שעת החזרה לפני שעת היציאה |

## Edge cases

- A one-day leave with equal times: refused (`range_inverted`).
- A leave edited from one day to several: the CHECK no longer applies; the times stay.
- Daylight-saving change on the day: wall-clock, nothing to convert.
- Import of a format 4 file: read with both times NULL.
- Rules of hours ("at least 5 present at 18:00"): out of scope; rules stay per day.

## Acceptance tests

Unit: the contract (nullable, one-day order, `range_inverted`); `LocalTime` parse and format; the export
round trip with times, and a format 4 import.

e2e:
- Create a weekend leave with 14:00 and 10:00; the chip shows the marker, the details and דוח 1 show the times.
- Drag it a week; the times stay.
- A planner batch with times; every created leave carries them.
- Mobile, RTL, axe on the forms with the time fields.

## Proposed decisions

- **P-1** A leave may hold a departure time on its first day and a return time on its last, both optional,
  wall-clock in the organization's time zone.
- **P-2** Times are information, not availability: day counts, rules and the heat row stay per day, by the
  leave type's effect (D-032).
- **P-3** Export format 5 carries the times; format 4 files still import.

## Integration map

**Where it lives.** A column pair on `leaves`, so the leave model, not a new entity.

**Reuse.** `checkDateRange` (`src/contracts/common/refinements.ts:11`) gets a sibling `checkTimeRange`; the
inputs in `src/contracts/inputs/leaves.ts` (`CreateLeaveInput` :108, `CreateLeaveBatchInput` :126,
`CreateLeavesInput` :155, `UpdateLeaveInput` :196) gain the fields; `src/domain/time` holds `LocalTime` next to
the date helpers; `useTimezone` (`src/logic/session/today.ts`) for display. The chip label tiers in
`src/ui/board/labels.ts` and `src/ui/board/LeaveChip.tsx`. The text and image of דוח 1 come from
`src/logic/presence/report.ts` and `reportText.ts`.

**Genuinely new.** `TimeField` in `src/ui/primitives/` (only `DateField.tsx` exists), and the contract's time
type. Nothing in availability: `createAvailabilityContext`/`leaveCovers` in `src/domain/availability/days.ts` and
the binary `AvailabilityEffect` stay as they are.

**Entry points.** Commander and unit manager: the leave forms and the planner. Soldier: the request form in שלי
and the details.

**Indicators.** The chip's clock marker only: without it, a timed leave looks like a full-day one.

**Effects.**
- Rules/heat row (`src/domain/availability/rules.ts`, `gate.ts`): none, by P-2; test that a timed leave counts
  like an untimed one.
- דוח 1 V30: two line suffixes; the image copy too.
- Filters V33 and saved views: none (no time condition).
- Rotations V26/V31: none; the batch carries the times.
- Timeline drag (`src/ui/engines/timeline/core/drag.ts`, day-index based): unchanged math; the commit keeps the
  times.
- Import/export V12: `EXPORT_FORMAT_VERSION` 4 → 5 (`src/contracts/inputs/transfer.ts:97`), with 4 accepted.
- Notifications: the push text may include the time.
- Parity: one core (D-008); the migration and the local store gain the columns together.

**Rules.** Times are parsed in contracts, formatted in domain, labeled in i18n; the CHECK and the contract parse
are the validation.

## Dependencies

None.

## Assumptions

- The need is "when does the soldier leave and come back", not partial-day presence counts.
- A short absence that should not reduce presence is modeled with an `available` leave type.
- Quarter-hour steps are precise enough.
