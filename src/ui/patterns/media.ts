import { DARK_SCHEME_MEDIA_QUERY, DESKTOP_MEDIA_QUERY } from '@config'
import type { ViewDevice } from '@logic'
import { useSyncExternalStore } from 'react'

// Media queries the screen follows live. CSS decides most layout by itself; this is for the few places where a number
// must follow it (row heights, icon sizes), or the device's color
// scheme picks the theme (D-181).

function subscribeTo(media: string) {
  return (onChange: () => void): (() => void) => {
    if (typeof window.matchMedia !== 'function') return () => undefined
    const query = window.matchMedia(media)
    query.addEventListener('change', onChange)
    return () => {
      query.removeEventListener('change', onChange)
    }
  }
}

function snapshotOf(media: string) {
  return (): boolean => typeof window.matchMedia === 'function' && window.matchMedia(media).matches
}

const desktop = { subscribe: subscribeTo(DESKTOP_MEDIA_QUERY), snapshot: snapshotOf(DESKTOP_MEDIA_QUERY) }
const darkScheme = { subscribe: subscribeTo(DARK_SCHEME_MEDIA_QUERY), snapshot: snapshotOf(DARK_SCHEME_MEDIA_QUERY) }

export function useIsDesktop(): boolean {
  return useSyncExternalStore(desktop.subscribe, desktop.snapshot, () => false)
}

/** The device whose view the board opens on when the URL names none (D-290). */
export function useViewDevice(): ViewDevice {
  return useIsDesktop() ? 'desktop' : 'phone'
}

/** Whether the device asks for a dark screen, following a change while the screen is open. */
export function useDeviceIsDark(): boolean {
  return useSyncExternalStore(darkScheme.subscribe, darkScheme.snapshot, () => false)
}
