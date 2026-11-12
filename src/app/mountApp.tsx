import { DOM, STARTUP_ERROR_CODES } from '@config'
import { LogicProvider } from '@logic'
import { FailureScreen, LoadingScreen, OfflineScreen, StartupFailureScreen, UiRoot, UpdateToast } from '@ui'
import { StrictMode, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { composePorts } from './composition'
import { readEnv } from './env'
import { AppRouter } from './router'
import { createBrowserShell } from './shell'

function render(root: Root, content: ReactNode): void {
  root.render(
    <StrictMode>
      <UiRoot>{content}</UiRoot>
    </StrictMode>,
  )
}

/**
 * The shell starts first, so the browser's install offer and a waiting version are heard from the first moment
 * (D-183, D-184). The env is parsed next, and the app does not start on an invalid one (D-074). The ports are
 * built before the router mounts, so a returning sign-in has settled first (D-207). A remote build without a
 * network waits on the offline screen and starts by itself when the network returns (D-185).
 */
export function mountApp(): void {
  const shell = createBrowserShell({ registerWorker: import.meta.env.PROD })
  const container = document.getElementById(DOM.rootElementId)
  if (!container) throw new Error(STARTUP_ERROR_CODES.rootElementMissing)
  const root = createRoot(container)
  const env = readEnv()
  if (!env.ok) {
    render(root, <StartupFailureScreen issues={env.issues} />)
    return
  }
  const needsNetwork = env.value.authMode !== 'local'
  let composing = false
  const start = (): void => {
    if (composing) return
    if (needsNetwork && !navigator.onLine) {
      render(root, <OfflineScreen onRetry={start} />)
      return
    }
    composing = true
    render(root, <LoadingScreen />)
    composePorts(env.value, location.origin, shell).then(
      (ports) => {
        render(
          root,
          <LogicProvider ports={ports}>
            <AppRouter />
            <UpdateToast />
          </LogicProvider>,
        )
      },
      () => {
        composing = false
        render(root, navigator.onLine ? <FailureScreen error={{ code: 'unavailable' }} /> : <OfflineScreen onRetry={start} />)
      },
    )
  }
  if (needsNetwork) addEventListener('online', start)
  start()
}
