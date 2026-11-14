import { SubscribePushInput } from '@contracts'
import type { PushAvailability, PushPort } from '@logic'
import { isIos, isStandalone } from './device'

// The browser's side of phone notifications (D-351, D-356): its permission and its one push subscription, kept by
// the service worker. It is built with the env, apart from the shell, because without the public key there is
// nothing to offer and the profile shows no group (D-076).

const UNSUPPORTED: PushPort = {
  subscribe: () => () => undefined,
  current: () => 'unsupported',
  enable: () => Promise.resolve(null),
  disable: () => Promise.resolve(null),
}

/** The unpadded base64url key of the env as the bytes the push service wants. */
function keyBytes(key: string): Uint8Array<ArrayBuffer> {
  const base64 = key.replaceAll('-', '+').replaceAll('_', '/')
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

/** The install as the server stores it; NULL for a subscription the contract would refuse (not https). */
function installOf(subscription: PushSubscription): SubscribePushInput | null {
  const json = subscription.toJSON()
  const parsed = SubscribePushInput.safeParse({ endpoint: json.endpoint, p256dh: json.keys?.['p256dh'], auth: json.keys?.['auth'] })
  return parsed.success ? parsed.data : null
}

function supportsPush(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function createBrowserPush(publicKey: string | null): PushPort {
  if (publicKey === null) return UNSUPPORTED
  // Safari on iOS offers push to the installed app only (iOS 16.4).
  if (isIos() && !isStandalone()) return { ...UNSUPPORTED, current: () => 'ios_install' }
  if (!supportsPush()) return UNSUPPORTED

  const listeners = new Set<() => void>()
  // Until the worker is ready nothing is known, and the group waits hidden; a page with no worker stays so.
  let state: PushAvailability = 'checking'

  function change(next: PushAvailability): void {
    if (next === state) return
    state = next
    for (const listener of listeners) listener()
  }

  const registration = (): Promise<ServiceWorkerRegistration> => navigator.serviceWorker.ready

  async function refresh(): Promise<void> {
    if (Notification.permission === 'denied') return change('denied')
    const subscription = await (await registration()).pushManager.getSubscription()
    change(subscription === null || Notification.permission !== 'granted' ? 'off' : 'on')
  }

  const refreshQuietly = (): void => {
    // A browser that refuses to answer keeps the last state.
    refresh().catch(() => undefined)
  }
  refreshQuietly()
  // The permission can change in the site settings while the app is in the background.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshQuietly()
  })

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    current: () => state,
    async enable() {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        await refresh()
        return null
      }
      const { pushManager } = await registration()
      const subscription = await pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) })
      const install = installOf(subscription)
      if (install === null) {
        await subscription.unsubscribe()
        await refresh()
        return null
      }
      change('on')
      return install
    },
    async disable() {
      // Sign-out runs this first (D-358): a page whose worker never registered holds no subscription, and must not
      // wait for one.
      const current = await navigator.serviceWorker.getRegistration()
      if (current === undefined) return null
      const subscription = await current.pushManager.getSubscription()
      if (subscription === null) {
        await refresh()
        return null
      }
      await subscription.unsubscribe()
      change(Notification.permission === 'denied' ? 'denied' : 'off')
      return subscription.endpoint
    },
  }
}
