# Sagol — Design Handoff Package

Design materials for building the Sagol interface. Read this file first.

> ## ⚠️ Read first: which design is current
> The designs were made over several weeks. **The newest decisions are in `03-board-spec.md` (26.11).** Many screenshots were drawn **before** it and still show older details.
>
> **Order of authority:** `03-board-spec.md` → `02-design-decisions.md` → this file → screenshots.
>
> **Fully current images:** the four `screens/לוח – טלפון – *` (Board) and `design-language/07 רכיבים משותפים · ניווט, מספרים וזמן`. Use them as the reference for navigation, numbers, time components and the commander block.
>
> **Every other screenshot is current for its own content, but outdated in these shared elements.** Never copy them from those images:
> | Outdated in the older images | Current (source) |
> |---|---|
> | Tab bar with a "+" button in the middle | No "+". Commanders: Today, Board, Manage, Me. Others: Today, Me. A separate action circle on Today only (`03` §1.1) |
> | Dot under the active tab | Glass capsule behind the active icon (`03` §1.3) |
> | Commander block with presence bar, forecast line, expanded chart | Compact only: unit, fraction, 7 day columns, "דוח 1" (`03` §1.13, `design-language/07`) |
> | "X מתוך Y" | Fraction `{n}/{total}` (`03` §1.8) |
> | "חזר היום" / "יצא היום" | "חוזר היום" / "יוצא היום" (`03` §1.11) |
> | Amber dot for below threshold | Amber number or amber cell background (`03` §1.9) |
> | Sort/group/filter as chip groups | One options menu with rows (`03` §1.12) |
> | "יציאה עבורו" button on the person card | Select days in its 14-day strip → tray (`03` §1.2) |
> | Soldier's expanded calendar in its own style | The uniform month component from the Board (`03` §7) |
>
> The per-image status is in §4. When in doubt, flag it; don't follow the picture.

## How to use this package

**Files**
| File | What it is |
|---|---|
| `01-handoff-package.md` | This file. Overview, screen map, notes per screen, Board skeleton, Today cards, open questions, glossary |
| `02-design-decisions.md` | The full written record of design rules (system-wide) and screen decisions. Source of truth for rules |
| `03-board-spec.md` | The latest decisions: the Board, plus system-wide changes. Wins over `02` where it says **Supersedes** |
| `screens/` | Mockup PNGs (@2x, 390×844 pt), named `Screen – Phone – State` in Hebrew (list in §4) |
| `design-language/` | Design-language artboards (PNG @2x): design language, block template, toolbox, gestures and motion, three layers per feature, placement map, shared components |

**Precedence when sources disagree:** see "Read first" above.

