import type { DeviceKey } from '@config'
import { useCallback, useMemo, useState } from 'react'
import { useSession } from '../session/hooks'
import { usePorts } from '../runtime/context'

// A choice remembered on this device for the signed-in soldier (D-197): a convenience of one screen. A value that does
// not read back as its type reads as the default.

export type DeviceLasting = 'local' | 'session'

export interface DeviceFlag {
  readonly value: boolean
  readonly set: (value: boolean) => void
}

const TRUE = 'true'

/** A yes or no kept under `key`, off by default; held in memory until a soldier is signed in. */
export function useDeviceFlag(key: DeviceKey, lasting: DeviceLasting = 'local'): DeviceFlag {
  const { device } = usePorts()
  const session = useSession()
  const scope = session.status === 'ready' && session.value.status === 'linked' ? session.value.soldier_id : null
  const store = device[lasting]
  // The value written here, so the screen follows at once; NULL reads the store.
  const [written, setWritten] = useState<{ scope: string | null; value: boolean } | null>(null)
  const stored = useMemo(() => (scope === null ? false : store.read(key, scope) === TRUE), [store, key, scope])
  const value = written !== null && written.scope === scope ? written.value : stored
  const set = useCallback(
    (next: boolean) => {
      setWritten({ scope, value: next })
      if (scope !== null) store.write(key, scope, next ? TRUE : null)
    },
    [store, key, scope],
  )
  return { value, set }
}
