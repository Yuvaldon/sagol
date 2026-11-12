import { expect, test } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { enterAsOwner } from './support/workspace.ts'

// V18 (D-184): the user menu offers to install the app only when the browser offers it, and never on its own (D-076).

test('the install offer appears only when the browser makes one', async ({ page }) => {
  await enterAsOwner(page)
  const menu = page.getByRole('button', { name: he.account.menu })
  const install = page.getByRole('menuitem', { name: he.account.install })

  await test.step('no offer, no menu item', async () => {
    await menu.click()
    await expect(page.getByRole('menuitem', { name: he.account.signOut })).toBeVisible()
    await expect(install).toHaveCount(0)
    await page.keyboard.press('Escape')
  })

  await test.step('the browser offers, the menu shows it, and taking it uses the offer once', async () => {
    await page.evaluate(() => {
      const offer = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
        prompt: () => {
          Reflect.set(window, 'offerTaken', true)
          return Promise.resolve()
        },
        userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
      })
      window.dispatchEvent(offer)
    })
    await menu.click()
    await install.click()
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'offerTaken'))).toBe(true)
    await menu.click()
    await expect(page.getByRole('menuitem', { name: he.account.signOut })).toBeVisible()
    await expect(install).toHaveCount(0)
  })
})
