import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, closeDrawer, createType, drawer, leavesOf, requestLeave } from './support/leaves.ts'
import { enterAsOwner, expectNoAxeViolations, openModule } from './support/workspace.ts'

// V17's demo: the soldier's appearance (D-181). Light by default, dark on request, the device's on request, kept with
// the soldier's preferences, and every surface passes axe in the dark set. Desktop and mobile, RTL. Sample data, tests only.

function root(page: Page) {
  return page.locator('html')
}

async function chooseAppearance(page: Page, name: string) {
  await page.getByRole('button', { name: he.account.menu }).click()
  await page.getByRole('menuitemradio', { name }).click()
}

test('light by default, dark on request, the device’s on request, and readable in the dark', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)

  await test.step('light until chosen', async () => {
    await expect(root(page)).not.toHaveAttribute('data-appearance')
    await page.getByRole('button', { name: he.account.menu }).click()
    await expect(page.getByRole('menuitemradio', { name: he.account.appearanceLight })).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Escape')
  })

  await test.step('dark, kept after a reload', async () => {
    await chooseAppearance(page, he.account.appearanceDark)
    await expect(root(page)).toHaveAttribute('data-appearance', 'dark')
    await page.reload()
    await expect(root(page)).toHaveAttribute('data-appearance', 'dark')
  })

  await test.step('the board, a drawer and the bars pass axe in the dark set', async () => {
    await openModule(page, he.leaveTypes.open)
    await createType(page, { name: 'רגילה', color: he.palette.teal })
    await createType(page, { name: 'מבחן', color: he.palette.purple, marker: true })
    await expectNoAxeViolations(page)
    await closeDrawer(page)
    await requestLeave(page, { type: 'רגילה', from: ['09', '11', '2026'], to: ['10', '11', '2026'] })
    await requestLeave(page, { type: 'רגילה', from: ['12', '11', '2026'], to: ['13', '11', '2026'], approveNow: true })
    await expect(drawer(page)).toHaveCount(0)
    await requestLeave(page, { type: 'מבחן', from: ['11', '11', '2026'], to: ['11', '11', '2026'] })
    await expect(drawer(page)).toHaveCount(0)
    await expect(leavesOf(page)).toHaveCount(3)
    await expectNoAxeViolations(page)
    await testInfo.attach('dark board', { body: await page.screenshot(), contentType: 'image/png' })
    await leavesOf(page).first().click()
    await expect(drawer(page)).toBeVisible()
    await expectNoAxeViolations(page)
    await closeDrawer(page)
  })

  await test.step('the device’s: follows the device while the screen is open', async () => {
    await page.emulateMedia({ colorScheme: 'light' })
    await chooseAppearance(page, he.account.appearanceSystem)
    await expect(root(page)).not.toHaveAttribute('data-appearance')
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(root(page)).toHaveAttribute('data-appearance', 'dark')
  })

  await test.step('light again, and the sign-in screen is light', async () => {
    await chooseAppearance(page, he.account.appearanceLight)
    await expect(root(page)).not.toHaveAttribute('data-appearance')
    await chooseAppearance(page, he.account.appearanceDark)
    await page.getByRole('button', { name: he.account.menu }).click()
    await page.getByRole('menuitem', { name: he.account.signOut }).click()
    await expect(root(page)).not.toHaveAttribute('data-appearance')
  })
})
