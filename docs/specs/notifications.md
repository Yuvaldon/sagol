# Spec — Notifications

Status: proposed, not scheduled. The slice gets its V-number, and P-n get D-numbers, when it starts.
Context: both (rotation and routine). Rank 1 of the Later items (see `README.md`).

#### Vnn — Notifications: updates in the app, push to the phone
**Owner sees:** a soldier whose request was approved, rejected, moved or cancelled gets a phone notification
and, in the app, a count on "שלי" with an "עדכונים" list. A commander gets a notification when a request
waits for them; tapping it opens that request. Each person turns phone notifications on per device, in the
profile, and chooses which kinds they want.
- **tooling:** the service worker moves from `generateSW` to `injectManifest` (P-3) with the same precache
  list and update flow (D-183); an owned Web Push sender (Web Crypto only, `src/data/server/webPush.ts`) in the `commands` function (P-4, D-435).
- **contracts:** table `push_subscriptions`; `SoldierPreferences` gains `updates_seen_at` and
  `notifications`; inputs `SubscribePushInput`, `UnsubscribePushInput`; enum `NotificationKind`;
  `PushPayload` schema (shared by the server and the worker).
- **domain:** `updatesFor(soldierId, events, leaves)` (which events are news to a soldier);
  `pushRecipients(command result, policy)` (who gets a push for one command, one push per person, P-6);
  `pushPayloadOf(kind, …)`.
- **data:** `notifications.subscribe`, `notifications.unsubscribe`; delete a person's subscriptions in
  `accounts.revokeLink` and on soldier archive; after-commit push dispatch in the server gateway only (P-5).
- **logic:** `useUpdates()` (list plus unread count, derived); `usePushState()` (supported, permission,
  subscribed on this device); `markUpdatesSeen()`.
- **ui + i18n:** "עדכונים" section on שלי; badge on the שלי destination; a "התראות" group in the profile;
  notification texts.
- **app:** the worker's `push` and `notificationclick` handlers; unsubscribe on sign-out.
- **Open items:** OI-151 (the in-app count refreshes like the rest of the data until live changes land).
- **Decisions:** D-008, D-017, D-019, D-025, D-036, D-038, D-044, D-045, D-046, D-068, D-074, D-075, D-076;
  D-012, D-013, D-054, D-183, D-197, D-200, D-201, D-203, D-250, D-252 … D-256.

## User stories

- Soldier: "I asked for a leave on Sunday. I want to know when it is approved without opening the app."
- Soldier: "My commander moved my leave by a day. I want to see that, with the new dates."
- Soldier: "I want to see, in one place, what changed on my requests since I last looked."
- Commander (holds leaves:approve): "When a soldier of mine asks for a leave, I want a notification, and
  tapping it opens the request so I can approve it."
- Commander: "When a squad leader sends 30 requests at once, I want one notification, not 30."
- Anyone: "I want to turn notifications off on a shared tablet, or keep only the kinds I care about."
- Anyone: "When I sign out on a device, it stops getting my notifications."

## What is news (derived, never stored)

An **update** is a `leave_events` row on a leave whose `soldier_id` is me, whose `actor_id` is not me,
and whose `event_type` is one of `approved`, `rejected`, `cancelled`, `rescheduled`, `updated`, `reopened`,
or `created` (someone else asked for me). Shared comments by others on my leaves (`leave_comments` not
internal, author not me, not archived) are updates too. Internal comments never are.

- The list shows updates of the last `NOTIFICATIONS.updatesDays` days (config, 30), newest first.
- **Unread** = `created_at > preferences.updates_seen_at` (NULL reads as "everything is unread", capped by
  the window). Opening the "עדכונים" section sets `updates_seen_at` to the newest shown update's
  `created_at` (not to "now", so an update that arrives meanwhile stays unread).
- Commanders need no new list: "בקשות" already shows the count awaiting me (D-252). Push is what is new for them.

## Push (Web Push, VAPID; no paid service)

- Browsers deliver through their own push services (Google, Mozilla, Apple) at no cost; payloads are
  end-to-end encrypted (RFC 8291), so those services see no content.
- **iOS** delivers only to an installed app (iOS 16.4+). In Safari, the switch is replaced by the install
  hint (the install flow already exists in the profile).
- **Sending:** the `commands` function, after the transaction commits, runs the dispatch inside
  `EdgeRuntime.waitUntil`, so the command's answer is not delayed and a push failure never fails a command.
  Best effort, no retry queue (P-5).
