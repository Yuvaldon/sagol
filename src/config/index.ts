// Public entry point of the CONFIG layer.
// Every non-entity constant lives here: env schema, storage keys, view ids, URL parameter
// names, breakpoints, palette and icon keys, date formats. Nothing is hardcoded elsewhere.
export { DOM } from './dom'
export { TOOLTIP } from './tooltip'
export {
  ADAPTER_OF_AUTH_MODE,
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
export { CHANGE_FEED_CHANNEL, DEVICE_KEYS, INDEXED_DB_NAME, STORAGE_KEYS, type DeviceKey, type StorageKey } from './storage'
export { INBOX, MINE } from './inbox'
export { DAY_REPORT, DAY_REPORT_CATEGORIES, type DayReportCategory } from './report'
export { PWA } from './pwa'
export { REMOTE } from './remote'
export { ROUTES, type RoutePath } from './routes'
export { STARTUP_ERROR_CODES } from './startup'
export {
  BAR_COLOR_MODES,
  BarColorMode,
  BOARD_SORT_KEYS,
  BoardSortKey,
  DATE_WINDOW,
  DEFAULT_BAR_COLOR_MODE,
  DEFAULT_BOARD_SORT_KEY,
  DEFAULT_RANGE_KIND,
  DEFAULT_SORT_ORDER,
  DEFAULT_VIEW_ID,
  RANGE_KINDS,
  RangeKind,
  SORT_ORDERS,
  SortKey,
  SortOrder,
  TABLE_SORT_KEYS,
  type TableSortKey,
  TIMELINE_DENSITY,
  TIMELINE_DRAG,
  TIMELINE_LANES,
  TIMELINE_LANES_TOUCH,
  TIMELINE_LAYOUT,
  VIEW_IDS,
  ViewId,
} from './views'
export {
  DRAG_ACTIVATION_PX,
  DROP_EDGE_FRACTION,
  NAVIGATION_SECTIONS,
  NEW_ENTITY,
  PANEL_IDS,
  SETUP_STEPS,
  type SetupStepId,
  type NavigationSectionId,
  PanelId,
  TRANSFER_FILES,
  SHEET_DISMISS,
  VIRTUAL_LIST,
} from './panels'
export { SEARCH_PARAMS, type SearchParamName } from './url'
export {
  BREAKPOINTS_PX,
  DESKTOP_BREAKPOINT,
  DESKTOP_MIN_HEIGHT_PX,
  DARK_SCHEME_MEDIA_QUERY,
  DESKTOP_MEDIA_QUERY,
  type Breakpoint,
} from './breakpoints'
export { PALETTE_KEYS, PaletteKey, isPaletteKey } from './palette'
export { ICON_KEYS, IconKeyName, isIconKey } from './icons'
export { DATE_FORMATS, DATE_LOCALE, FIRST_DAY_OF_WEEK, MAX_TIMER_DELAY_MS, type DateFormat } from './dates'
export {
  COMPANY_TEMPLATE,
  EMPTY_TEMPLATE,
  UNIT_TEMPLATE_IDS,
  UNIT_TEMPLATES,
  type TemplateBinding,
  type TemplateCount,
  type TemplateLeaveGroup,
  type TemplatePermissions,
  type TemplateRank,
  type TemplateRole,
  type TemplateRule,
  type TemplateStructure,
  type TemplateTagCategory,
  type UnitTemplate,
  type UnitTemplateId,
} from './templates'
