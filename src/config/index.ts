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
export { CHANGE_FEED_CHANNEL, INDEXED_DB_NAME, STORAGE_KEYS, type StorageKey } from './storage'
export { ROUTES, type RoutePath } from './routes'
export { STARTUP_ERROR_CODES } from './startup'
export { DATE_WINDOW, DEFAULT_VIEW_ID, TIMELINE_LAYOUT, VIEW_IDS, ViewId } from './views'
export {
  DRAG_ACTIVATION_PX,
  DROP_EDGE_FRACTION,
  NEW_ENTITY,
  PANEL_IDS,
  PanelId,
  SHEET_DISMISS,
  VIRTUAL_LIST,
} from './panels'
export { SEARCH_PARAMS, type SearchParamName } from './url'
export {
  BREAKPOINTS_PX,
  DESKTOP_BREAKPOINT,
  DESKTOP_MEDIA_QUERY,
  type Breakpoint,
} from './breakpoints'
export { PALETTE_KEYS, PaletteKey, isPaletteKey } from './palette'
export { DATE_FORMATS, DATE_LOCALE, FIRST_DAY_OF_WEEK, type DateFormat } from './dates'
