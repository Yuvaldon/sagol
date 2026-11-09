import { DESKTOP_MEDIA_QUERY } from '@config'
import { useSyncExternalStore } from 'react'

// Whether the screen is desktop (D-074). CSS decides most layout by itself; this is for the few places
// where the arrangement differs in structure (the bars, D-108) or a number must follow it (row heights).

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined
  const query = window.matchMedia(DESKTOP_MEDIA_QUERY)
  query.addEventListener('change', onChange)
  return () => {
    query.removeEventListener('change', onChange)
  }
}

function snapshot(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP_MEDIA_QUERY).matches
}

export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