- **Free-tier fit:** one invocation per command already exists; dispatch adds no invocation. Per command at
  most `NOTIFICATIONS.maxPushesPerCommand` (config, 150) pushes, to stay well inside the free plan's 2 s
  CPU per invocation (encryption costs about 1–3 ms each). Recipients beyond the cap are skipped and
  logged; they still see the in-app count.
- **Dead endpoints:** a 404 or 410 from the push service deletes that `push_subscriptions` row (in its own
  short transaction). Other errors are logged and ignored.
- **The local adapter** (tests, offline dev) has no server: it implements `subscribe` / `unsubscribe` as
  table writes and sends nothing. Nothing on screen depends on a push arriving.

### Who gets a push (P-6)

| Command | Kind | Recipient |
|---|---|---|
| `leaves.create`, `createMany`, `createBatch`, `duplicate` with status `pending` | `awaiting_me` | every soldier with an active account who holds `leaves:approve` covering the leave's soldier (policy, today), except the actor |
| same, created `approved` for someone else | `my_request` | the leave's soldier, if not the actor |
| `leaves.transition` to approved / rejected / cancelled, or reopened | `my_request` | the leave's soldier, if not the actor |
| `leaves.update` that changed dates (rescheduled) | `my_request` | the leave's soldier, if not the actor |
| `leave_comments.add`, shared | `my_request` | the leave's soldier, if not the author |

- One push per recipient per command: several leaves collapse into one message with a count.
- A recipient gets a kind only when `preferences.notifications[kind]` is true (both default true) and they
  have at least one subscription.
- Approvers are computed by the same policy the inbox uses (`can(... 'leaves', 'approve', soldier target)`),
  inside the committed snapshot, never by a cached list.

### Payload (P-7)

`PushPayload = { kind, leave_id, count, soldier_name?, start_date?, end_date?, outcome? }`, validated on both
sides. No leave type, reason, comment body or personal id: the lock screen is public. `soldier_name` only for
`awaiting_me`. The worker turns the payload into Hebrew text from `@i18n` and sets `tag` to the leave id (or
`awaiting_me`), so a newer notification replaces an older one about the same thing.

## Data model (proposed diff, not applied)

```sql
-- New. One row per browser install that agreed to notifications (P-1).
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
	"soldier_id" UUID NOT NULL REFERENCES "soldiers"("id"),
	"endpoint" TEXT NOT NULL,                        -- the push service URL of this browser install
	"p256dh" TEXT NOT NULL,                          -- the browser's public key (base64url)
	"auth" TEXT NOT NULL,                            -- the browser's auth secret (base64url)
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id"),
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE ("endpoint")
);
CREATE INDEX IF NOT EXISTS "push_subscriptions_soldier_idx" ON "push_subscriptions"("soldier_id");
-- RLS on, no policies (D-203): only the gateway reads and writes it.
```

```diff
 "preferences" JSONB NOT NULL DEFAULT '{}',  -- validated by contracts SoldierPreferences:
                                             -- create_leaves_as_approved (D-121),
                                             -- appearance (D-181);
+                                            -- updates_seen_at (P-2), notifications (P-2);
```

Contracts:

```ts
NotificationKind = z.enum(['my_request', 'awaiting_me'])
SoldierPreferences += {
  updates_seen_at: Timestamp.nullable().default(null),
  notifications: z.object({ my_request: z.boolean().default(true), awaiting_me: z.boolean().default(true) }).prefault({}),
}
SubscribePushInput = z.strictObject({ endpoint: z.url().max(2048), p256dh: z.string().max(200), auth: z.string().max(100) })
UnsubscribePushInput = z.strictObject({ endpoint: z.url().max(2048) })
```

Never stored: unread counts, the update list, "subscribed on this device" (asked of the browser's
`PushManager.getSubscription()` each time).

## Permissions

- `subscribe` / `unsubscribe` act only on the signed-in soldier's own rows, like `updateMyPreferences`: no
  permission resource, but an active linked account is required (no account, no rows).
- `subscribe` with an endpoint already stored for another soldier moves the row to the caller (a shared
  device changed hands). `unsubscribe` deletes only a row of the caller; another's endpoint is
  `not_found` (no leak).
- Push recipients are decided by the policy at send time; a soldier never gets a push about a leave they
  could not open. `my_request` goes only to the leave's own soldier.
- Revoking an account or archiving a soldier deletes their subscriptions in the same transaction.

## Server commands

