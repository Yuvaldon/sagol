import { PWA } from '@config'
import { PushPayload } from '@contracts'
import { pushNotice } from './pushText'

// What the service worker does with a push and with a tap on its notification (D-354, D-355, D-357). Written over
// the few parts of the worker's scope it uses, so tests hand in fakes and the app keeps the DOM types only.

export interface NotificationShown {
  readonly body: string
  readonly tag: string
  readonly icon: string
  readonly lang: string
  readonly dir: 'rtl'
  readonly data: { readonly url: string }
}

export interface WorkerRegistration {
  showNotification(title: string, options: NotificationShown): Promise<void>
}

export interface WorkerWindow {
  readonly url: string
  focus(): Promise<unknown>
  navigate(url: string): Promise<unknown>
}

export interface WorkerClients {
  matchAll(options: { readonly type: 'window'; readonly includeUncontrolled: boolean }): Promise<readonly WorkerWindow[]>
  openWindow(url: string): Promise<unknown>
}

export interface TappedNotification {
  readonly data: unknown
  close(): void
}

const LANG = 'he'

/** The message `workbox-window` sends when the open app takes the waiting version (D-183). */
const SKIP_WAITING = 'SKIP_WAITING'

/** Whether a message from the app asks the waiting worker to take over; nothing else does (D-183). */
export function asksForWaitingVersion(data: unknown): boolean {
  return typeof data === 'object' && data !== null && 'type' in data && data.type === SKIP_WAITING
}

/**
 * Shows the push as a notification. A payload the contract refuses shows nothing: it is not from this server, or from
 * another version of it. The open app needs no message: live changes already refresh it (D-352).
 */
export async function onPush(data: unknown, registration: WorkerRegistration, staging: boolean): Promise<void> {
  const parsed = PushPayload.safeParse(data)
  if (!parsed.success) return
  const notice = pushNotice(parsed.data, staging)
  await registration.showNotification(notice.title, {
    body: notice.body,
    tag: notice.tag,
    icon: PWA.notificationIcon,
    lang: LANG,
    dir: 'rtl',
    data: { url: notice.url },
  })
}

function urlOf(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('url' in data)) return null
  return typeof data.url === 'string' ? data.url : null
}

/** Opens the leave the notification is about: in a window of the app that is already open, or in a new one. */
export async function onNotificationClick(notification: TappedNotification, clients: WorkerClients, origin: string): Promise<void> {
  notification.close()
  const path = urlOf(notification.data)
  if (path === null) return
  const target = new URL(path, origin).href
  const open = (await clients.matchAll({ type: 'window', includeUncontrolled: true })).find((window) => new URL(window.url).origin === origin)
  if (open === undefined) {
    await clients.openWindow(target)
    return
  }
  await open.focus()
  await open.navigate(target)
}