**Ground rules**
- **Mockups are a target image, not a literal spec.** When a mockup conflicts with a rule or an existing decision, flag it; the owner decides.
- **Text wins over image.** The written spec (this file and `02-design-decisions.md`) is authoritative. Where a mockup shows something the text doesn't cover, build it if existing capabilities support it and log it in your decisions list. If it would need a new capability, flag it and don't build it. Sample data and placeholder copy in mockups are illustration only.
- **This design replaces the MVP screens it covers.** The screen-to-image mapping table (see "Expected process") is where each replacement is confirmed.
- **Phone only** for all screens. The only exception is the Board (§5).
- **One full version per screen**, as seen by a user with all permissions. Role differences are written in the notes. A separate version exists only where a screen genuinely looks different (Today's open block, §4).
- **What isn't in v1 doesn't appear at all.** No disabled buttons, no "coming soon", no reserved space.
- **Hourly leave is frozen.** Nothing is designed for it.
- **Not designed — derive yourself:** empty, loading and error states; process screens such as first sign-in and onboarding; desktop adaptations (except as stated in §3 and §5).
- **"Open" means not decided.** Propose one or two options. Do not fill in a guess.
- **Role differences are written by permission, not role name.** "פלוגה" (Company) is only a starter template, not a system rule. Read "without `leaves:approve` the requests card is hidden", not "a soldier doesn't see it". Role names (soldier, squad/platoon/company commander) appear only as shorthand for typical permission sets.
- **UI strings** are given in Hebrew, in quotes, with an English gloss. Put them in the strings file; never hard-code. Glossary in §9.

**Expected process (as agreed)**
- Create a design guide inside the project, and a mapping table between each image and the screen it replaces. The owner approves the table before building.
- Build in batches: first the foundation (components and navigation shell), then one main screen at a time.
- Each batch goes to the staging environment for review.
- Every decision you make on your own, and every deviation from a mockup because of a rule, goes on a list. The owner reviews it before release.

---

## 1. Design guide

All rules are written in `02-design-decisions.md` under **System-wide** (and `03` §1): color, typography, sizes, spacing, components, glass, tab bar, gestures, motion and states. The artboard PNGs illustrate them; the text is authoritative.

### Design tokens
Extracted from the mockup source. Token names are proposals; adapt them to the project's token system. **Every color goes through a token.** The color scheme must be themeable later (e.g. swapping the night blue), so components reference semantic tokens only, never hex values.

**Color — base**
| Token | Value | Usage |
|---|---|---|
| `color-primary` | `#2B3A55` | Night blue. Primary action, selection, active tab, today's circle. Nothing else |
| `color-primary-soft` | `#E3E8F0` | Soft primary background: military tag chips, selected chip |
| `color-on-primary-soft` | `#1E2A40` | Text on `primary-soft` |
| `color-bg` | `#F2F1EE` | Warm gray app background |
| `color-surface` | `#FFFFFF` | Cards, inputs in edit mode |
| `color-surface-subtle` | `#F7F6F3` | Quiet panels inside cards |
| `color-fill-muted` | `#ECEAE5` | Neutral chips (civilian tags), segmented-control track |
| `color-ink` | `#1B1A1F` | Primary text and data |
| `color-ink-2` | `#5C5A63` | Secondary text |
| `color-ink-3` | `#8E8A97` | Tertiary text, inactive icons, unchecked checkbox border |
| `color-past` | `#9A97A0` | Past days in a day strip (fixed gray, not opacity) |
| `color-divider` | `#F0EEEA` | Row dividers inside cards |
| `color-divider-strong` | `#ECEAE5` / `#E4E2DD` | Section dividers, outlines |
| `color-border` | `#D9D6CF` | Input and outlined-button borders |
| `color-toggle-off` | `#C9C6BF` | Toggle track off; dashed separators use `#D3D0C9` |

**Color — status** (muted)
| Token | Background | Text / accent | Usage |
|---|---|---|---|
| `status-pending` (amber) | `#F8EDD5` | `#7A4F0B`, border `#D39A2C` | Pending, soft rule, below threshold. Threshold cell background `#FBF4E4` |
| `status-ok` (green) | `#E1F0EA` | `#1E6B52` | Approved, OK |
| `status-rejected` (red) | `#F7E3E0` | `#9B2C24` | Rejected, hard rule |
| `status-error` | — | `#8E2C22` | Inline validation errors |

**Color — time components** (`03` §1.10)
| Token | Value |
|---|---|
| `time-on-base` | `#3A3743` |
| `time-leave-round` | `rgba(139,136,146,.28)` |
| `time-request-approved` | `#C9C5BC` |
| `time-request-pending` | fill `#F6E4C2`, border `#D39A2C` |
| `time-label` | `#3A3940` (text on bars) |

**Typography** — Heebo. Weights in use: 500, 600, 700 (400 for body where not emphasized).
| Token | Size | Usage |
|---|---|---|
| `font-display` | 48 | The big figure in an open block |
| `font-title` | 28 | Page title (one line), secondary figure |
| `font-heading` | 17 | Card titles, drawer titles |
| `font-body` | 15 | Default text, rows |
| `font-small` | 13 | Secondary lines, weekday names (bold) |
The scale is 48 / 28 / 17 / 15 / 13. The mockups also use 14, 12 and 11 in places (chips, badges, captions); map them to the nearest scale step or propose a 12 caption step.

**Radius**
| Token | Value | Usage |
|---|---|---|
| `radius-card` | 20–22 | Cards and drawers' top corners |
| `radius-control` | 16–18 | Buttons, inputs, menus |
| `radius-chip` | 12–14 (pill: half height) | Chips, badges (badge: 26 high, radius 13) |
| `radius-small` | 3–4 | Bars and cells in time components |
| Glass circles and capsules | full | Bell, back, capsule, tab bar |

**Spacing** — 4-based: 2, 4, 6, 8, 10, 12, 16. Screen side margin 16. Card padding 16. Row height 44 (also the minimum hit area).

**Elevation**
| Token | Value | Usage |
|---|---|---|
| `shadow-glass` | `inset 0 1px 0 rgba(255,255,255,.8), 0 6px 20px rgba(27,26,31,.10)` | Floating glass buttons, capsules |
| `shadow-bar` | `inset 0 1px 0 rgba(255,255,255,.8), inset 0 -1px 0 rgba(255,255,255,.25), 0 8px 28px rgba(27,26,31,.12)` | Tab bar |
| `shadow-drawer` | `inset 0 1px 0 rgba(255,255,255,.85), 0 -10px 40px rgba(27,26,31,.14)` | Drawers |
| `shadow-menu` | `inset 0 1px 0 rgba(255,255,255,.85), 0 10px 30px rgba(27,26,31,.16)` | Floating menus |
| `shadow-primary` | `0 6px 18px rgba(43,58,85,.35)` | Primary floating button |

**Glass**
| Token | Value |
|---|---|
| `glass-clear` | `rgba(255,255,255,.14)` + `backdrop-filter: blur(30px) saturate(180%)` |
| `glass-drawer` | `rgba(255,255,255,.22)` over a dim layer, blur 30–40px, saturate 180% |
| `glass-regular` | ~`rgba(255,255,255,.6)` + blur 36–40px, saturate 180% |
| Reduced transparency | Replace with opaque `color-surface` / `color-bg` |

**Motion**
| Token | Value |
|---|---|
| `duration-tap` | 120ms |
| `duration-ui` | 200ms (menus, rows, header shrink) |
| `duration-drawer` | 280ms (drawers, day change, tab-bar collapse) |
| `easing-standard` | `cubic-bezier(.2,.8,.2,1)` (fast in, slows at the end) |
| Dragged elements | Gentle spring |

### Accessibility and RTL
- **RTL throughout.** Layout, icons with direction (back chevron, "›" on rows) and swipe directions mirror for Hebrew. Numbers and dates stay LTR inside RTL text.
- **Hit area ≥ 44×44**, also when floating buttons shrink to 36 on scroll.
- **Icon-only buttons** need an accessible name; use the Hebrew labels from the strings file (e.g. "עדכונים" for the bell, "עריכת פרטים" for the pencil, "חזרה" for back).
- **Contrast:** text ≥ 4.5:1 against its background, including amber text on amber backgrounds and text on glass.
- **Status is never color alone:** pending, approved and rejected always carry a word; below-threshold numbers keep the fraction.
- **Every gesture has a tap path** (table below). Swipe actions must be reachable from the item's own drawer.
- **Reduce Motion** → short crossfade only. **Reduce Transparency** → opaque surfaces instead of glass.
- **Drawers:** focus moves into the drawer on open and returns to its origin on close.

**Non-gesture alternative for every gesture** (project rule: every drag has a non-drag path):

| Gesture | What it does | Path without the gesture |
|---|---|---|
| Swipe a request row | Reveals ✓ and ✗ | Tap the row to open the full request, with the same actions |
| Long-press a row | Multi-select | **Open.** Recommendation: "בחירה" (Select) in the page's options menu |
| Long-press a button | Secondary options (e.g. saved views) | **Open.** Recommendation: same options also in the options menu |
| Horizontal swipe on content | Move between days or months | **Open.** Recommendation: small arrows next to the date or month |
| Pinch on the timeline | Change range (week, month, rotation) | Range in the Board's options menu, which also holds the custom range |
| Long-press a day in the Board calendar | Start a range selection | **Open.** Recommendation: after selecting a day, a "בחירת טווח" (Select range) action in the drawer |
| Drag a drawer | Change height; pull down closes | "כרטיס מלא" (Full card) for full height. ✕ or tap on empty space to close |
| Drag in the unit tree | Reorder and move | **Open.** Recommendation: "⋯" → "העברה" (Move — choose a parent from the tree), plus "הזזה למעלה" / "הזזה למטה" (Move up / Move down) |
| Tap the active tab | Back to top and to today | Normal scroll. In the "where am I" capsule, tap returns to the top of the list |

Availability rules already have no drag, so no alternative is needed.

---

## 2. Overview

### Screens (phone)
| Screen | Type | Design status | In v1 |
|---|---|---|---|
| Today | Tab | Designed (open block). Other cards in §6 | Yes |
| Board | Tab | Designed: Calendar, Timeline, Movements, one shared frame (`03`) | Yes |
| Manage | Tab | Designed | Yes, only rows for designed tools |
| Manage → Soldiers | Inner page | Designed | Yes |
| Manage → Join requests | Inner page | Designed | Yes |
| Manage → Availability rules | Inner page | Designed, incl. archive. Form to be revisited at the end | Yes |
| Add soldiers | Temporary full screen | Designed | Yes |
| Me | Tab | Designed | Yes |
| Me → My rotation | Inner page | Defined in text | Yes |
| Me → All requests | Inner page | Defined in text | Yes |
| Me → Preferences | Inner page | Defined in text | Yes |
| Leave-round planning, temporary units, rotation details, switch to routine, Settings | — | Not designed | **Open** (§7, item 1) |

**Shared drawers** (open from several places): person card, unit drawer, leave card, new leave, Report 1, rule details, notifications.

### Navigation map
- **Tab bar** (`03` §1.1): commanders (users who manage a force): Today, Board, Manage, Me. Everyone else: Today, Me. No "+".
- **Action circle** (Today only, everyone) → New leave for myself.
- **Bell** (main screens, not Board) → notifications drawer.
- **Creation in context** (`03` §1.2): days selected in a calendar, timeline row or person card → tray → New leave. Availability rule and new soldier → the add icon in the capsule of their Manage page.
- **Today:**
  - Commander block: the fraction → unit drawer (tabs per unit for the company commander). A day column → Board on that day, middle stop. "דוח 1" → Report 1 drawer.
  - Selecting days in the calendar → tray → New leave or leave card.
  - "הסבב שלי ›" → Me → My rotation.
  - Each card → its source (§6).
- **Manage:** each row → inner page with a slide, with back.
  - Soldiers → person card (half → full). Long-press → "N נבחרו" tray. Add icon → Add soldiers.
  - Join requests → "זה הוא?" drawer.
  - Availability rules → rule form. Options → archive.
- **Board:** in every view, name → person card; day header or fraction → unit drawer; bar → leave card. Details in `03` §3.
- **Me:** pencil → in-place edit. Cards → My rotation, All requests. "העדפות ›" → Preferences.
- **Everywhere:** a person's name → person card.

---

## 3. Desktop rules

Already decided, applied in a single conversion pass at the end:
- **Navigation:** tab bar becomes a side rail.
- **Drawer:** becomes a side panel (not centered).
- **Manage and Settings:** list on the side, content beside it.
- **Rows:** become a table where appropriate.
- **Unit tree:** indented list on phone, hierarchical diagram on desktop.
- **Other screens:** **Open.** Recommendation: one centered column for Today and Me, since they are feeds. The Board is the exception (§5).

---

## 4. Designed screens: notes

### Screenshots (`screens/`)
All at 390×844 pt, exported @2x. Sample data is illustration.
| File | What it shows | Status |
|---|---|---|
| `היום – טלפון – לוחם` | Today · soldier · compact block | ⚠️ Older: tab bar. Block content is current |
| `היום – טלפון – לוחם – מורחב` | Today · soldier · expanded (month calendar) | ⚠️ Older: tab bar; calendar style (now the Board month component). Selection and tray behavior are current |
| `היום – טלפון – לוחם – בחירת ימים` | Today · soldier · two days selected, with tray | ⚠️ Older: tab bar; calendar style (now the Board month component). Selection and tray behavior are current |
| `יציאה חדשה – טלפון – רגיל` | New leave drawer | ⚠️ Older: tab bar ("+", dot). Screen content is current |
| `כרטיס יציאה – טלפון – בקשה ממתינה` | Leave card · pending request | ⚠️ Older: tab bar ("+", dot). Screen content is current |
| `דוח 1 – טלפון – מגירה` | Report 1 drawer (named list) | ⚠️ Older: background block; past-tense tags (now present tense) |
| `מגירת יחידה – טלפון – מ״פ` | Unit drawer · company commander, tabs per unit | ⚠️ Older: background block; header count (now a fraction); amber dot on tabs |
| `אני – טלפון – רגיל` | Me · commander · default | ⚠️ Older: tab bar ("+", dot). Screen content is current |
| `אני – טלפון – לוחם` | Me · soldier | ⚠️ Older: tab bar ("+", dot). Screen content is current |
| `אני – טלפון – מורחב` | Me · profile expanded | ⚠️ Older: tab bar ("+", dot). Screen content is current |
| `אני – טלפון – עריכת פרטים` | Me · in-place editing, incl. tags | ⚠️ Older: tab bar ("+", dot). Screen content is current |
| `אני – טלפון – הסבב שלי` | Me → My rotation | ⚠️ Older: tab bar ("+", dot). Screen content is current |
| `אני – טלפון – כל הבקשות` | Me → All requests | ⚠️ Older: tab bar ("+", dot). Screen content is current |
| `אני – טלפון – העדפות` | Me → Preferences | ⚠️ Older: tab bar ("+", dot). Screen content is current |
| `ניהול – טלפון – מ״פ` / `ניהול – טלפון – מ״מ` | Manage · by persona | ⚠️ Older: tab bar ("+", dot). Screen content is current |
| `חיילים – טלפון – מ״פ` / `חיילים – טלפון – מ״מ` | Soldiers · several units (grouped by unit) / one platoon | ⚠️ Older: tab bar; options as chips (now one options menu). List and rows are current |
| `חיילים – טלפון – בחירה מרובה` | Soldiers · multi-select with "N נבחרו" tray | ⚠️ Older: tab bar; options as chips (now one options menu). List and rows are current |
| `חיילים – טלפון – כרטיס אדם` | Person card · half height | ⚠️ Older: tab bar; "יציאה עבור" button (now: select days in the strip) |
| `הוספת חיילים – טלפון – רגיל` | Add soldiers | ⚠️ Older: tab bar; options as chips (now one options menu). List and rows are current |
| `הצטרפות – טלפון – מ״מ` / `הצטרפות – טלפון – מ״פ` | Join requests · by persona | ⚠️ Older: tab bar ("+", dot). Screen content is current |
| `הצטרפות – טלפון – זה הוא – סתירה` | "Is this him?" drawer · one candidate with conflict | ⚠️ Older: tab bar ("+", dot). Screen content is current |
| `הצטרפות – טלפון – זה הוא – כמה מועמדים` | "Which one?" drawer · several candidates | ⚠️ Older: tab bar ("+", dot). Screen content is current |
| `הצטרפות – טלפון – מ״פ – חייל חדש` | Company commander · new soldier drawer | ⚠️ Older: tab bar ("+", dot). Screen content is current |
| `כללי נוכחות – טלפון – רגיל` | Availability rules · list | ⚠️ Older: tab bar ("+", dot). Screen content is current |
| `כללי נוכחות – טלפון – פירוט כלל` | Rule drawer · view | ⚠️ Older: tab bar ("+", dot). Screen content is current |
| `כללי נוכחות – טלפון – טופס עריכה` | Rule drawer · edit form | ⚠️ Older: tab bar ("+", dot). Screen content is current |
| `כללי נוכחות – טלפון – כלל חדש` | Rule drawer · new rule | ⚠️ Older: tab bar ("+", dot). Screen content is current |
| `כללי נוכחות – טלפון – ארכיון` | Archive drawer | ⚠️ Older: tab bar ("+", dot). Screen content is current |
| `לוח – טלפון – לוח שנה` | Board · Calendar, drawer at edge stop | ✅ Current |
| `לוח – טלפון – לוח שנה – מגירה באמצע` | Board · Calendar, drawer at middle stop | ✅ Current |
| `לוח – טלפון – ציר זמן` | Board · Timeline | ✅ Current |
| `לוח – טלפון – תנועות` | Board · Movements (opens on today) | ✅ Current |

**Not shown as screenshots on purpose:** the platoon and company commander open block. Its old mockups (presence bar, forecast line, expanded chart) are superseded; the current block is in `design-language/07` (`03` §1.13).

**"Older"** means the element listed is from before `03`; build it per the "Read first" table, not per the image. Everything else in that image is current.

The tab is called "היום" (Today); the house is only its icon. There is one Today screen, not a separate "home".

### Today
- **What and for whom:** what's the situation now (one open block) and what's waiting for me (cards). Everyone.
- **Entry:** first tab and launch screen. Replaces the MVP home screen.
- **Taps:** see the navigation map (§2).
- **By permission:** the block is chosen by scope — self ("where am I"), one unit ("how many are with me"), several units ("the company today"). "דוח 1" only with `day_reports:confirm` and only when a rotation is active. Threshold coloring only when a rule applies and the user may see it.
- **Applies:** soldier and squad commander: compact and expanded in place, swipe between months. Platoon and company commander: compact only (`03` §1.13). After sending Report 1, "✓ 08:12". Tapping the tab returns to today.
- **Open:** unit drawer for a future day (verify in code).

### Me
- **What and for whom:** personal things over time. One screen for everyone.
- **Entry:** last tab. Replaces the MVP profile and preferences screens.
- **Taps:** pencil → in-place edit (✕ and ✓). Chevron → expanded. "הסבב שלי" → page. "כל הבקשות ›" → page. "העדפות ›" → page.
- **By permission:** editable fields by permission. "הוסף: X" in tags only with `tags:create`. "עבודה" (Work) in preferences only for users who may approve.
- **Applies:** the profile is my person card (one component). Unit is not edited here.
- **Open:** which fields a soldier edits themselves (verify in code).

### Manage, Soldiers, Join requests, Availability rules, Add soldiers
Full notes are in `02-design-decisions.md` → **Screen**. Additions:
- **Manage:** a row appears only with at least view permission on the tool. The number at the row's end is amber only when action is waiting.
- **Soldiers:** without `soldiers:update` no "תגיות" (Tags) in the tray. Without `memberships:update` no "העברה" (Transfer). Without `leaves:create` on those soldiers no "יציאה" (Leave).
- **Join requests:** the Manage row only with `accounts:approve`. "יצירה וקישור" only for users also permitted to create a soldier.
- **Availability rules:** toggle, form and archive by `availability_rules:*`. **Open:** the form's shape will be revisited at the end.
- **Add soldiers:** personal number and email only with `soldier_private:update`.

---

## 5. Board

Fully specified in `03-board-spec.md`: the frame (§2), Calendar, Timeline and Movements (§3), mapping to code (§4), required code changes (§5) and strings (§6). Screenshots: `screens/לוח – טלפון – *`.

- **Who sees it:** the tab only for users who manage a force.
- **Phone default view:** Calendar.
- **Table:** desktop only.
- **Desktop:** **Open — not designed.** Direction: a wide timeline as the main view, with a side panel for the person card or leave.

---

## 6. Today cards

### a. Uniform frame
Source: artboard "מבנה בלוק · תבנית".
- Title (always same place and size), icon, and a count if any.
- "⋯" only for permitted users.
- Unique content area.
- At most one primary action.
- The whole card is tappable and opens its source. No separate "go to" button.

**Content types for the unique area:**
1. **Short list with action:** up to 3 rows, same swipe as on the page.
2. **Big number:** one figure, e.g. "איתך היום · 12" (With you today · 12).
3. **Day strip:** a 14-day row in timeline language.
4. **Tracking chips:** a chip per unit, sent or not.

### b. Card list
| Card | Shows (type) | Who sees it | Primary action → destination | When empty |
|---|---|---|---|---|
| Requests to approve | Pending requests one level below you (list) | `leaves:approve` | **Open.** Card → request hub (under discussion) | Hidden |
| My request | My own open request (list) | `leaves:create` on self | Card → leave card | Hidden |
| Join requests | "N מוכנות · M לבדיקה" and up to 3 rows (list) | `accounts:approve`, when requests reach the user | "אישור N" → approves the ready ones. Card → Manage → Join requests | Hidden |
| Report 1 · company | Chip per unit (chips) | The rotation's report owner | "העתקה" (Copy) | Only during an active rotation |
| With you today | Number present (number) | Users without the Board tab | Card → unit drawer | **Open** (§7, item 2) |
| My status | Personal calendar (day strip) | Users whose block is unit-scoped | Card → Me → My rotation | Always shown |
| Leave round · planning | Reminder to plan (number) | The planner, at rotation start | → leave-round planning | **Not in v1** if planning is not in v1 |

### c. Three general decisions
- **Order:** **Open.** Recommendation: fixed order by type, with action-required first. Urgency-based order breaks the habit of where things are.
- **Empty card:** **Open.** Recommendation: one rule — hidden. That keeps "no cards = nothing waiting for you" true. The only exception is "My status".
- **Maximum count:** **Open.** Recommendation: no limit and no "show more". "One level down" already keeps the feed short.

---

## 7. Open questions with impact

1. **What stays out of v1.** Per "what isn't in v1 doesn't appear", the undesigned Manage rows drop: leave-round planning, temporary units, rotation details, switch to routine, Settings. **Open, with a cost:**
   - Without leave-round planning, most leaves are never created. Should v1 keep the existing MVP planning screen?
   - Without Settings there is nowhere to define leave types, tags and permissions. Same question: keep the existing MVP screens, or not?
2. **"With you today" for soldiers doesn't work with current permissions.** Seeing others' presence requires `leaves:view` on the unit, which also exposes type and reason. Logged in `02-design-decisions.md` → Possible code changes as a "presence only" permission. **Open:** whether this card is in v1.
3. **Board timeline drag.** The current app moves a leave by dragging it and creates a draft by dragging over empty days. The design uses day selection in a row → tray. **Open:** whether move-by-drag stays on phone; if so, its non-drag path is the leave card's edit.
4. **Availability rules archive** replaces delete (§8). Verify that rule archiving exists in code; if not, flag before building.

---

## 8. Decisions not reflected in the artboards

Everything in `02-design-decisions.md` applies. In addition:
- **Availability rules, archive:** in the capsule next to the add (+) icon, an options button with "ארכיון" and the count of archived rules. In a rule's "⋯", "העברה לארכיון" instead of "מחיקה". The archive is a drawer. Tapping a rule opens it in the same drawer with "החזרה מהארכיון". A restored rule returns to its place in the list. An archived rule stops overriding, and the "לא חל" marker of the rule below disappears.
- **Availability rules, form:** stays as-is for now; revisited at the end.
- **"Possible code changes" in `02` are not for v1.** They record ideas only.

---

## 9. Glossary

### Concepts
| English (use in code and docs) | Hebrew | Notes |
|---|---|---|
| Rotation | סבב | Service period. Code: `rotation` |
| Leave round | סבב יציאות | Alternating leave schedule. Code: leaves with `batch_id` (layer `round`). Always written in full in the UI |
| Routine mode | שגרה | Outside an active rotation |
| Leave | יציאה | Always whole days |
| Request | בקשה | A pending leave created by a soldier |
| Report 1 | דוח 1 | Daily presence report. Code: `day_reports` |
| Availability rule | כלל נוכחות / כללי נוכחות | Code: `availability_rules`. UI label is "כללי נוכחות" |
| Threshold | סף | The rule's limit, shown as a marker |
| Join request | בקשת הצטרפות | Code: accounts approval |
| Person card | כרטיס אדם | One component; Me's open block |
| Unit drawer | מגירת יחידה | Also Report 1's named list |
| Leave card | כרטיס יציאה | |
| New leave | יציאה חדשה | |
| Open block | בלוק פתוח | Top-of-screen state block, no border |
| Card | כרטיס | Bordered, tappable summary |
| Capsule | כמוסה | Glass pill in the top corner holding page tools |
| Tray | מגש | Bottom bar for a selection ("N נבחרו") |
| Fan | מניפה | Board view switcher |
| Drawer | מגירה | Bottom sheet on phone, side panel on desktop |
| Toast | הודעה קצרה | With "ביטול" (Undo) after reversible actions |
| Tag | תגית | Categories: "צבאיות" (Military), "אזרחיות" (Civilian) |
| Transfer | העברה | Close an assignment and open a new one from a date |
| Personal number | מספר אישי | Not secret; never masked |

### Personas (shorthand for typical permission sets)
| English | Hebrew |
|---|---|
| Soldier | לוחם / חייל |
| Squad commander | מ"כ |
| Platoon commander | מ"מ |
| Company commander | מ"פ |
| HQ | מפקדה |
| Squad / Platoon / Company | כיתה / מחלקה / פלוגה |

### Tabs and main UI labels
| English | Hebrew label |
|---|---|
| Today | היום |
| Board | לוח |
| Manage | ניהול |
| Me | אני |
| Settings | הגדרות |
| Preferences | העדפות |
| My rotation | הסבב שלי |
| My requests / All requests | הבקשות שלי / כל הבקשות |
| Soldiers | חיילים |
| Join requests (page title / Manage row) | הצטרפות / בקשות הצטרפות |
| Add soldiers | הוספת חיילים |
| On base / Not on base / Home | בבסיס / לא בבסיס / בבית |
| Returning today / Leaving today | חוזר היום / יוצא היום (present tense, `03` §1.11) |
| Leaving / Returning | יוצאים / חוזרים |
| Approve N / N selected | אישור N / N נבחרו |
| Undo | ביטול |
| Archive / Restore | ארכיון / החזרה מהארכיון |
| Not applied (overridden rule) | לא חל |

### Board terms
| English | Hebrew | Notes |
|---|---|---|
| Calendar / Timeline / Movements | לוח שנה / ציר זמן / תנועות | Board views (code: `calendar` / `timeline` / `list`). Icons only in the UI; use the Hebrew as accessible labels |
| Fraction | שבר | `{n}/{total}` number format |
| Impact line | שורת השפעה | `יום {day} · {n}/{total}` |
| Focus | מיקוד | Hides header and tab bar |
| Options | אפשרויות | Sort / group / filter menu |
| Leaving / Returning (today) | יוצאים / חוזרים (היום) | Present tense |

More strings: `03-board-spec.md` §6.
