import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DOM } from '@config'
import { AppRoot } from '@ui'

export function mountApp(): void {
  const container = document.getElementById(DOM.rootElementId)
  if (!container) {
    throw new Error(`Root element #${DOM.rootElementId} not found`)
  }
  createRoot(container).render(
    <StrictMode>
      <AppRoot />
    </StrictMode>,
  )
}
