import { DARK_SCHEME_MEDIA_QUERY, DESKTOP_MEDIA_QUERY, WIDE_PHONE_MEDIA_QUERY } from '@config'
import { useSyncExternalStore } from 'react'

// Media queries the screen follows live. CSS decides most layout by itself; this is for the few places where the
// arrangement differs in structure (the bars, D-108), a number must follow it (row heights), or the device's color
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
const widePhone = { subscribe: subscribeTo(WIDE_PHONE_MEDIA_QUERY), snapshot: snapshotOf(WIDE_PHONE_MEDIA_QUERY) }
const darkScheme = { subscribe: subscribeTo(DARK_SCHEME_MEDIA_QUERY), snapshot: snapshotOf(DARK_SCHEME_MEDIA_QUERY) }

export function useIsDesktop(): boolean {
  return useSyncExternalStore(desktop.subscribe, desktop.snapshot, () => false)
}

/** Whether a phone's top bar is wide enough to hold the scope, the view and the filters too (D-190). Read it only
 * below the desktop layout. */
export function useIsWidePhone(): boolean {
  return useSyncExternalStore(widePhone.subscribe, widePhone.snapshot, () => false)
}

/** Whether the device asks for a dark screen, following a change while the screen is open. */
export function useDeviceIsDark(): boolean {
  return useSyncExternalStore(darkScheme.subscribe, darkScheme.snapshot, () => false)
}
