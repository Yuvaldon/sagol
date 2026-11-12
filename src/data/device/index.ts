import type { DeviceKey } from '@config'

// The device store (D-197): conveniences of one screen, kept on this device only, never data and never a permission.
// One of the two folders allowed to touch web storage (D-074). A value is a string; its reader decides its type.

/** One kind of web storage: what lasts on the device, or what lasts the session of one tab. */
export interface DeviceStore {
  /** The value under `key` for `scope`, the signed-in soldier; null when none, or when storage is unavailable. */
  readonly read: (key: DeviceKey, scope: string) => string | null
  /** Keeps `value` under `key` for `scope`; null forgets it. A storage that refuses is ignored: a convenience is lost, nothing more. */
  readonly write: (key: DeviceKey, scope: string, value: string | null) => void
}

/** A store over one web storage, read each time, so a storage that throws on access only loses the convenience. */
export function deviceStoreOver(storage: () => Storage): DeviceStore {
  const at = (key: DeviceKey, scope: string) => `${key}.${scope}`
  return {
    read(key, scope) {
      try {
        return storage().getItem(at(key, scope))
      } catch {
        return null
      }
    },
    write(key, scope, value) {
      try {
        if (value === null) storage().removeItem(at(key, scope))
        else storage().setItem(at(key, scope), value)
      } catch {
        // Private browsing or a full quota: the choice is not remembered.
      }
    },
  }
}

/** The browser's two stores: `local` lasts on the device, `session` until the tab closes. */
export function browserDeviceStores(): { readonly local: DeviceStore; readonly session: DeviceStore } {
  return { local: deviceStoreOver(() => localStorage), session: deviceStoreOver(() => sessionStorage) }
}
