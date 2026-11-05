// Public entry point of the CONFIG layer.
// Every non-entity constant lives here: env schema, storage keys, view ids, URL parameter
// names, breakpoints, palette keys, date formats. Nothing is hardcoded elsewhere.
export { DOM } from './dom'
export {
  ENV_VARIABLES,
  EnvSchema,
  parseEnv,
  type Env,
  type EnvIssue,
  type EnvIssueCode,
  type EnvOptions,
  type EnvResult,
  type EnvVariable,
  type RawEnv,
} from './env'
export { INDEXED_DB_NAME, STORAGE_KEYS, type StorageKey } from './storage'
export { DEFAULT_VIEW_ID, VIEW_IDS, ViewId } from './views'
export { SEARCH_PARAMS, type SearchParamName } from './url'
export {
  BREAKPOINTS_PX,
  DESKTOP_BREAKPOINT,
  DESKTOP_MEDIA_QUERY,
  type Breakpoint,
} from './breakpoints'
export { PALETTE_KEYS, PaletteKey, isPaletteKey } from './palette'
export { DATE_FORMATS, DATE_LOCALE, FIRST_DAY_OF_WEEK, type DateFormat } from './dates'
