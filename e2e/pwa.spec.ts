import { readFileSync, writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { PWA } from '../src/config/pwa/index.ts'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'

// V18's demo, against a production build (D-182, D-183): the manifest in Hebrew and RTL, colored from the light theme,
// its icons served, the service worker in control of the page, and Chrome finds the app installable. The build has no
// env here, so the page is the startup failure screen: the shell starts before the env is read, on purpose.
// A new version (D-183, D-444) is a deploy on the same origin: the test changes the built worker on disk, and the
// browser's own update check finds it. The failure screen has no form to lose, so the page takes the waiting worker at
// once, through `SKIP_WAITING`, and reloads; the toast and "רענון" on an open workspace are unit tested
// (`UpdateToast.test.tsx`), because a production build never opens the workspace with the local identity (D-006).

/** The built worker the preview serves; only this test changes it, and it puts it back. */
const BUILT_WORKER = `dist${PWA.serviceWorkerPath}`

interface ManifestIcon {
  readonly src: string
  readonly sizes: string
  readonly purpose?: string
}

interface Manifest {
  readonly icons: readonly ManifestIcon[]
}

test('the production build is an installable app', async ({ page, request, browserName }) => {
  await page.goto('/')

  await test.step('the manifest names the app in Hebrew, right to left, standalone', async () => {
    const href = await page.locator('link[rel="manifest"]').getAttribute('href')
    expect(href).not.toBeNull()
    const manifest: Manifest = await (await request.get(href ?? '')).json()
    expect(manifest).toMatchObject({
      name: he.app.name,
      short_name: he.app.name,
      lang: 'he',
      dir: 'rtl',
      display: 'standalone',
      start_url: '/',
    })
    const { icons } = manifest
    expect(icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))
    expect(icons.some((icon) => icon.purpose === 'maskable')).toBe(true)
    for (const icon of icons) {
      const response = await request.get(`/${icon.src}`)
      expect(response.ok()).toBe(true)
      expect(response.headers()['content-type']).toBe('image/png')
    }
    const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
    expect((await request.get(apple ?? '')).ok()).toBe(true)
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', he.app.name)
  })

  await test.step('the service worker controls the page', async () => {
    const script = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.scriptURL)
    expect(script).toMatch(new RegExp(`${PWA.serviceWorkerPath}$`))
    await page.reload()
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
  })

  await test.step('Chrome finds no installability error', async () => {
    test.skip(browserName !== 'chromium', 'installability is a Chrome DevTools check')
    const cdp = await page.context().newCDPSession(page)
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors')
    expect(installabilityErrors).toEqual([])
  })

  await test.step('the shell opens offline, and the cache holds no gateway path', async () => {
    await page.context().setOffline(true)
    await page.reload()
    await expect(page.locator('#root')).not.toBeEmpty()
    // The backend is on another origin, so a fetch proves nothing: the caches themselves must hold no gateway path.
    const cached = await page.evaluate(async () => {
      const urls: string[] = []
      for (const name of await caches.keys()) {
        for (const request of await (await caches.open(name)).keys()) urls.push(request.url)
      }
      return urls
    })
    expect(cached.length).toBeGreaterThan(0)
    for (const path of PWA.networkOnlyPaths) expect(cached.filter((url) => url.includes(path))).toEqual([])
    await page.context().setOffline(false)
    // The navigation fallback skips the gateway and Auth, the worker takes the update the app asks for (D-183), and it
    // shows the notifications (D-356).
    const worker = await (await page.request.get(PWA.serviceWorkerPath)).text()
    for (const path of PWA.networkOnlyPaths) expect(worker).toContain(path)
    const QUOTE = '[`"\']'
    for (const event of ['message', 'push', 'notificationclick']) expect(worker).toMatch(new RegExp(`addEventListener\\(${QUOTE}${event}${QUOTE}`))
    expect(worker).toContain('SKIP_WAITING')
  })

  await test.step('a new version installs, takes over through SKIP_WAITING, and the page reloads once (D-183)', async () => {
    const built = readFileSync(BUILT_WORKER, 'utf8')
    try {
      writeFileSync(BUILT_WORKER, `${built}\n// ${test.info().testId}\n`)
      await page.evaluate(() => {
        Object.assign(window, { beforeUpdate: true })
      })
      const reloaded = page.waitForEvent('load')
      const found = await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready
        await registration.update()
        return registration.installing !== null || registration.waiting !== null
      })
      expect(found).toBe(true)
      await reloaded
      expect(await page.evaluate(() => 'beforeUpdate' in window)).toBe(false)
      const after = await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready
        return { controlled: navigator.serviceWorker.controller !== null, waiting: registration.waiting !== null }
      })
      expect(after).toEqual({ controlled: true, waiting: false })
      expect(await (await page.request.get(PWA.serviceWorkerPath)).text()).toContain(test.info().testId)
    } finally {
      writeFileSync(BUILT_WORKER, built)
    }
  })
})
