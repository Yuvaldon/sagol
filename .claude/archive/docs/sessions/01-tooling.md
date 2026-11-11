# Session 0.2 — Tooling and guardrails

Date: 2026-11-03 · Track: tooling · No contracts/domain/data/logic/ui feature code written.
Roadmap row: 0.2 · Commits: `chore: enforce LF line endings with .gitattributes`,
`build(tooling): add session 0.2 guardrails`, `docs: session 0.2 decisions and handoff`.

## Done

- **Line endings:** `.gitattributes` (`* text=auto eol=lf`, binaries marked). Renormalized;
  every file was already LF in the index, so the renormalization changed nothing.
- **Node:** `.nvmrc` 24.12.0, `engines` `>=24.12.0 <25`, `.npmrc` `engine-strict` +
  `save-exact` (D-037).
- **Libraries (D-026, D-034), pinned exact:** TanStack Router/Query/Table/Virtual/Form,
  react-aria-components, @internationalized/date, motion, @dnd-kit core/sortable/utilities,
  zod, dexie, lucide-react. Dev: Vitest, Testing Library (react, dom, user-event,
  jest-dom), jsdom, Playwright, @axe-core/playwright, lefthook. Existing caret ranges
  were pinned to the installed versions.
- **Layers:** empty `src/domain/index.ts` and the `@domain` alias. Stale comments in
  `contracts/index.ts` (now Zod, D-020) and `data/index.ts` (now IndexedDB, D-021) fixed.
- **`.dependency-cruiser.cjs`** rewritten for `contracts ← domain ← data|logic ← ui ← app`:
  contracts → zod only; domain → contracts + @internationalized/date (D-035);
  config → contracts + zod; i18n → nothing; public `index.ts` only; entry point → app
  only; no circular deps; no unresolvable imports. Inside `ui`: engines never import each
  other (except the registry) nor modules; `core` never imports React-bound packages nor
  anything outside its own core folder; only engine `adapter` folders import
  contracts/logic.
- **Tailwind:** `@theme` resets `--color-*`, `--spacing` and `--spacing-*`. No tokens defined.
- **Lint (`npm run lint`)**: oxlint with `--deny-warnings`: no `any`, no non-null
  assertions, no type assertions except in data, engine adapters and tests (D-036), hooks
  rules + exhaustive deps, `jsx-no-literals` (children and `{'...'}`). oxlint has no rule
  for literal user-facing attributes, so `scripts/lint-custom.ts` adds
  `jsx-attribute-literal` (`aria-label`, `title`, `placeholder`, `alt`, ...) and
  `core-no-jsx` (no `.tsx` inside `core/`).
- **`scripts/check-raw-values.ts`**: hex and color functions outside `src/ui/theme/`,
  arbitrary Tailwind values (`w-[13px]`, `bg-(--x)`, arbitrary variants), physical
  direction classes and CSS properties, default palette and numeric spacing classes
  (the scale is reset, so they would silently render nothing), `Date` outside the date
  adapter, `localStorage`/`sessionStorage` outside allowed modules. Scans string literals
  and template parts in TS/TSX, and CSS (comments ignored, `@apply` included).
- **`scripts/check-i18n.ts`**: reads the dictionary key paths through the type checker
  and reports unused keys, missing keys (literals contextually typed `I18nKey` but absent)
  and dynamic template keys.
- All scan allow-lists live in `scripts/guardrails.config.ts`.
- **`npm run check`** = typecheck + lint + layers + raw values + i18n + tests.
- **Vitest** has two projects: `unit` (node, `*.test.ts`) and `dom` (jsdom, `*.test.tsx`,
  `vitest.setup.ts` with jest-dom and cleanup).
- **`.env.example`**: `VITE_AUTH_MODE`, `VITE_DATA_ADAPTER`, `VITE_REMOTE_URL`,
  `VITE_REMOTE_ANON_KEY`, and a note on server-only `BOOTSTRAP_OWNER_EMAIL`. `.env*` is
  git-ignored except the example.
