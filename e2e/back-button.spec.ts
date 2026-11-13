import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { closeDrawer, drawer } from './support/leaves.ts'
import { enterAsOwner, navigationPanel, openModule, organizationHeading } from './support/workspace.ts'

// The back button leaves the current state, it never replays the actions that led to it (D-332): the owner's report from
// the installed app on Android, where a menu opened and closed came back on the back button. On desktop and mobile.

/** How many entries lie behind the current one: what the back button would walk through. */
async function entriesBehind(page: Page) {
  return page.evaluate(() => {
    const state: unknown = window.history.state
    return typeof state === 'object' && state !== null && '__TSR_index' in state ? state.__TSR_index : null
  })
}

async function nextWeek(page: Page) {
  await page.getByRole('button', { name: he.workspace.nextWindow.week }).first().click()
}

test('the back button closes what is open and then leaves the app, never replaying an action (D-332)', async ({ page, context }) => {
  await enterAsOwner(page)
  // The installed app opens on the main screen with nothing behind it: a tab of its own, on the workspace.
  const app = await context.newPage()
  await app.goto(page.url())
  await expect(organizationHeading(app)).toBeVisible()
  const start = await entriesBehind(app)

  // The owner's sequence: a menu opened and closed by its own button, a module opened and closed, the window moved.
  await app.getByRole('button', { name: he.navigation.open }).click()
  await expect(navigationPanel(app)).toBeVisible()
  await navigationPanel(app).getByRole('button', { name: he.navigation.close }).click()
  await expect(navigationPanel(app)).toBeHidden()
  await openModule(app, he.soldiers.open)
  await expect(drawer(app)).toBeVisible()
  await closeDrawer(app)
  await expect(drawer(app)).toBeHidden()
  const before = app.url()
  await nextWeek(app)
  await nextWeek(app)
  await expect(app).not.toHaveURL(before)
  // Nothing of it is left in the history to replay.
  expect(await entriesBehind(app)).toBe(start)

  // An overlay that is open is what the back button closes, and the view changed under it stays.
  const moved = app.url()
  await openModule(app, he.soldiers.open)
  await expect(drawer(app)).toBeVisible()
  await app.goBack()
  await expect(drawer(app)).toBeHidden()
  await expect(app).toHaveURL(moved)
  await app.getByRole('button', { name: he.navigation.open }).click()
  await expect(navigationPanel(app)).toBeVisible()
  await app.goBack()
  await expect(navigationPanel(app)).toBeHidden()
  await expect(app).toHaveURL(moved)

  // On the main screen with nothing open, the back button leaves the app.
  await app.goBack()
  await expect(app).toHaveURL('about:blank')
})
