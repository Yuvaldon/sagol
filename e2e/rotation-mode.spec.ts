import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, closeDrawer, drawer, press, typeDate } from './support/leaves.ts'
import { addUnit, OWNER, enterAsOwner, expectNoAxeViolations, navigation, openModule } from './support/workspace.ts'

// V26's journey (b): routine until a rotation opens, a tag for that rotation only, the close and the reopen
// (D-257 … D-260, D-222), and Design.md (b) from the strip's quick action in each mode (D-296). The quick action's
// full table of modes and roles is `quickActionOf`'s unit test. Desktop and mobile, RTL, with axe. Sample data, tests
// only.

const ROUTINE = he.workspace.routineTitle

function rotationRow(page: Page, name: string) {
  return drawer(page).getByRole('list', { name: he.deployments.listLabel }).getByRole('listitem').filter({ hasText: name })
}

async function rowAction(page: Page, name: string, action: string) {
  await rotationRow(page, name).getByRole('button', { name: he.common.actions }).click()
  await page.getByRole('menuitem', { name: action }).click()
}

function tagsSection(page: Page) {
  return drawer(page).locator('section').filter({ has: page.getByRole('heading', { name: he.soldiers.tagsTitle }) })
}

async function openOwnerCard(page: Page) {
  await openModule(page, he.soldiers.open)
  await drawer(page).getByRole('list', { name: he.soldiers.listLabel }).getByRole('button', { name: new RegExp(OWNER.name) }).click()
}

test('routine, a rotation with a tag of its own, the close and the reopen', async ({ page }) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)

  await test.step('routine while no rotation is set', async () => {
    await expect(page.getByRole('heading', { name: ROUTINE })).toBeVisible()
    await openModule(page, he.units.open)
    await addUnit(page, 'פלוגה ג')
    await closeDrawer(page)
  })

  await test.step('a category whose tags last one rotation by default', async () => {
    await openModule(page, he.tags.open)
    await drawer(page).getByRole('button', { name: he.tags.new }).first().click()
    await page.getByLabel(he.tags.name).fill('שמירה')
    // The tag's form makes its category in place (D-285).
    await drawer(page).getByRole('button', { name: he.tagCategories.new }).click()
    const inPlace = page.getByRole('dialog', { name: he.tagCategories.new })
    await inPlace.getByLabel(he.tagCategories.name).fill('משימה')
    await inPlace.getByRole('button', { name: new RegExp(`${he.tagCategories.defaultLifetime}$`) }).click()
    await page.getByRole('option', { name: he.tagCategories.lifetimeRotation, exact: true }).click()
    await inPlace.locator('label').filter({ has: page.getByRole('radio', { name: he.palette.teal, exact: true }) }).click()
    await inPlace.getByRole('button', { name: he.common.create }).click()
    await expect(inPlace).toBeHidden()
    await expect(drawer(page).getByRole('button', { name: new RegExp(`${he.tags.category}$`) })).toContainText('משימה')
    await page.getByRole('button', { name: he.common.create }).click()
    await expect(drawer(page).getByRole('list', { name: 'משימה' })).toContainText('שמירה')
    await closeDrawer(page)
  })

  await test.step('a rotation with no end holds the whole unit, and the screen is in its mode', async () => {
    await openModule(page, he.deployments.open)
    await drawer(page).getByRole('button', { name: he.deployments.new }).first().click()
    await page.getByLabel(he.deployments.name).fill('סבב חורף')
    await typeDate(page, he.deployments.from, '01', '11', '2026')
    await page.getByRole('button', { name: he.common.create }).click()
    await expect(drawer(page).getByRole('radio', { name: he.deployments.wholeUnit })).toBeChecked()
    await expect(drawer(page).getByText(he.deployments.wholeUnitHint)).toBeVisible()
    await expectNoAxeViolations(page)
    await drawer(page).getByRole('button', { name: he.common.save }).click()
    await expect(rotationRow(page, 'סבב חורף')).toContainText(he.deployments.wholeUnit)
    await closeDrawer(page)
    await expect(page.getByRole('heading', { name: ROUTINE })).toHaveCount(0)
  })

  await test.step("a tag for this rotation only, on the soldier's card", async () => {
    await openOwnerCard(page)
    await page.getByRole('button', { name: he.soldiers.tagsEdit }).click()
    await press(page, 'checkbox', 'שמירה')
    // The category's default lifetime is already chosen (D-260).
    await expect(drawer(page).getByRole('radio', { name: he.soldiers.tagLifetimeRotation })).toBeChecked()
    await expectNoAxeViolations(page)
    await drawer(page).getByRole('button', { name: he.common.save, exact: true }).click()
    await expect(tagsSection(page)).toContainText('שמירה')
    await expect(tagsSection(page)).toContainText(he.soldiers.tagForRotation)
    await closeDrawer(page)
  })

  await test.step('the close: routine again, the rotation kept as history', async () => {
    await openModule(page, he.deployments.open)
    await rowAction(page, 'סבב חורף', he.deployments.close)
    await expect(rotationRow(page, 'סבב חורף')).toContainText(he.deployments.closed)
    await expectNoAxeViolations(page)
    await closeDrawer(page)
    await expect(page.getByRole('heading', { name: ROUTINE })).toBeVisible()
    // Out of the rotation, its tag is no longer the soldier's.
    await openOwnerCard(page)
    await expect(tagsSection(page)).not.toContainText('שמירה')
    await closeDrawer(page)
  })

  await test.step('the reopen brings the rotation and its tag back', async () => {
    await openModule(page, he.deployments.open)
    await rowAction(page, 'סבב חורף', he.deployments.reopen)
    await expect(rotationRow(page, 'סבב חורף')).not.toContainText(he.deployments.closed)
    await closeDrawer(page)
    await expect(page.getByRole('heading', { name: ROUTINE })).toHaveCount(0)
    await openOwnerCard(page)
    await expect(tagsSection(page)).toContainText('שמירה')
  })
})

