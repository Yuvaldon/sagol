import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, choose, closeDrawer, drawer, openRotation } from './support/leaves.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations, navigation, navigationPanel, openModule, signIn } from './support/workspace.ts'

// The bars keep the daily work; the modules that set the unit up sit in "ניהול יחידה" by group, each with its plain
// line and none pinned out (D-254); the scope label names the single root unit; the rules row's place is the soldier's
// own choice, in the profile (D-173, D-253). On desktop and mobile, RTL, with axe. Sample data, tests only.

const COMPANY = 'פלוגה א'
const ROLE = 'לוחם'
/** A fighter's own record and own requests (D-003), and nothing that sets the organization up. */
const SELF_PERMISSIONS: readonly (readonly [string, readonly string[]])[] = [
  [he.permissionLabels.resources.soldiers, [he.permissionLabels.actions.view]],
  [he.permissionLabels.resources.leaves, [he.permissionLabels.actions.view, he.permissionLabels.actions.create]],
]

function menuButton(page: Page) {
  return page.getByRole('button', { name: new RegExp(`^${he.navigation.open}`) })
}

async function openPanel(page: Page) {
  await menuButton(page).click()
  await expect(navigationPanel(page)).toBeVisible()
}

test('"ניהול יחידה", the scope label and the rules row placement', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)
  await testInfo.attach('bars', { body: await page.screenshot(), contentType: 'image/png' })

  await test.step('with no rotation, and no unit to hold one, the owner is sent to found a unit first (D-218)', async () => {
    await expect(page.getByRole('heading', { name: he.workspace.routineTitle })).toBeVisible()
    await expect(page.getByText(he.deployments.emptyNoUnits)).toBeVisible()
    await expect(navigation(page).getByRole('button', { name: he.myLeaves.open })).toHaveCount(0)
    await expect(page.getByRole('button', { name: he.leaves.new })).toHaveCount(0)
    await expectNoAxeViolations(page)
    await page.getByRole('button', { name: he.workspace.foundUnits }).click()
    await expect(page).toHaveURL(/panel=units&entity=new/)
    await closeDrawer(page)
  })

  await test.step('the bars keep the daily work; set-up modules are not in them', async () => {
    for (const name of [he.units.open, he.soldiers.open, he.roles.open, he.transfer.open]) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
    }
  })

  await test.step('the panel lists the modules by section, and opens one', async () => {
    await openPanel(page)
    for (const section of Object.values(he.navigation.sections)) {
      await expect(navigationPanel(page).getByRole('heading', { name: section, exact: true })).toBeVisible()
    }
    // Each module says what it is for, and none can be pinned to the bar (D-250, D-254).
    await expect(navigationPanel(page).getByRole('button', { name: he.soldiers.open, exact: true })).toHaveAccessibleDescription(
      he.navigation.lines.soldiers,
    )
    await expect(navigationPanel(page).locator('[aria-pressed]')).toHaveCount(0)
    await expectNoAxeViolations(page)
    await testInfo.attach('panel', { body: await page.screenshot(), contentType: 'image/png' })
    await page.keyboard.press('Escape')
    await expect(navigationPanel(page)).toBeHidden()
    await openModule(page, he.units.open)
    await expect(navigationPanel(page)).toBeHidden()
    await drawer(page).getByRole('button', { name: he.units.new }).first().click()
    await page.getByLabel(he.units.name).fill(COMPANY)
    await page.getByRole('button', { name: he.common.create }).click()
    await expect(drawer(page).getByRole('list', { name: he.units.listLabel }).getByText(COMPANY, { exact: true })).toBeVisible()
    await closeDrawer(page)
    await openRotation(page, [OWNER.name])
    await expect(navigation(page).getByRole('button', { name: he.myLeaves.open })).toBeVisible()
  })

  await test.step('a single unit in sight names the scope, as a label and not a picker; a phone has no room for it', async () => {
    await expect(page.getByRole('button', { name: new RegExp(`^(?!${he.navigation.open}$).*${he.workspace.unit}`) })).toHaveCount(0)
    const label = page.getByRole('navigation', { name: he.workspace.viewBar }).getByText(COMPANY, { exact: true })
    // A phone's strip shows no scope with nothing to choose (D-273).
    if (testInfo.project.name === 'mobile') await expect(label).toHaveCount(0)
    else await expect(label).toBeVisible()
  })

  await test.step('the rules row placement is kept, in the profile', async () => {
    const above = page.getByRole('menuitemradio', { name: he.account.rulesRowAbove })
    await page.getByRole('button', { name: new RegExp(`^${he.account.menu}`) }).click()
    await above.click()
    await page.getByRole('button', { name: new RegExp(`^${he.account.menu}`) }).click()
    await expect(above).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Escape')
    await page.reload()
    await page.getByRole('button', { name: new RegExp(`^${he.account.menu}`) }).click()
    await expect(above).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Escape')
  })
})

