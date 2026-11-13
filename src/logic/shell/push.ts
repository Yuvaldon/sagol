import { SoldierPreferences, type NotificationKind, type Result } from '@contracts'
import { useMutation } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import type { PushAvailability, PushPort, DataPort } from '../ports'
import { usePorts } from '../runtime/context'
import { useMyPreferences, useUpdateMyPreferences, type PreferenceSaved } from '../session/preferences'

// Phone notifications on this device (D-354, D-356): the browser's answer, and the server's record of the install.

const DONE: Result<null> = { ok: true, value: null }
const UNAVAILABLE: Result<null> = { ok: false, error: { code: 'unavailable' } }

/** Unsubscribes the browser, then forgets the install on the server; nothing to do when the browser had none. */
async function forgetDevice(push: PushPort, data: DataPort): Promise<Result<null>> {
  const endpoint = await push.disable()
  if (endpoint === null) return DONE
  const result = await data.commands.notifications.unsubscribe({ endpoint })
  return result.ok ? DONE : result
}

async function enableDevice(push: PushPort, data: DataPort): Promise<Result<null>> {
  const install = await push.enable()
  // No permission: the browser's answer is the state the switch shows (denied or off).
  if (install === null) return DONE
  const result = await data.commands.notifications.subscribe(install)
  if (result.ok) return DONE
  // The server refused it: the browser keeps no subscription the server does not know.
  await push.disable().catch(() => null)
  return result
}

export interface DeviceNotifications {
  readonly availability: PushAvailability
  /** Asks the browser, then records the install; a refused permission is not a failure. */
  readonly enable: () => Promise<Result<null>>
  /** Unsubscribes the browser, then the server (D-354). */
  readonly disable: () => Promise<Result<null>>
  readonly isPending: boolean
}

/** The "התראות במכשיר הזה" switch (D-354). */
export function useDeviceNotifications(): DeviceNotifications {
  const { push, data } = usePorts()
  const availability = useSyncExternalStore(push.subscribe, push.current)
  const mutation = useMutation({
    mutationFn: (on: boolean): Promise<Result<null>> =>
      (on ? enableDevice(push, data) : forgetDevice(push, data)).catch(() => UNAVAILABLE),
  })
  return {
    availability,
    enable: () => mutation.mutateAsync(true),
    disable: () => mutation.mutateAsync(false),
    isPending: mutation.isPending,
  }
}

/** Sign-out's first step (D-356): best effort, so a failure here never keeps the soldier signed in. */
export function forgetThisDevice(push: PushPort, data: DataPort): Promise<void> {
  return forgetDevice(push, data).then(
    () => undefined,
    () => undefined,
  )
}

export interface NotificationKinds {
  /** NULL while the preferences cannot be read, so the choice is not offered (D-076). */
  readonly kinds: Readonly<Record<NotificationKind, boolean>> | null
  readonly setKind: (kind: NotificationKind, on: boolean) => Promise<PreferenceSaved>
}

/** Which kinds the soldier wants, on every device they subscribed (D-356). */
export function useNotificationKinds(): NotificationKinds {
  const preferences = useMyPreferences()
  const save = useUpdateMyPreferences()
  const kinds = preferences.status === 'ready' ? preferences.value.notifications : null
  return {
    kinds,
    setKind: (kind, on) => save.run({ notifications: { ...(kinds ?? SoldierPreferences.parse({}).notifications), [kind]: on } }),
  }
}
