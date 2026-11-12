import { expect, test, type Locator, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, board, choose, closeDrawer, typeDate } from './support/leaves.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations, openModule, waitForSettledScreen } from './support/workspace.ts'

// V3's demo: the board with real soldiers, a unit and a week in the URL, on desktop and mobile, RTL, with
// axe. Sample data, tests only.

const TOUCH_TARGET_PX = 44
const THIS_WEEK = '8–14 בנוב׳'
const NEXT_WEEK = '15–21 בנוב׳'

function boardRows(page: Page): Locator {
  return board(page).getByRole('list', { name: he.timeline.names }).getByRole('listitem')
}

function groupHeading(page: Page, label: string) {
  return board(page).getByRole('heading', { level: 2, name: new RegExp(`^${label} ${he.timeline.soldiersInGroup}`) })
}

/** The window as the bar writes it on the range picker's button, announced when it changes (D-211). */
function windowLabel(page: Page) {
  return page.getByRole('button', { name: new RegExp(he.workspace.window) })
}

function unitRow(page: Page, name: string) {
  return page
    .getByRole('list', { name: he.units.listLabel })
    .getByRole('listitem')
    .filter({ has: page.getByText(name, { exact: true }) })
}

/** A company with two platoons. */
async function buildUnits(page: Page) {
  await openModule(page, he.units.open)
  await page.getByRole('button', { name: he.units.new }).first().click()
  await page.getByLabel(he.units.name).fill('פלוגה')
  await page.getByRole('button', { name: he.common.create }).click()
  for (const name of ['מחלקה א', 'מחלקה ב']) {
    await unitRow(page, 'פלוגה').getByRole('button', { name: he.common.actions }).click()
    await page.getByRole('menuitem', { name: he.units.addChild }).click()
    await page.getByLabel(he.units.name).fill(name)
    await page.getByRole('button', { name: he.common.create }).click()
    await expect(unitRow(page, name)).toBeVisible()
  }
  await closeDrawer(page)
}

async function createPlacedSoldier(page: Page, firstName: string, lastName: string, unit: string) {
  await page.getByRole('button', { name: he.soldiers.new }).first().click()
  await page.getByLabel(he.soldiers.firstName).fill(firstName)
  await page.getByLabel(he.soldiers.lastName).fill(lastName)
  await choose(page, he.soldiers.unit, unit)
  await typeDate(page, he.soldiers.placedFrom, '01', '01', '2026')
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(page.getByRole('list', { name: he.soldiers.listLabel }).getByText(`${firstName} ${lastName}`)).toBeVisible()
}

/** Two soldiers in two platoons; the first moves to the second platoon today, Wednesday. */
async function buildRoster(page: Page) {
  await openModule(page, he.soldiers.open)
  await createPlacedSoldier(page, 'יעל', 'שחר', 'מחלקה א')
  await createPlacedSoldier(page, 'נועם', 'לב', 'מחלקה ב')
  await page.getByRole('list', { name: he.soldiers.listLabel }).getByRole('button', { name: /יעל שחר/ }).click()
  await page.getByRole('button', { name: he.soldiers.moveOpen }).click()
  await choose(page, he.soldiers.unit, 'מחלקה ב')
  await page.getByRole('button', { name: he.soldiers.moveSubmit, exact: true }).click()
  await expect(page.getByRole('list', { name: he.soldiers.historyLabel }).getByRole('listitem')).toHaveCount(2)
  await closeDrawer(page)
}

async function pickUnit(page: Page, name: string) {
  await page.getByRole('button', { name: new RegExp(he.workspace.unit) }).click()
  await page.getByRole('option', { name, exact: true }).click()
}

