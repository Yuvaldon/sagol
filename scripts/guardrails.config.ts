// Configuration of the custom guardrail scans (scripts/check-*.ts, scripts/lint-custom.ts).
// Paths are POSIX, relative to the repository root, and matched as prefixes.
// Widening an allow-list is an architectural change: record the reason in docs/DECISIONS.md.

export const SOURCE_ROOT = 'src'

/** Raw colors (hex, rgb(), oklch(), ...) may appear only where theme tokens are defined. */
export const RAW_COLOR_ALLOWED_IN: readonly string[] = ['src/ui/theme/']

/**
 * The JavaScript `Date` may be used only inside the date adapter. `@internationalized/date`
 * is the only date library (D-026). Empty until the session that writes the adapter adds it.
 */
export const RAW_DATE_ALLOWED_IN: readonly string[] = []

/** `localStorage` / `sessionStorage` allowed modules. Data lives in IndexedDB (D-021). */
export const WEB_STORAGE_ALLOWED_IN: readonly string[] = []

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
 * Hebrew dictionary object and the key type derived from it (D-025). Until UI session 4.1
 * creates them, the check reports zero keys and passes.
 */
export const I18N = {
  entry: 'src/i18n/index.ts',
  folder: 'src/i18n/',
  dictionaryExport: 'dictionary',
  keyType: 'I18nKey',
}