| Command | Input | Output | Notes |
|---|---|---|---|
| `notifications.subscribe` | `SubscribePushInput` | `{ subscribed: true }` | upsert by endpoint; sets `soldier_id` to the caller |
| `notifications.unsubscribe` | `UnsubscribePushInput` | `{ subscribed: false }` | idempotent: a missing row is success |
| `accounts.updateMyPreferences` | (existing) | (existing) | carries `updates_seen_at` and `notifications` |
| (internal) `dispatchPushes(result)` | — | — | server only, after commit, never a client command |

The VAPID public key reaches the client as environment (`VITE_PUSH_PUBLIC_KEY`); the private key is a
function secret (`PUSH_VAPID_PRIVATE_KEY`), and `PUSH_VAPID_SUBJECT` is the app's own https URL (no email).
With no public key in the environment the profile shows no notification controls (D-076).

## Screens and flows

**Profile → group "התראות"** (only where `PushManager` exists and the key is set)
- Switch "התראות במכשיר הזה". Turning it on: the browser's permission prompt, then `subscribe`. Turning it
  off: `PushSubscription.unsubscribe()` then `unsubscribe`.
- Under it, two checkboxes, shown only while the switch is on: "עדכונים על הבקשות שלי" and, only for those
  who hold `leaves:approve` anywhere, "בקשות שממתינות לאישור שלי". They write preferences (all devices).
- Permission denied in the browser: the switch is off and disabled, with the hint "ההתראות חסומות בדפדפן.
  אפשר לאפשר אותן בהגדרות האתר."
- iOS not installed: instead of the switch, "כדי לקבל התראות באייפון יש להתקין את האפליקציה" and the
  existing install action.

