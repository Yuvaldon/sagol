import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { drawer } from './support/leaves.ts'
import { addUnit, enterAsOwner, openModule, organizationHeading, unitRow } from './support/workspace.ts'

// A menu, a sheet or a dialog that lives inside a screen holds one history entry while it is open, so the back button
// closes it, innermost first, and a close by its own controls leaves nothing behind (OI-291, D-337). On desktop and
// mobile. Sample data, tests only.

const UNIT = 'מחלקה א'

/** How many entries lie behind the current one: what the back button would walk through. */
async function entriesBehind(page: Page) {
  return page.evaluate(() => {
    const state: unknown = window.history.state
    return typeof state === 'object' && state !== null && '__TSR_index' in state ? state.__TSR_index : null
  })
}

/** The workspace in a tab of its own, with nothing behind it, as the installed app opens. */
async function freshApp(page: Page, url: string) {
  const app = await page.context().newPage()
  await app.goto(url)
  await expect(organizationHeading(app)).toBeVisible()
  return app
}

test('the back button closes a menu and stays on the screen (OI-291)', async ({ page }) => {
  await enterAsOwner(page)
  const app = await freshApp(page, page.url())
  const start = await entriesBehind(app)
  const url = app.url()

  await app.getByRole('button', { name: he.account.menu }).click()
  await expect(app.getByRole('menu')).toBeVisible()
  await app.goBack()
  await expect(app.getByRole('menu')).toBeHidden()
  await expect(app).toHaveURL(url)
  await expect(organizationHeading(app)).toBeVisible()
  expect(await entriesBehind(app)).toBe(start)

  // Escape takes the menu's entry with it: the next back press leaves the app.
  await app.getByRole('button', { name: he.account.menu }).click()
  await expect(app.getByRole('menu')).toBeVisible()
  await app.keyboard.press('Escape')
  await expect(app.getByRole('menu')).toBeHidden()
  await expect.poll(() => entriesBehind(app)).toBe(start)
  await app.goBack()
  await expect(app).toHaveURL('about:blank')
})

test('a dialog over a sheet closes first, then the sheet, and a close by click leaves no entry (OI-291)', async ({ page }) => {
  await enterAsOwner(page)
  await openModule(page, he.units.open)
  await addUnit(page, UNIT)
  const app = await freshApp(page, page.url().replace(/[?&]panel=[^&]*/, '').replace(/&$/, ''))
  const start = await entriesBehind(app)

  await openModule(app, he.units.open)
  await expect(drawer(app)).toBeVisible()
  const sheet = app.url()
  const onSheet = await entriesBehind(app)

  // Back twice: the warning, then the sheet.
  await unitRow(app, UNIT).getByRole('button', { name: he.common.actions }).click()
  await app.getByRole('menuitem', { name: he.common.archive }).click()
  await expect(app.getByRole('alertdialog')).toBeVisible()
  await app.goBack()
  await expect(app.getByRole('alertdialog')).toBeHidden()
  await expect(unitRow(app, UNIT)).toBeVisible()
  await expect(app).toHaveURL(sheet)
  await app.goBack()
  await expect(app.getByRole('dialog')).toHaveCount(0)
  await expect(app).not.toHaveURL(/panel=/)
  expect(await entriesBehind(app)).toBe(start)

  // Closed by its own button, the warning leaves only the sheet's entry: back closes the sheet, then leaves the app.
  await openModule(app, he.units.open)
  await unitRow(app, UNIT).getByRole('button', { name: he.common.actions }).click()
  await app.getByRole('menuitem', { name: he.common.archive }).click()
  await app.getByRole('alertdialog').getByRole('button', { name: he.common.cancel }).click()
  await expect(app.getByRole('alertdialog')).toBeHidden()
  await expect.poll(() => entriesBehind(app)).toBe(onSheet)
  await app.goBack()
  await expect(app.getByRole('dialog')).toHaveCount(0)
  await expect(app).not.toHaveURL(/panel=/)
  await app.goBack()
  await expect(app).toHaveURL('about:blank')
})
