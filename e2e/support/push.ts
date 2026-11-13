import type { Page } from '@playwright/test'

// A browser that can push, for the dev server (D-356): the server has no service worker, so the page gets a fake
// registration whose push manager keeps one subscription, and a permission that is granted on asking. The
// Playwright config gives the dev server a sample public key. Sample data, tests only.

const SAMPLE_INSTALL = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/sample-device',
  keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' },
}

/** How many times the page asked the push manager for a subscription. */
export const SUBSCRIBE_CALLS = 'sagol.e2e.subscribeCalls'

interface PushStub {
  readonly install: typeof SAMPLE_INSTALL
  readonly withPushManager: boolean
  readonly callsKey: string
}

/** Runs in the page, before the app: the subscription lives in sessionStorage so a reload keeps it. */
function installStub({ install, withPushManager, callsKey }: PushStub) {
  const STORED = 'sagol.e2e.subscription'
  let permission: NotificationPermission = 'granted'
  Object.defineProperty(Notification, 'permission', { configurable: true, get: () => permission })
  Object.defineProperty(Notification, 'requestPermission', {
    configurable: true,
    value: () => {
      permission = 'granted'
      return Promise.resolve(permission)
    },
  })
  if (!withPushManager) Reflect.deleteProperty(window, 'PushManager')

  const subscription = () => ({
    endpoint: install.endpoint,
    toJSON: () => install,
    unsubscribe: () => {
      sessionStorage.removeItem(STORED)
      return Promise.resolve(true)
    },
  })
  const pushManager = {
    getSubscription: () => Promise.resolve(sessionStorage.getItem(STORED) === null ? null : subscription()),
    subscribe: () => {
      sessionStorage.setItem(STORED, '1')
      sessionStorage.setItem(callsKey, String(Number(sessionStorage.getItem(callsKey) ?? '0') + 1))
      return Promise.resolve(subscription())
    },
  }
  const registration = { pushManager }
  Object.defineProperty(ServiceWorkerContainer.prototype, 'ready', { configurable: true, get: () => Promise.resolve(registration) })
  Object.defineProperty(ServiceWorkerContainer.prototype, 'getRegistration', { configurable: true, value: () => Promise.resolve(registration) })
}

export async function stubPush(page: Page, { withPushManager = true } = {}) {
  await page.addInitScript(installStub, { install: SAMPLE_INSTALL, withPushManager, callsKey: SUBSCRIBE_CALLS })
}

export async function subscribeCalls(page: Page): Promise<number> {
  return page.evaluate((key) => Number(sessionStorage.getItem(key) ?? '0'), SUBSCRIBE_CALLS)
}