/** The strip's quick action, by its name; at most one shows (D-266). */
function quickAction(page: Page, name: string) {
  return navigation(page).getByRole('button', { name, exact: true })
}

async function fillRotation(page: Page, name: string, from: readonly [string, string, string], to: readonly [string, string, string]) {
  await page.getByLabel(he.deployments.name).fill(name)
  await typeDate(page, he.deployments.from, ...from)
  await typeDate(page, he.deployments.to, ...to)
}

test('journey (b): the quick action in each mode, an overlap refused, a list that grows', async ({ page }) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)

  await test.step('(b)1. in routine the strip offers "פתיחת סבב", which opens a new rotation', async () => {
    await expect(page.getByRole('heading', { name: ROUTINE })).toBeVisible()
    await expect(quickAction(page, he.leaves.new)).toHaveCount(0)
    await quickAction(page, he.workspace.openRotation).click()
    await expect(drawer(page).getByRole('heading', { name: he.deployments.newTitle })).toBeVisible()
    await fillRotation(page, 'סבב סתיו', ['01', '10', '2026'], ['31', '10', '2026'])
    await page.getByRole('button', { name: he.common.create }).click()
    await expect(drawer(page).getByRole('heading', { name: he.deployments.membersTitle })).toBeVisible()
    await drawer(page).getByRole('button', { name: he.common.save }).click()
    await expect(rotationRow(page, 'סבב סתיו')).toContainText(he.deployments.wholeUnit)
    await closeDrawer(page)
  })

  await test.step('(b)5. ended and not closed: not routine, and no quick action', async () => {
    await expect(page.getByRole('heading', { name: ROUTINE })).toHaveCount(0)
    await expect(quickAction(page, he.workspace.openRotation)).toHaveCount(0)
    await expect(quickAction(page, he.leaves.new)).toHaveCount(0)
  })

  await test.step('(b)5. the close brings routine and "פתיחת סבב" back', async () => {
    await openModule(page, he.deployments.open)
    await rowAction(page, 'סבב סתיו', he.deployments.close)
    await expect(rotationRow(page, 'סבב סתיו')).toContainText(he.deployments.closed)
    await closeDrawer(page)
    await expect(page.getByRole('heading', { name: ROUTINE })).toBeVisible()
    await expect(quickAction(page, he.workspace.openRotation)).toBeVisible()
  })

  await test.step('(b)2. dates over another rotation, closed too, are refused, and say why', async () => {
    await quickAction(page, he.workspace.openRotation).click()
    await fillRotation(page, 'סבב נובמבר', ['25', '10', '2026'], ['30', '11', '2026'])
    await page.getByRole('button', { name: he.common.create }).click()
    await expect(drawer(page).getByText(he.issues.rotationOverlap)).toBeVisible()
    await expectNoAxeViolations(page)
    await typeDate(page, he.deployments.from, '01', '11', '2026')
    await page.getByRole('button', { name: he.common.create }).click()
    await expect(drawer(page).getByRole('heading', { name: he.deployments.membersTitle })).toBeVisible()
  })

  await test.step('(b)1. "רשימה": the owner alone serves first', async () => {
    await press(page, 'radio', he.deployments.listed)
    await press(page, 'checkbox', OWNER.name)
    await drawer(page).getByRole('button', { name: he.common.save }).click()
    await expect(rotationRow(page, 'סבב נובמבר')).toContainText(`${he.deployments.memberCount} 1`)
    await closeDrawer(page)
  })

  await test.step('(b)2–3. the rotation runs: the quick action is "בקשה חדשה"', async () => {
    await expect(page.getByRole('heading', { name: ROUTINE })).toHaveCount(0)
    await expect(quickAction(page, he.workspace.openRotation)).toHaveCount(0)
    await expect(quickAction(page, he.leaves.new)).toBeVisible()
  })

  await test.step('(b)4. the list grows into the whole unit', async () => {
    await openModule(page, he.deployments.open)
    await rowAction(page, 'סבב נובמבר', he.deployments.editMembers)
    await press(page, 'radio', he.deployments.wholeUnit)
    await drawer(page).getByRole('button', { name: he.common.save }).click()
    await expect(rotationRow(page, 'סבב נובמבר')).toContainText(he.deployments.wholeUnit)
    await expectNoAxeViolations(page)
  })
})
