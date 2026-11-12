import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, board, openRotationInNewUnit } from './support/leaves.ts'
import { enterAsOwner, expectNoAxeViolations, navigation, organizationHeading, OWNER } from './support/workspace.ts'

// Focus mode (D-301): "מצב מיקוד" in the view menu and Alt+Shift+F hide both strips and the chips row; one restore button, the same key
// and Escape bring them back, and focus follows. The board takes the top's room, a day still opens its report, and a
// reload keeps the mode for the session. Desktop and mobile, RTL, with axe. Sample data, tests only.

function contextStrip(page: Page) {
  return page.getByRole('navigation', { name: he.workspace.viewBar })
}

/** The view menu's trigger, which holds "מצב מיקוד" and takes focus back when the mode ends. */
function viewMenu(page: Page) {
  return contextStrip(page).getByRole('button', { name: new RegExp(`^${he.workspace.view} `) })
}

async function enterByMenu(page: Page) {
  await viewMenu(page).click()
  await page.getByRole('menuitem', { name: he.workspace.focusEnter }).click()
}

function restoreButton(page: Page) {
  return page.getByRole('button', { name: he.workspace.focusExit, exact: true })
}

async function expectStrips(page: Page) {
  await expect(contextStrip(page)).toBeVisible()
  await expect(restoreButton(page)).toHaveCount(0)
}

async function expectFocusMode(page: Page) {
  await expect(contextStrip(page)).toHaveCount(0)
  await expect(page.getByRole('search', { name: he.filters.bar })).toHaveCount(0)
  // The restore button is the only navigation left.
  await expect(navigation(page).getByRole('button')).toHaveCount(1)
  await expect(restoreButton(page)).toBeVisible()
}

async function boardTop(page: Page) {
  const box = await board(page).boundingBox()
  expect(box).not.toBeNull()
  return box?.y ?? 0
}

test('focus mode: in and out by the view menu, the key and Escape', async ({ page }) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)
  await openRotationInNewUnit(page, [OWNER.name])
  await expect(board(page)).toBeVisible()
  const firstDay = page.getByRole('button', { name: new RegExp(`^${he.presence.openDay}`) }).first()
  const dayTopWithStrips = (await firstDay.boundingBox())?.y ?? 0

  await test.step('the view menu item hides both strips, and focus moves to the restore button', async () => {
    await enterByMenu(page)
    await expectFocusMode(page)
    await expect(restoreButton(page)).toBeFocused()
    await expect(organizationHeading(page)).toBeAttached()
    await expectNoAxeViolations(page)
  })

  await test.step('the board takes the top, and the button sits clear of the names, touch-sized', async () => {
    const dayTop = (await firstDay.boundingBox())?.y ?? 0
    expect(dayTop).toBeLessThan(dayTopWithStrips)
    expect(await boardTop(page)).toBeGreaterThanOrEqual(0)
    const button = await restoreButton(page).boundingBox()
    const viewport = page.viewportSize()
    expect(button).not.toBeNull()
    expect(viewport).not.toBeNull()
    if (button === null || viewport === null) return
    expect(button.width).toBeGreaterThanOrEqual(44)
    expect(button.height).toBeGreaterThanOrEqual(44)
    // RTL: the names are on the right, so the button keeps to the left half, at the bottom.
    expect(button.x + button.width).toBeLessThan(viewport.width / 2)
    expect(button.y).toBeGreaterThan(viewport.height / 2)
  })

  await test.step('a day still opens its report, and Escape closes the report first', async () => {
    await firstDay.click()
    const report = page.getByRole('dialog', { name: he.presence.title })
    await expect(report).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(report).toHaveCount(0)
    await expectFocusMode(page)
  })

  await test.step('a reload keeps the mode for the session', async () => {
    await page.reload()
    await expect(board(page)).toBeVisible()
    await expectFocusMode(page)
  })

  await test.step('the restore button brings the strips back, and focus returns to the view menu', async () => {
    await restoreButton(page).click()
    await expectStrips(page)
    await expect(viewMenu(page)).toBeFocused()
  })

  await test.step('the key enters, and Escape restores', async () => {
    await page.keyboard.press('Alt+Shift+KeyF')
    await expectFocusMode(page)
    await page.keyboard.press('Escape')
    await expectStrips(page)
  })

  await test.step('the same key restores', async () => {
    await page.keyboard.press('Alt+Shift+KeyF')
    await expectFocusMode(page)
    await page.keyboard.press('Alt+Shift+KeyF')
    await expectStrips(page)
    await expectNoAxeViolations(page)
  })
})
