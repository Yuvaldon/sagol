import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, board, openRotationInNewUnit } from './support/leaves.ts'
import { openOptions, optionsMenu } from './support/board.ts'
import {
  enterAsOwner,
  expectNoAxeViolations,
  navigation,
  openBoardOnTimeline,
  organizationHeading,
  OWNER,
} from './support/workspace.ts'

// Focus mode (D-301, D-480): "מיקוד" in the board's options and Alt+Shift+F hide the tab bar and the board's head; a
// capsule with the month or the range stays in the middle, and it, the same key and Escape bring them back, focus
// following. The board takes the top's room, a day still opens what it opens, and a reload keeps the mode on the
// device. Desktop and mobile, RTL, with axe. Sample data, tests only.

function optionsButton(page: Page) {
  return page.getByRole('button', { name: new RegExp(`^${he.board.options}`) })
}

/** "מיקוד", after the options menu's divider. */
async function enterByOptions(page: Page) {
  await openOptions(page)
  await optionsMenu(page).getByRole('button', { name: he.board.focus }).click()
}

function restoreButton(page: Page) {
  return page.getByRole('button', { name: new RegExp(`^${he.workspace.focusExit}`) })
}

async function expectStrips(page: Page) {
  await expect(optionsButton(page)).toBeVisible()
  await expect(navigation(page)).toBeVisible()
  await expect(restoreButton(page)).toHaveCount(0)
}

async function expectFocusMode(page: Page) {
  await expect(optionsButton(page)).toHaveCount(0)
  // The tab bar goes with the head: the capsule is the one control left above the board.
  await expect(navigation(page)).toHaveCount(0)
  await expect(restoreButton(page)).toBeVisible()
}

async function boardTop(page: Page) {
  const box = await board(page).boundingBox()
  expect(box).not.toBeNull()
  return box?.y ?? 0
}

test('focus mode: in and out by the options, the key and Escape', async ({ page, isMobile }) => {
  await page.clock.setFixedTime(NOW)
  await openBoardOnTimeline(page, isMobile)
  await enterAsOwner(page)
  await openRotationInNewUnit(page, [OWNER.name])
  await expect(board(page)).toBeVisible()
  // A wide screen's day opens its report (D-193); a phone's selects it and opens the unit's drawer (D-480).
  const firstDay = isMobile
    ? page.getByRole('group', { name: he.board.days }).getByRole('button').first()
    : page.getByRole('button', { name: new RegExp(`^${he.presence.openDay}`) }).first()
  const dayTopWithStrips = (await firstDay.boundingBox())?.y ?? 0

  await test.step('"מיקוד" hides the head and the tab bar, and focus moves to the capsule', async () => {
    await enterByOptions(page)
    await expectFocusMode(page)
    await expect(restoreButton(page)).toBeFocused()
    await expect(organizationHeading(page)).toBeAttached()
    await expectNoAxeViolations(page)
  })

  await test.step('the board takes the top, and the capsule sits in the middle at the top, touch-sized', async () => {
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
    expect(button.x).toBeLessThan(viewport.width / 2)
    expect(button.x + button.width).toBeGreaterThan(viewport.width / 2)
    expect(button.y).toBeLessThan(viewport.height / 4)
  })

  await test.step('a day still opens what it opens, and Escape closes that first', async () => {
    await firstDay.click()
    const opened = page.getByRole('dialog')
    await expect(opened).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(opened).toHaveCount(0)
    await expectFocusMode(page)
  })

  await test.step('a reload keeps the mode on the device', async () => {
    await page.reload()
    await expect(board(page)).toBeVisible()
    await expectFocusMode(page)
  })

  await test.step('the capsule brings the head back, and focus returns to the view switcher', async () => {
    await restoreButton(page).click()
    await expectStrips(page)
    await expect(page.getByRole('button', { name: he.workspace.view, exact: true })).toBeFocused()
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
