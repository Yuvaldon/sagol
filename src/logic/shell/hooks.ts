import { DEVICE_KEYS } from '@config'
import { useCallback, useSyncExternalStore } from 'react'
import { useDeviceFlag } from '../device/hooks'
import type { InstallOffer } from '../ports'
import { usePorts } from '../runtime/context'
import { useSession } from '../session/hooks'

function useShellState() {
  const { shell } = usePorts()
  return useSyncExternalStore(shell.subscribe, shell.current)
}

/** Whether a new version waits, and the reload that switches to it (D-183). */
export function useAppUpdate(): { readonly ready: boolean; readonly reload: () => void } {
  const { shell } = usePorts()
  return { ready: useShellState().updateReady, reload: shell.applyUpdate }
}

/** What the user menu can offer for installing the app (D-184). */
export function useInstallOffer(): { readonly offer: InstallOffer; readonly install: () => Promise<void> } {
  const { shell } = usePorts()
  return { offer: useShellState().install, install: shell.install }
}

/**
 * The one-time install offer after sign-in (D-277): what the device can offer, while the signed-in soldier has not
 * answered it on this device. Installing or "not now" answers it for good; the user menu keeps the install (D-184).
 * The flag is read only for a linked soldier, so the offer is never on the sign-in screen.
 */
export function useInstallInvitation(): {
  readonly offer: InstallOffer
  readonly install: () => Promise<void>
  readonly answer: () => void
} {
  const { offer, install } = useInstallOffer()
  const answered = useDeviceFlag(DEVICE_KEYS.installAnswered)
  const session = useSession()
  const linked = session.status === 'ready' && session.value.status === 'linked'
  const { set } = answered
  const answer = useCallback(() => {
    set(true)
  }, [set])
  return { offer: linked && !answered.value ? offer : 'none', install, answer }
}
