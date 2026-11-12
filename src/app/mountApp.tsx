import { DOM, STARTUP_ERROR_CODES } from '@config'
import { LogicProvider } from '@logic'
import { FailureScreen, LoadingScreen, StartupFailureScreen, UiRoot } from '@ui'
import { StrictMode, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { composePorts } from './composition'
import { readEnv } from './env'
import { AppRouter } from './router'

function render(root: Root, content: ReactNode): void {
  root.render(
    <StrictMode>
      <UiRoot>{content}</UiRoot>
    </StrictMode>,
  )
}

/**
 * The env is parsed first, and the app does not start on an invalid one (D-074). The ports are
 * built before the router mounts, so a returning sign-in has settled first (D-207).
 */
export function mountApp(): void {
  const container = document.getElementById(DOM.rootElementId)
  if (!container) throw new Error(STARTUP_ERROR_CODES.rootElementMissing)
  const root = createRoot(container)
  const env = readEnv()
  if (!env.ok) {
    render(root, <StartupFailureScreen issues={env.issues} />)
    return
  }
  render(root, <LoadingScreen />)
  composePorts(env.value, location.origin).then(
    (ports) => {
      render(
        root,
        <LogicProvider ports={ports}>
          <AppRouter />
        </LogicProvider>,
      )
    },
    () => {
      render(root, <FailureScreen error={{ code: 'unavailable' }} />)
    },
  )
}
