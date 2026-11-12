import { useSyncExternalStore } from 'react'
import type { InstallOffer } from '../ports'
import { usePorts } from '../runtime/context'

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
