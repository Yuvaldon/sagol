import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { choose, closeDrawer, drawer, press } from './support/leaves.ts'
import { enterAsOwner, expectNoAxeViolations, navigation, navigationPanel, openModule, signIn } from './support/workspace.ts'

// V12a's demo: the bars keep the daily work, the modules that set the organization up sit in the navigation panel by
// section, a module pinned there joins the bar, the scope label names the single root unit, and the rules row's place
// is the soldier's own choice (D-173). On desktop and mobile, RTL, with axe. Sample data, tests only.

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

test('the navigation panel, pins, the scope label and the rules row placement', async ({ page }, testInfo) => {
  await enterAsOwner(page)
  await testInfo.attach('bars', { body: await page.screenshot(), contentType: 'image/png' })

  await test.step('the bars keep the daily work; set-up modules are not in them', async () => {
    await expect(navigation(page).getByRole('button', { name: he.myLeaves.open })).toBeVisible()
    for (const name of [he.units.open, he.soldiers.open, he.roles.open, he.transfer.open]) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
    }
  })

  await test.step('the panel lists the modules by section, and opens one', async () => {
    await openPanel(page)
    for (const section of [
      he.navigation.sections.structure,
      he.navigation.sections.leaveSetup,
      he.navigation.sections.access,
      he.navigation.sections.data,
    ]) {
      await expect(navigationPanel(page).getByRole('heading', { name: section, exact: true })).toBeVisible()
    }
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
  })

  await test.step('a single unit in sight names the scope, as a label and not a picker', async () => {
    await expect(page.getByRole('button', { name: new RegExp(he.workspace.unit) })).toHaveCount(0)
    await expect(page.getByText(COMPANY, { exact: true })).toBeVisible()
  })

  await test.step('a pinned module joins the bar, and leaves it when unpinned', async () => {
    const pin = `${he.navigation.pin} ${he.soldiers.open}`
    await openPanel(page)
    const toggle = navigationPanel(page).getByRole('button', { name: pin })
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Escape')
    const pinned = navigation(page).getByRole('button', { name: he.soldiers.open, exact: true })
    await expect(pinned).toBeVisible()
    await page.reload()
    await expect(pinned).toBeVisible()
    await testInfo.attach('pinned', { body: await page.screenshot(), contentType: 'image/png' })
    await pinned.click()
    await expect(drawer(page).getByRole('heading', { name: he.soldiers.title, exact: true })).toBeVisible()
    await closeDrawer(page)
    await openPanel(page)
    await navigationPanel(page).getByRole('button', { name: pin }).click()
    await page.keyboard.press('Escape')
    await expect(pinned).toHaveCount(0)
  })

  await test.step('the rules row placement is kept', async () => {
    await openPanel(page)
    await press(page, 'radio', he.navigation.rulesRowAbove)
    await expect(page.getByRole('radio', { name: he.navigation.rulesRowAbove })).toBeChecked()
    await page.keyboard.press('Escape')
    await page.reload()
    await openPanel(page)
    await expect(page.getByRole('radio', { name: he.navigation.rulesRowAbove })).toBeChecked()
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

  await test.step('the soldier links and reaches the board', async () => {
    await page.getByRole('button', { name: he.account.menu }).click()
    await page.getByRole('menuitem', { name: he.account.signOut }).click()
    await expect(page).toHaveURL(/\/sign-in$/)
    await signIn(page, soldier.email)
    await expect(page).toHaveURL(/\/onboarding$/)
    await page.getByLabel(he.linkRequest.firstName).fill(soldier.first)
    await page.getByLabel(he.linkRequest.lastName).fill(soldier.last)
    await page.getByLabel(he.linkRequest.personalId).fill(soldier.personalId)
    await page.getByRole('button', { name: he.linkRequest.submit }).click()
    await expect(navigation(page).getByRole('button', { name: he.myLeaves.open })).toBeVisible()
  })

  await test.step('the panel holds only what the fighter may open: their own record', async () => {
    await expect(page.getByRole('button', { name: new RegExp(he.workspace.unit) })).toHaveCount(0)
    await openPanel(page)
    // Viewing their own record opens the soldiers module (D-053); nothing else of the panel is theirs.
    await expect(navigationPanel(page).getByRole('button', { name: he.soldiers.open, exact: true })).toBeVisible()
    for (const name of [he.units.open, he.leaveTypes.open, he.tags.open, he.roles.open, he.grants.open, he.transfer.open]) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
    }
    for (const section of [he.navigation.sections.leaveSetup, he.navigation.sections.access, he.navigation.sections.data]) {
      await expect(navigationPanel(page).getByRole('heading', { name: section, exact: true })).toHaveCount(0)
    }
    await expectNoAxeViolations(page)
  })
})
