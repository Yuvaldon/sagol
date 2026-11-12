import { expect, test } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { enterAsOwner } from './support/workspace.ts'

// V18 (D-184): the user menu offers to install the app only when the browser offers it, and never on its own (D-076).
// V28 (D-277): after sign-in the same offer shows once as a card that keeps the bars free; "not now" puts it away on
// this device, and the menu item stays.

test('the install offer appears only when the browser makes one', async ({ page }) => {
  await enterAsOwner(page)
  const menu = page.getByRole('button', { name: he.account.menu })
  const install = page.getByRole('menuitem', { name: he.account.install })
  const card = page.getByRole('region', { name: he.account.installOffer })

  await test.step('no offer, no menu item', async () => {
    await menu.click()
    await expect(page.getByRole('menuitem', { name: he.account.signOut })).toBeVisible()
    await expect(install).toHaveCount(0)
    await expect(card).toHaveCount(0)
    await page.keyboard.press('Escape')
  })

  await test.step('the browser offers, the card shows it once, and "not now" puts it away on this device', async () => {
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
    await expect(card).toBeVisible()
    await card.getByRole('button', { name: he.account.installNotNow }).click()
    await expect(card).toHaveCount(0)
    await page.reload()
    await expect(menu).toBeVisible()
    await expect(card).toHaveCount(0)
  })

  await test.step('the browser offers again, the menu shows it, and taking it uses the offer once', async () => {
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
    // Answered once on this device: the card stays away, and the menu still offers.
    await expect(card).toHaveCount(0)
    await menu.click()
    await install.click()
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'offerTaken'))).toBe(true)
    await menu.click()
    await expect(page.getByRole('menuitem', { name: he.account.signOut })).toBeVisible()
    await expect(install).toHaveCount(0)
  })
})
