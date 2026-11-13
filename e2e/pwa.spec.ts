import { expect, test } from '@playwright/test'
import { PWA } from '../src/config/pwa/index.ts'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'

// V18's demo, against a production build (D-182, D-183): the manifest in Hebrew and RTL, colored from the light theme,
// its icons served, the service worker in control of the page, and Chrome finds the app installable. The build has no
// env here, so the page is the startup failure screen: the shell starts before the env is read, on purpose.

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
})
