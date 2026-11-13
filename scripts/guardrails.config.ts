// Configuration of the custom guardrail scans (scripts/check-*.ts, scripts/lint-custom.ts).
// Paths are POSIX, relative to the repository root, and matched as prefixes.
// Widening an allow-list is an architectural change: record the reason in docs/DECISIONS.md.

export const SOURCE_ROOT = 'src'

/** The layer of files directly under `src/` (`src/main.tsx`, D-075). */
export const ENTRY_POINT_LAYER = 'app'

/** Layers that may share one commit (D-025, D-075, D-357). Sorted alphabetically. */
export const ALLOWED_LAYER_PAIRS: readonly (readonly string[])[] = [
  ['app', 'i18n'],
  ['i18n', 'ui'],
]

/**
 * Layers whose strings can be Tailwind classes, so the class rules apply to them. Elsewhere a
 * string such as a Dexie compound key (`[role_id+resource]`) is not a class (D-086).
 */
export const CLASS_NAMES_LIVE_IN: readonly string[] = ['src/ui/', 'src/app/']

/** Raw colors (hex, rgb(), oklch(), ...) may appear only where theme tokens are defined. */
export const RAW_COLOR_ALLOWED_IN: readonly string[] = ['src/ui/theme/']

/**
 * The JavaScript `Date` may be used only inside the date adapter, the one `TimeSource`
 * (D-083). `@internationalized/date` is the only date library (D-026).
 */
export const RAW_DATE_ALLOWED_IN: readonly string[] = ['src/app/time/']

/**
 * `localStorage` / `sessionStorage` allowed modules: the local identity (D-006, D-074) and the device store of
 * one screen's conveniences (D-197). Data lives in IndexedDB (D-021).
 */
export const WEB_STORAGE_ALLOWED_IN: readonly string[] = ['src/data/local/identity/', 'src/data/device/']

/** Folders whose files are pure engine logic: never `.tsx` (ARCHITECTURE "View engines"). */
export const PURE_CORE_FOLDER = /(^|\/)core\//

/** JSX attributes whose value is shown or read to the user, so it must come from i18n. */
export const USER_FACING_ATTRIBUTES: readonly string[] = [
  'alt',
  'aria-description',
  'aria-label',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
  'label',
  'placeholder',
  'title',
]

/**
 * i18n layer contract used by scripts/check-i18n.ts. The i18n entry point exports the
 * Hebrew dictionary object and the key type derived from it (D-025).
 */
export const I18N = {
  entry: 'src/i18n/index.ts',
  folder: 'src/i18n/',
  dictionaryExport: 'dictionary',
  keyType: 'I18nKey',
}