test('the board: rows by unit, a unit and a week in the URL, and the soldier behind a name', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)

  await test.step('the owner is the first row, without a unit, in this week', async () => {
    await expect(groupHeading(page, he.soldiers.noUnit)).toBeVisible()
    await expect(board(page).getByText(OWNER.name)).toBeVisible()
    await expect(windowLabel(page)).toContainText(THIS_WEEK)
    await expect(page.getByRole('button', { name: he.workspace.today, exact: true })).toHaveCount(0)
    // No unit exists yet, so there is nothing to choose (D-076).
    await expect(page.getByRole('button', { name: new RegExp(he.workspace.unit) })).toHaveCount(0)
    await expect(page).toHaveURL(/\/$/)
    await expectNoAxeViolations(page)
  })

  await test.step('units and soldiers fill the board, grouped by sub-unit', async () => {
    await buildUnits(page)
    await buildRoster(page)
    // Today she is in מחלקה ב, so that is her group (D-105).
    await expect(groupHeading(page, 'פלוגה · מחלקה ב')).toBeVisible()
    await expect(boardRows(page).nth(0)).toContainText('פלוגה · מחלקה ב')
    await expect(boardRows(page).nth(1)).toContainText('נועם לב')
    await expect(boardRows(page).nth(2)).toContainText('יעל שחר')
    await expect(groupHeading(page, he.soldiers.noUnit)).toBeVisible()
    await expectNoAxeViolations(page)
  })

  await test.step('a unit narrows the board to who served in it this week, and mutes the other days', async () => {
    await pickUnit(page, 'מחלקה א')
    await expect(page).toHaveURL(/filter=/)
    await expect(groupHeading(page, 'מחלקה א')).toBeVisible()
    await expect(boardRows(page)).toHaveCount(2)
    await expect(boardRows(page).nth(1)).toContainText('יעל שחר')
    await expect(boardRows(page).nth(1)).toContainText(`${he.timeline.outOfScope}: 11–14 בנוב׳`)
    await expectNoAxeViolations(page)
  })

  await test.step('the week moves, the back button returns, and "today" comes back to this week', async () => {
    await page.getByRole('button', { name: he.workspace.nextWindow.week }).click()
    await expect(windowLabel(page)).toContainText(NEXT_WEEK)
    await expect(page).toHaveURL(/from=2026-11-15/)
    await expect(board(page)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: he.timeline.emptyScopeTitle })).toBeVisible()
    await expectNoAxeViolations(page)

    await page.goBack()
    await expect(windowLabel(page)).toContainText(THIS_WEEK)
    await expect(boardRows(page)).toHaveCount(2)

    await page.getByRole('button', { name: he.workspace.nextWindow.week }).click()
    await page.getByRole('button', { name: he.workspace.today, exact: true }).click()
    await expect(windowLabel(page)).toContainText(THIS_WEEK)
    await expect(page).not.toHaveURL(/from=/)
    await expect(page).toHaveURL(/filter=/)
  })

  await test.step('a link reopens the same unit and week', async () => {
    await pickUnit(page, he.workspace.wholeOrganization)
    await page.getByRole('button', { name: he.workspace.nextWindow.week }).click()
    await pickUnit(page, 'פלוגה')
    await page.reload()
    await expect(windowLabel(page)).toContainText(NEXT_WEEK)
    await expect(page.getByRole('button', { name: new RegExp(he.workspace.unit) })).toContainText('פלוגה')
    await expect(groupHeading(page, 'מחלקה ב')).toBeVisible()
    await expect(groupHeading(page, he.soldiers.noUnit)).toHaveCount(0)
  })

  await test.step('a name opens the soldier, and closing keeps the board as it was', async () => {
    await board(page).getByRole('button', { name: /נועם לב/ }).click()
    await expect(page.getByRole('heading', { name: 'נועם לב', exact: true })).toBeVisible()
    // The drawer and its scrim lie over the bars, not under them, once the drawer has entered. The modal makes the
    // bars inert, and hit testing skips what is inert, so the test lifts it for the moment of the check.
    await waitForSettledScreen(page)
    const covered = await page.evaluate(() => {
      const inert = [...document.querySelectorAll('[inert]')]
      for (const element of inert) element.removeAttribute('inert')
      const bars = [...document.querySelectorAll('nav')].filter((bar) => bar.closest('[role="dialog"]') === null)
      const answer = bars.every((bar) => {
        const box = bar.getBoundingClientRect()
        const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
        return top !== null && !bar.contains(top)
      })
      for (const element of inert) element.setAttribute('inert', '')
      return answer
    })
    expect(covered).toBe(true)
    await expect(page).toHaveURL(/panel=soldiers/)
    await expect(page).toHaveURL(/from=2026-11-15/)
    await closeDrawer(page)
    await expect(page).not.toHaveURL(/panel=/)
    await expect(page).toHaveURL(/filter=/)
    await expect(windowLabel(page)).toContainText(NEXT_WEEK)
  })

  await test.step('on a phone the grid scrolls sideways and the names stay; on a desktop it fits', async () => {
    const scroller = board(page)
    const sizes = await scroller.evaluate((element) => ({ scroll: element.scrollWidth, client: element.clientWidth }))
    const name = board(page).getByRole('button', { name: /נועם לב/ })
    if (testInfo.project.name === 'mobile') {
      expect(sizes.scroll).toBeGreaterThan(sizes.client)
      const before = await name.boundingBox()
      await scroller.evaluate((element) => {
        element.scrollBy({ left: -200 })
      })
      const after = await name.boundingBox()
      if (before === null || after === null) throw new Error('no name')
      expect(Math.abs(after.x - before.x)).toBeLessThan(1)
      expect(after.height).toBeGreaterThanOrEqual(TOUCH_TARGET_PX)
    } else {
      expect(sizes.scroll).toBeLessThanOrEqual(sizes.client)
    }
    await expectNoAxeViolations(page)
  })
})

test('the drawer and its scrim do not move for who asks for less motion (OI-058)', async ({ page }) => {
  const animationsOf = (target: Page) =>
    target.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]')
      const overlay = dialog?.closest('.enter-scrim')
      const surface = dialog?.closest('.enter-surface')
      if (!(overlay instanceof HTMLElement) || !(surface instanceof HTMLElement)) throw new Error('no drawer')
      return [getComputedStyle(overlay).animationName, getComputedStyle(surface).animationName]
    })

  await enterAsOwner(page)
  await openModule(page, he.soldiers.open)
  expect(await animationsOf(page)).not.toEqual(['none', 'none'])
  await closeDrawer(page)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openModule(page, he.soldiers.open)
  expect(await animationsOf(page)).toEqual(['none', 'none'])
  await expectNoAxeViolations(page)
})
