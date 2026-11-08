# Sagol — Design language

Derived from what is built (D-024), from the Stone 3 direction (D-077). It binds all later UI work.
**First version, from V0:** sign-in, onboarding and the workspace frame. V1 settles it with the
drawer/sheet, the form pattern and the palette keys. Values live in `src/ui/theme/tailwind.css`, and
this file says how to use them.

## Rules

- **Only tokens.** Tailwind's default palette, spacing, type, radius and shadow scales are reset. A
  value that is missing becomes a token. It never becomes an arbitrary class (`npm run check:raw-values`).
- **Only logical direction.** `ms-`, `pe-`, `start-`, `end-`, `text-start`. The layout is RTL.
- **Technical values read left to right.** Emails, time zones and variable names take `dir="ltr"`.
- **Every string comes from `@i18n`.** A component prop that takes text takes an `I18nKey`, and its name
  ends in `Key` (`titleKey`, `labelKey`).
- **No dead controls (D-076).** A control appears only when its action works end to end.
- **Status is carried by form as well as color** (solid, dashed, badge), so color is never the only
  signal. Timeline bars arrive in V4.

## Color (Light)

| Token | Use |
|-------|-----|
| `canvas` | The page behind everything |
| `surface` | The viewport and inputs |
| `line` | Hairlines and input borders |
| `text`, `text-muted` | Body and secondary text. Both pass 4.5:1 on `canvas` and `surface` |
| `inner` | The soft fill of a quiet control inside a glass bar |
| `action-solid`, `on-action`, `focus` | Solid action fallback, text on action, focus ring |
| `status-approved`, `status-pending`, `status-rejected` | Status. `status-rejected` is also field errors |
| `status-pending-text` | Pending as text. `status-pending` is below 4.5:1 and is for borders only (OI-033) |
| `marker`, `marker-ink`, `today` | Timeline, from V3 and V4 |

## Glass

Four surfaces, each with a solid fallback under `prefers-reduced-transparency`:

| Utility | Use |
|---------|-----|
| `glass-bar` | Floating navigation |
| `glass-card` | A sheet on the canvas (sign-in, onboarding, full-screen states) |
| `glass-menu` | Popovers: menus and option lists |
| `glass-action` | The primary action, dark glass |

Use one primary action per surface.

## Type

Heebo, self-hosted (D-077). `text-title` 24 bold for a screen's one heading, `text-body` 15,
`text-name` 13 for hints and short messages, `text-control` 12.5 for controls, `text-label` 11.5 for
field labels and errors, `text-micro` 11. Inputs are `text-input` 16 on mobile, because a smaller input
makes phones zoom the page, and `text-control` from `md`.

## Size and shape

- **Spacing:** `2xs` 2, `xs` 4, `sm` 8, `md` 12, `lg` 16, `xl` 24, `2xl` 32.
- **Controls:** `control` 30 on desktop, `touch` 44 on mobile (`min-h-touch md:min-h-control`, OI-033).
  The primary action is `bar` 40 on desktop. A test measures every visible control on mobile.
- **Radius:** `bar` 6, `control` 10, `panel` 16, `pill` 20, `sheet` 24.

## Layout

- **Workspace (D-023):** a `surface` panel on the `canvas`. One glass bar floats over it, at the bottom
  on mobile and at the top from `md`. Controls join the bar as their slices build them.
- **Outside the workspace:** one `glass-card` centered on the canvas (`CenteredSheet`), at most `sheet`
  420 wide.

## Components so far

| Component | Where | Notes |
|-----------|-------|-------|
| `Button` | `ui/primitives` | `primary` or `quiet` |
| `TextField`, `SearchSelectField` | `ui/primitives` | Label, value, one error. They know nothing about forms |
| `CenteredSheet` | `ui/patterns` | Full-screen state with a title and an optional hint |
| `validatorResult`, `fieldError` | `ui/patterns` | Field issues (D-068) in TanStack Form |
| `UserMenu`, `IdentityList` | `ui/shell` | Who is signed in, sign-out, dev identity switcher |

Errors are shown through `ui/errors/messages.ts`, whose maps from code to i18n are total: a new code does
not compile until it has a message.
