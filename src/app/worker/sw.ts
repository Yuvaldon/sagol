import { PWA } from '@config'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { readStaging } from '../env'
import { onNotificationClick, onPush, type TappedNotification, type WorkerClients, type WorkerRegistration } from './handlers'

// The service worker (D-183, D-354): the app's files for offline use, every navigation answered by the app's page
// except the server's own paths, the update the open app asks for, and the phone's notifications.

interface WaitableEvent {
  waitUntil(promise: Promise<unknown>): void
}
interface PushEvent extends WaitableEvent {
  readonly data: { json(): unknown } | null
}
interface NotificationClickEvent extends WaitableEvent {
  readonly notification: TappedNotification
}
interface MessageEvent {
  readonly data: unknown
}
interface WorkerScope {
  readonly __WB_MANIFEST: readonly (PrecacheEntry | string)[]
  readonly registration: WorkerRegistration
  readonly clients: WorkerClients
  readonly location: { readonly origin: string }
  skipWaiting(): Promise<void>
  addEventListener(type: 'push', listener: (event: PushEvent) => void): void
  addEventListener(type: 'notificationclick', listener: (event: NotificationClickEvent) => void): void
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
}

declare const self: WorkerScope

/** The message `workbox-window` sends when the open app takes the waiting version (D-183). */
const SKIP_WAITING = 'SKIP_WAITING'

function pathPattern(path: string): RegExp {
  return new RegExp(`^${path.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
}

cleanupOutdatedCaches()
precacheAndRoute([...self.__WB_MANIFEST])
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: PWA.networkOnlyPaths.map(pathPattern) }))

self.addEventListener('message', (event) => {
  if (typeof event.data === 'object' && event.data !== null && 'type' in event.data && event.data.type === SKIP_WAITING) void self.skipWaiting()
})

self.addEventListener('push', (event) => {
  const read = (): unknown => {
    try {
      return event.data?.json() ?? null
    } catch {
      // Not JSON: not a push of this server.
      return null
    }
  }
  event.waitUntil(onPush(read(), self.registration, readStaging()))
})

self.addEventListener('notificationclick', (event) => {
  event.waitUntil(onNotificationClick(event.notification, self.clients, self.location.origin))
})