**שלי → section "עדכונים"** (above the soldier's own requests)
- Up to the window's updates, each one line: what happened, by whom, the dates, relative time
  ("לפני שעה"). Tapping opens the leave details (existing panel URL, `panel` + `entity`).
- Empty: "אין עדכונים חדשים". The section collapses to its header when everything is read.
- The שלי destination shows the unread count as a badge (same badge component as בקשות).

**Tap on a push** → focus an open app window or open one at the leave details URL (for a count > 1 of
`awaiting_me`, the בקשות destination). Signed out: the app's sign-in, then that URL.

**Sign-out** → unsubscribe this device first (best effort), then sign out.

## Hebrew wording

| Where | Text |
|---|---|
| Profile group | התראות |
| Device switch | התראות במכשיר הזה |
| Kind 1 | עדכונים על הבקשות שלי |
| Kind 2 | בקשות שממתינות לאישור שלי |
| Denied | ההתראות חסומות בדפדפן. אפשר לאפשר אותן בהגדרות האתר. |
| iOS hint | כדי לקבל התראות באייפון יש להתקין את האפליקציה |
| שלי section | עדכונים |
| Empty | אין עדכונים חדשים |
| Push, approved | הבקשה שלך אושרה · {dates} |
| Push, rejected | הבקשה שלך נדחתה · {dates} |
| Push, cancelled | הבקשה שלך בוטלה · {dates} |
| Push, moved | הבקשה שלך עודכנה · {dates} |
| Push, created for me | נקבעה לך היעדרות · {dates} |
| Push, comment | הערה חדשה על הבקשה שלך |
| Push, one awaiting | בקשה חדשה מ{name} · {dates} |
| Push, many awaiting | {count} בקשות חדשות ממתינות לאישורך |
| Update line | {actor} {verb} את הבקשה · {dates} (verbs: אישר, דחה, ביטל, עדכן, פתח מחדש, יצר) |

Push title is the app name (from environment identity), body is the text above.

## Edge cases

- Self-actions never notify (approving your own request, a commander creating their own leave).
- A batch of 500 pending leaves by one squad leader: each approver gets one push ("{count} בקשות חדשות").
  Fan-out cap applies per command.
- An approver both covers the soldier and is the soldier: excluded as actor or as subject of `awaiting_me`.
- A leave deleted from view by a later permission change: the push has already gone; tapping opens the
  leave URL, which shows the existing "not found / no access" state. The payload holds nothing secret.
- Same person, three devices: three pushes, one per device. Same device, account switched: the row moves.
- Two quick changes to the same leave: same `tag`, the newer replaces the older on the lock screen.
- Clock skew: unread compares server `created_at` values only.
- The preferences write uses `expected_version`; a stale write retries once with the fresh row (existing
  pattern) so marking as seen never shows an error.
- Push service down, function cold start, secret missing: no push, command unaffected, logged once.
- The worker updates (D-183): push handlers live in the same worker, so a waiting worker still shows pushes.

## Acceptance tests

Unit (domain, logic, data):
- `updatesFor`: own events by others only; internal comments excluded; window bound; unread by
  `updates_seen_at`; NULL seen time.
- `pushRecipients`: each row of the table above; actor excluded; preference off excluded; no subscription
  excluded; approvers by policy (unit scope, soldier scope, organization); one push per recipient for a batch;
  the cap.
- `PushPayload` round trip; no field outside the schema; i18n text for every kind and outcome.
- data: `subscribe` upsert, move between soldiers, `unsubscribe` idempotent and own-only; revoke and archive
  delete rows; schema-drift test covers `push_subscriptions`.
- gateway: dispatch runs after commit only (a failed command sends nothing); 410 deletes the row; a
  throwing sender does not change the command result.

e2e (desktop, mobile, RTL, axe):
- Profile with a stubbed `PushManager` and granted permission: switch on calls `subscribe`; the kind
  checkboxes appear; "בקשות שממתינות לאישור שלי" is absent for a soldier without approve.
- Without `PushManager`: no "התראות" group at all.
- Commander approves a soldier's request; the soldier's שלי shows badge 1 and the update line; opening the
  section clears the badge after reload.
- Worker `notificationclick` with a payload opens the leave details URL (worker unit test with a fake
  `clients`).
- Axe clean on the profile group and the updates section.

## Proposed decisions

- **P-1** Phone notifications are Web Push with VAPID, sent from the `commands` function. No email, SMS or
  third-party service (free plans only). Subscriptions live in a new table `push_subscriptions`; this is the
  one schema change of the Later list that D-010's "no schema change" does not cover.
- **P-2** In-app updates are derived from `leave_events` and shared `leave_comments`; only the seen time
  (`updates_seen_at`) and the two kind switches are stored, in `soldier_preferences`.
- **P-3** The service worker is built with `injectManifest`, in the `app` layer, so its push texts come from
  `@i18n`; precache and the update flow of D-183 stay as they are.
- **P-4** The server encrypts and signs with Web Crypto only, in its own module (`src/data/server/webPush.ts`, D-435), no Node polyfills and no library.
- **P-5** Dispatch is after commit, best effort, inside `waitUntil`; no outbox table and no retry. A missed
  push is covered by the in-app count.
- **P-6** Recipients: `my_request` to the leave's soldier, `awaiting_me` to everyone whose policy approves
  that soldier today; never the actor; one push per recipient per command; a config cap per command.
- **P-7** The payload carries no leave type, reason, comment or personal id; only the requester's name for
  approvers, dates and a count.
- **P-8** Notifications are per device on, per person by kind. Sign-out unsubscribes the device; account
  revoke and archive delete all of the person's rows.

## Owner action needed before the slice can ship

Generate the VAPID key pair once and set the function secrets `PUSH_VAPID_PRIVATE_KEY` and
`PUSH_VAPID_SUBJECT`, and the Vercel variable `VITE_PUSH_PUBLIC_KEY` (production and preview). A worker can
generate the pair; only the owner's accounts can store the secrets. Until then the feature ships with the
in-app updates only, and the profile shows no push controls (D-076).

## Integration map

**Where it lives.**
- contracts: `PushSubscriptionRecord`, inputs, `NotificationKind`, `PushPayload` next to the accounts
  contracts (`src/contracts/entities/accounts.ts`, `src/contracts/inputs/accounts.ts`); the two keys join
  `SoldierPreferences` (`src/contracts/settings/index.ts:18`, defaulted, so stored rows stay valid).
- domain: a new `src/domain/notifications/` (`updatesFor`, `pushRecipients`, `pushPayloadOf`), pure.
- data: `src/data/local/notifications.ts` wired in `src/data/local/core.ts`; the remote allow-list
  (`src/data/remote/adapter.ts:92`); dispatch in `src/data/server/` only.
- logic: `useUpdates` and `markUpdatesSeen` in `src/logic/leaves/` beside `useMyLeaves`
  (`workflowHooks.ts`); `usePushState` in `src/logic/shell/hooks.ts` beside `useInstallOffer`, through
  `ShellPort` (`src/logic/ports.ts`).
- ui: `src/ui/modules/leaves/MyLeavesModule.tsx` (section), `src/ui/shell/UserMenu.tsx` (group),
  `src/ui/shell/moduleEntries.ts` (count). app: the worker source and `createBrowserShell`
  (`src/app/shell/index.ts`).

**Reuse.**
- `LeaveEvent` and `LeaveComment` (`src/contracts/entities/leaves.ts`) are the news; `leaveThread` and
  `ThreadEntry` (`src/logic/leaves/workflow.ts`) render a line; `myLeavesQuery` scopes it to the soldier.
- Preferences: `accounts.updateMyPreferences` and `useUpdateMyPreferences`
  (`src/logic/session/preferences.ts`), with its serialized saves and D-187 failure notice.
- The count: `ModuleEntry.count` and `EntryCount` (`src/ui/shell/EntryCount.tsx`), the same path as the בקשות
  count in `useDailyEntries` (`moduleEntries.ts:165`). Badge copy keys follow `inbox.pendingCount`.
- Recipients: `can` over `context.soldierIds`, the pattern of `accessManagers` (`src/domain/policy`); add one
  general `holdersOf(context, permission, target)` there and make `accessManagers` use it. No second
  approver model.
- Env: `ENV_VARIABLES` and `EnvSchema` (`src/config/env/`) gain `VITE_PUSH_PUBLIC_KEY` (optional);
  `PWA` (`src/config/pwa/index.ts`) keeps the worker path and network-only paths.

**Genuinely new, and why.**
- A query of events by soldier: `LeaveThreadQuery` is per leave only (`src/contracts/repositories/index.ts:124`).
  Add `LeaveFeedQuery { soldier_id, since }` to the `leave_events` and `leave_comments` repositories, resolved
  in the adapter (one query, not one per leave).
- An after-commit seam: the gateway has none (`src/data/server/gateway.ts`). Add
  `GatewayDependencies.afterCommit(changes)`. It runs only when `result.ok`, after `transact` resolves and
  outside the retry loop. `changes` carry tables and ids only, so dispatch re-reads the new `leave_events`
  rows in one read.
- The worker moves from `generateSW` (today, `vite.config.ts` `installedApp()`) to `injectManifest`. Its
  precache globs and `navigateFallback` are copied as they are.

**Entry points.**
- Soldier: the שלי destination's count and the "עדכונים" section; the avatar menu's "התראות" group (D-253,
  personal).
- Commander: the push opens the request; in the app the existing בקשות count stays the only signal.
- Unit manager: nothing beyond the commander's. No ניהול entry, because notifications are personal (D-256).

**Indicators.**
- One count on שלי: unread `my_request` updates. It is warranted because nothing else tells a soldier an
  answer came.
- No in-app count for `awaiting_me`, which the בקשות count already shows (D-255). Two counts for one fact is
  noise.
- No OS app badge (`setAppBadge`) in this slice.
- Unread lines are bold; there is no "new" label.

**Effects on other features.**
- Rules row, filters and views, rotations, V33: none.
- דוח 1: no push for a report in this slice.
- Permissions: recipients follow `leaves:approve` today (V10); revoke and archive delete subscriptions.
- Import/export: `push_subscriptions` is device data and is never exported; preference keys follow the
  existing preferences treatment.
- PWA: D-183's update flow (`useAppUpdate`, `UpdateToast`) must keep working after the switch. An e2e test
  covers it, plus a worker unit test for `push` and `notificationclick`.
- Live data: there is no realtime. `QueryClient` uses `staleTime: Infinity` (`src/logic/queries/client.ts`).
  The worker posts a message to open windows on `push`, and `LogicProvider` invalidates `leaveEvents` through
  the existing `invalidateChanged`. The rest waits for OI-151.
- Parity: the local adapter stores subscriptions (shared contract tests) but never dispatches. With no public
  key the profile shows no group (D-076), so local mode has no dead control. Dispatch is tested in the gateway
  tests with a fake sender.

**Rules.**
- Through `@contracts`, `@domain`, `@config` and `@i18n` only. The worker's texts come from `@i18n` in the
  app layer.
- The cap per command and the window go in `config`.
- The server validates the endpoint (https, length) and the owner of the row. A client never sends a
  recipient.

## Dependencies

None. It is independent of the other specs; the attached-memberships recipients follow automatically through
policy.

## Assumptions

- A push is only about requests: one's own answer and requests awaiting one. דוח 1, rotations and comments
  that are not on one's own request send nothing.
- A commander's in-app signal stays the בקשות count. There is no second count.
- Phone notifications are opt-in per device, never on by default.
