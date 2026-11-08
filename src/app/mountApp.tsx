import { DOM, STARTUP_ERROR_CODES } from '@config'
import { LogicProvider } from '@logic'
import { StartupFailureScreen, UiRoot } from '@ui'
import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { composePorts } from './composition'
import { readEnv } from './env'
import { AppRouter } from './router'

/** The env is parsed first, and the app does not start on an invalid one (D-074). */
function startupContent(): ReactNode {
  const env = readEnv()
  if (!env.ok) return <StartupFailureScreen failure={{ kind: 'invalid_env', issues: env.issues }} />
  const ports = composePorts(env.value)
  if (ports === null) return <StartupFailureScreen failure={{ kind: 'not_built' }} />
  return (
    <LogicProvider ports={ports}>
      <AppRouter />
    </LogicProvider>
  )
}

export function mountApp(): void {
  const container = document.getElementById(DOM.rootElementId)
  if (!container) throw new Error(STARTUP_ERROR_CODES.rootElementMissing)
  createRoot(container).render(
    <StrictMode>
      <UiRoot>{startupContent()}</UiRoot>
    </StrictMode>,
  )
}