test('a fighter sees only the modules their permissions open, and no unit picker', async ({ page }) => {
  const soldier = { email: 'noa@example.test', first: 'נועה', last: 'בר', personalId: '5566778' }
  await enterAsOwner(page)

  await test.step('the owner sets up a unit, a soldier with an invite, and the fighter role as the baseline', async () => {
    await openModule(page, he.units.open)
    await drawer(page).getByRole('button', { name: he.units.new }).first().click()
    await page.getByLabel(he.units.name).fill(COMPANY)
    await page.getByRole('button', { name: he.common.create }).click()
    await expect(drawer(page).getByRole('list', { name: he.units.listLabel }).getByText(COMPANY, { exact: true })).toBeVisible()
    await closeDrawer(page)
    await openModule(page, he.soldiers.open)
    await page.getByRole('button', { name: he.soldiers.new }).first().click()
    await page.getByLabel(he.soldiers.firstName).fill(soldier.first)
    await page.getByLabel(he.soldiers.lastName).fill(soldier.last)
    await page.getByLabel(he.soldiers.personalId).fill(soldier.personalId)
    await page.getByLabel(he.soldiers.inviteEmail).fill(soldier.email)
    await page.getByRole('button', { name: he.common.create }).click()
    await expect(page.getByRole('list', { name: he.soldiers.listLabel }).getByText(`${soldier.first} ${soldier.last}`, { exact: true })).toBeVisible()
    await closeDrawer(page)
    await openModule(page, he.roles.open)
    await drawer(page).getByRole('button', { name: he.roles.new }).click()
    await page.getByLabel(he.roles.name).fill(ROLE)
    for (const [resource, actions] of SELF_PERMISSIONS) {
      const group = drawer(page).getByRole('group', { name: resource, exact: true })
      for (const action of actions) {
        await group.locator('label').filter({ has: page.getByRole('checkbox', { name: action, exact: true }) }).click()
      }
    }
    await page.getByRole('button', { name: he.common.create }).click()
    await expect(drawer(page).getByRole('list', { name: he.roles.listLabel }).getByText(ROLE, { exact: true })).toBeVisible()
    // The baseline applies to each linked soldier on their own record (D-003).
    await choose(page, he.roles.baseline, ROLE)
    await expect(drawer(page).getByText(he.roles.isBaseline)).toBeVisible()
    await closeDrawer(page)
  })

  await test.step('the soldier links and reaches the workspace, which has no rotation yet', async () => {
    await page.getByRole('button', { name: he.account.menu }).click()
    await page.getByRole('menuitem', { name: he.account.signOut }).click()
    await expect(page).toHaveURL(/\/sign-in$/)
    await signIn(page, soldier.email)
    await expect(page).toHaveURL(/\/onboarding$/)
    await page.getByLabel(he.linkRequest.firstName).fill(soldier.first)
    await page.getByLabel(he.linkRequest.lastName).fill(soldier.last)
    await page.getByLabel(he.linkRequest.personalId).fill(soldier.personalId)
    await page.getByRole('button', { name: he.linkRequest.submit }).click()
    // No rotation yet, and the fighter may not open one: the workspace says who does, with nothing to request (D-218).
    await expect(page.getByRole('heading', { name: he.workspace.routineTitle })).toBeVisible()
    await expect(page.getByText(he.workspace.noRotationBody)).toBeVisible()
    await expect(page.getByRole('button', { name: he.workspace.openRotation })).toHaveCount(0)
    await expect(navigation(page).getByRole('button', { name: he.myLeaves.open })).toHaveCount(0)
    await expect(page.getByRole('button', { name: he.leaves.new })).toHaveCount(0)
    await expectNoAxeViolations(page)
  })

  await test.step('the panel holds only what the fighter may open: their own record', async () => {
    await expect(page.getByRole('button', { name: new RegExp(`^(?!${he.navigation.open}$).*${he.workspace.unit}`) })).toHaveCount(0)
    await openPanel(page)
    // Viewing their own record opens the soldiers module (D-053); nothing else of the panel is theirs.
    await expect(navigationPanel(page).getByRole('button', { name: he.soldiers.open, exact: true })).toBeVisible()
    for (const name of [he.units.open, he.leaveTypes.open, he.tags.open, he.roles.open, he.grants.open, he.transfer.open]) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
    }
    for (const section of [
      he.navigation.sections.presence,
      he.navigation.sections.structure,
      he.navigation.sections.access,
      he.navigation.sections.catalogs,
      he.navigation.sections.data,
      he.navigation.sections.advanced,
    ]) {
      await expect(navigationPanel(page).getByRole('heading', { name: section, exact: true })).toHaveCount(0)
    }
    // No setup of the unit is theirs, so its row is not there either (D-285).
    await expect(navigationPanel(page).getByRole('button', { name: he.navigation.setupOpen, exact: true })).toHaveCount(0)
    await expectNoAxeViolations(page)
  })
})

test('on a tablet held upright, no row of the panel stretches to fill it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one tablet shape, set here')
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)
  await openPanel(page)
  // The unit is not set up yet, so its setup sits above the groups, a row like the others.
  const setup = navigationPanel(page).getByRole('button', { name: he.setup.open, exact: true })
  await expect(setup).toBeVisible()
  await testInfo.attach('panel, tablet upright', { body: await page.screenshot(), contentType: 'image/png' })
  const heights = await navigationPanel(page)
    .getByRole('navigation', { name: he.navigation.title })
    .getByRole('button')
    .evaluateAll((buttons) => buttons.map((button) => ({ name: button.textContent ?? '', height: button.getBoundingClientRect().height })))
  expect(heights.length).toBeGreaterThan(1)
  // A row is one or two lines tall, never the panel's leftover height.
  for (const row of heights) expect(row.height, row.name).toBeLessThanOrEqual(64)
  const setupBox = await setup.boundingBox()
  expect(setupBox?.height ?? 0).toBeLessThanOrEqual(44)
})
