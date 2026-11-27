import { expect, test } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { enterAsOwner, openTab } from './support/workspace.ts'

// V18 (D-184): "אני" offers to install the app only when the browser offers it, and never on its own (D-076).
// V28 (D-274): after sign-in the same offer shows once as a card that keeps the bars free; "not now" puts it away on
// this device, and the row on "אני" stays.

test('the install offer appears only when the browser makes one', async ({ page }) => {
  await enterAsOwner(page)
  const signOutButton = page.getByRole('button', { name: he.account.signOut, exact: true })
  const install = page.getByRole('button', { name: he.account.install, exact: true })
  const card = page.getByRole('region', { name: he.account.installOffer })

  await test.step('no offer, no row on "אני"', async () => {
    await openTab(page, 'me')
    await expect(signOutButton).toBeVisible()
    await expect(install).toHaveCount(0)
    await expect(card).toHaveCount(0)
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
    await expect(signOutButton).toBeVisible()
    await expect(card).toHaveCount(0)
  })

  await test.step('the browser offers again, "אני" shows it, and taking it uses the offer once', async () => {
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
    // Answered once on this device: the card stays away, and "אני" still offers.
    await expect(card).toHaveCount(0)
    await install.click()
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'offerTaken'))).toBe(true)
    await expect(signOutButton).toBeVisible()
    await expect(install).toHaveCount(0)
  })
})
