// Names of browser-side stores. Application data lives in IndexedDB (D-021); web storage
// holds only the development identity (D-006), the Google session (D-207) and the conveniences of one device (D-197). Modules allowed to use web storage are
// listed in scripts/guardrails.config.ts.

const STORAGE_PREFIX = 'sagol'

/** IndexedDB database of the local data adapter. */
export const INDEXED_DB_NAME = STORAGE_PREFIX

/** `BroadcastChannel` carrying committed writes between tabs (ChangeFeed). */
export const CHANGE_FEED_CHANNEL = `${STORAGE_PREFIX}.changes`

/** `localStorage` keys. */
export const STORAGE_KEYS = {
  /** The signed-in identity of the local auth provider (D-006). */
  localIdentity: `${STORAGE_PREFIX}.local-identity`,
  /** The Supabase Auth session of the Google provider: its tokens, kept by the auth client (D-207). */
  googleSession: `${STORAGE_PREFIX}.google-session`,
} as const

/**
 * The device store's keys (D-197): conveniences of one screen, each kept per signed-in soldier under
 * `<key>.<soldier id>`. Never data, never a permission.
 */
export const DEVICE_KEYS = {
  /** The day report's reasons switch (D-194). */
  dayReportReasons: `${STORAGE_PREFIX}.day-report-reasons`,
  /** The last home chosen differs from the one the permissions give (D-265). */
  homeAway: `${STORAGE_PREFIX}.home-away`,
  /** The install offer after sign-in was answered, by installing or by "not now" (D-277). */
  installAnswered: `${STORAGE_PREFIX}.install-answered`,
} as const

export type DeviceKey = (typeof DEVICE_KEYS)[keyof typeof DEVICE_KEYS]

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]