- **Production-build guard**: the Vite plugin `sagol:production-env-guard` refuses a
  `production`-mode build when `VITE_AUTH_MODE=local` (from `.env*` files or the process
  environment).
- **lefthook** (installed by `npm install` via `prepare`). pre-commit runs typecheck,
  oxlint + lint-custom, and depcruise on staged files. commit-msg runs
  `scripts/check-commit-msg.ts` (Conventional Commits).
- **CI** `.github/workflows/ci.yml`: Node from `.nvmrc`, `npm ci`, `npm run check`,
  `npm run build`. Playwright is added once the UI exists.
- **Handoff template**: `docs/sessions/TEMPLATE.md`, including the commit conventions.

## Decisions (asked and approved by the product owner)

- D-034 lucide-react is the icon library.
- D-035 domain may import `@internationalized/date` (amends D-007). ARCHITECTURE table updated.
- D-036 type assertions are allowed only in data, engine adapters and tests.
- D-037 Node 24 LTS, exact versions.

## Checks

- `npm install`, `npm run check` and `npm run build` are green.
- Each guardrail was shown to fail on a deliberate violation, which was then reverted:
  - lint: `any`, `!`, `as`, JSX text, `{'...'}`, `aria-label="..."`, `title={'...'}`;
    `as` in `src/data/**` passes.
  - layers (13 violations in one probe): ui→domain, deep import, engine view→contracts,
    circular logic files, engine→module, engine→engine, domain→config, domain→dexie,
    core→react, core→other folders, contracts→dexie. zod in contracts and
    registry→engine were allowed.
  - core `.tsx` file; raw values (18 findings across TS and CSS; CSS comments ignored).
  - i18n: unused, missing and dynamic keys; `tsc` also rejects the missing key.
  - `VITE_AUTH_MODE=local vite build` is refused; `--mode development` still builds.
  - Tailwind reset: `bg-red-500` and `p-4` produce no CSS while `flex` does, and there are
    no `--color-*` or `--spacing` variables in the bundle.
  - Hooks: the pre-commit hook blocked a staged `any` and a domain→config import, and the
    commit-msg hook blocked "added node version".

## Open items

- **Env schema stub** (named in the roadmap row): not written, because it is `config`
  code. It belongs to session 1.4. The build guard reads `VITE_AUTH_MODE` directly and
  lists `local` in `vite.config.ts`. Once contracts (1.1) defines the auth-mode enum,
  replace that list with the enum (tooling follow-up, or in 4.2).
- `src/app/mountApp.tsx` throws a hardcoded English error message. Session 4.2 (app)
  should make it an error code.
- `RAW_DATE_ALLOWED_IN` is empty. The session that writes the date adapter adds its path
  to `scripts/guardrails.config.ts` and records the location in DECISIONS.
- The `I18nKey` / `dictionary` export names are the convention expected by
  `check-i18n` (configurable in `guardrails.config.ts`). UI 4.1 creates them.
- Playwright browsers are not downloaded, and there is no Playwright config or CI job yet.
  Add them with the first UI.
- `fake-indexeddb` (for Dexie tests under Node) is not in D-026. Session 2.1 should
  decide on it and add it.
- No git remote yet, so CI has never run on GitHub.
- A production build reads `.env.local`. A developer whose `.env.local` sets
  `VITE_AUTH_MODE=local` gets the guard error from `npm run build`. This is intended, and
  `vite build --mode development` builds locally.

## Input for the next session (1.1 contracts)

- `@contracts` may import only `zod` (4.6.7). Everything else fails `check:layers`.
- `as` is a lint error in contracts. Use `z.infer` and annotations, plus `satisfies` where
  needed.
- Tests go next to the code as `*.test.ts` (Vitest `unit` project).
- Run `npm run check` before committing. The hooks run the fast subset.
