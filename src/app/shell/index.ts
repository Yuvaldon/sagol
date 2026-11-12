import { PWA } from '@config'
import type { ShellPort, ShellState } from '@logic'
import { Workbox } from 'workbox-window'

// The app's shell in the browser (D-183, D-184): the service worker of a production build and the install offer.
// It starts before the env is read, because the browser offers the install once, early, and only to a page that
// listens by then.

/** Chrome's install event, which the DOM's types do not name. */
interface InstallPromptEvent extends Event {
  readonly prompt: () => Promise<void>
  readonly userChoice: Promise<unknown>
}

function isInstallPrompt(event: Event): event is InstallPromptEvent {
  return 'prompt' in event && typeof event.prompt === 'function'
}

function isStandalone(): boolean {
  const iosStandalone = 'standalone' in navigator && navigator.standalone === true
  return iosStandalone || matchMedia(PWA.standaloneMediaQuery).matches
}

/** An iPad reports itself as a Mac with touch since iPadOS 13. */
function isIos(): boolean {
  return PWA.iosUserAgent.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function createBrowserShell({ registerWorker }: { readonly registerWorker: boolean }): ShellPort {
  const listeners = new Set<() => void>()
  let deferred: InstallPromptEvent | null = null
  let workbox: Workbox | null = null
  let state: ShellState = { updateReady: false, install: !isStandalone() && isIos() ? 'ios_hint' : 'none' }

  function change(next: Partial<ShellState>): void {
    state = { ...state, ...next }
    for (const listener of listeners) listener()
  }

  addEventListener('beforeinstallprompt', (event) => {
    if (!isInstallPrompt(event)) return
    // The browser's own mini bar stays away; the user menu offers the install instead (D-184).
    event.preventDefault()
    deferred = event
    change({ install: 'prompt' })
  })
  addEventListener('appinstalled', () => {
    deferred = null
    change({ install: 'none' })
  })

  // A reload happens only for the soldier who asked for it (D-183): another tab's update makes this one offer it.
  let updateRequested = false
  const reload = (): void => {
    location.reload()
  }

  if (registerWorker && 'serviceWorker' in navigator) {
    const worker = new Workbox(PWA.serviceWorkerPath)
    worker.addEventListener('waiting', () => {
      change({ updateReady: true })
    })
    worker.addEventListener('controlling', () => {
      if (updateRequested) reload()
      else change({ updateReady: true })
    })
    worker.register().then(
      () => {
        setInterval(() => {
          // An offline tick fails; the next one asks again.
          worker.update().catch(() => undefined)
        }, PWA.updateCheckMs)
      },
      // A browser that refuses workers (a private window) runs the app from the network, as before V18.
      () => undefined,
    )
    workbox = worker
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    current: () => state,
    applyUpdate() {
      if (workbox === null || updateRequested) return
      updateRequested = true
      navigator.serviceWorker.getRegistration().then(
        (registration) => {
          const waiting = registration?.waiting
          // Already active (another tab took it): a reload is all that is left.
          if (!waiting) return reload()
          // A page the worker does not control (a hard reload) hears no `controlling`, so it waits for activation.
          waiting.addEventListener('statechange', () => {
            if (waiting.state === 'activated') reload()
          })
          workbox?.messageSkipWaiting()
        },
        reload,
      )
    },
    async install() {
      const event = deferred
      if (event === null) return
      deferred = null
      // The browser makes an offer once, used or refused, so the item goes either way (D-076).
      try {
        await event.prompt()
        await event.userChoice
      } finally {
        change({ install: 'none' })
      }
    },
  }
}
