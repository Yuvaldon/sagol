// Names of browser-side stores. Application data lives in IndexedDB (D-021); web storage
// holds only the development identity (D-006). Modules allowed to use web storage are
// listed in scripts/guardrails.config.ts.

const STORAGE_PREFIX = 'sagol'

/** IndexedDB database of the local data adapter. */
export const INDEXED_DB_NAME = STORAGE_PREFIX

/** `localStorage` keys. */
export const STORAGE_KEYS = {
  /** The signed-in identity of the local auth provider (D-006). */
  localIdentity: `${STORAGE_PREFIX}.local-identity`,
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]
