import { expect, test } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { createSoldier } from './support/soldiers.ts'
import { NOW, choose, closeDrawer, drawer, openRotation } from './support/leaves.ts'
import { openOptions, optionsMenu } from './support/board.ts'
import {
  ORGANIZATION,
  addUnit,
  OWNER,
  enterAsOwner,
  expectNoAxeViolations,
  managePage,
  navigation,
  openModule,
  openSetup,
  openTab,
  signIn,
  signOut,
  tab,
} from './support/workspace.ts'

// The tab bar holds the destinations; the tools sit in "ניהול" and the modules that set the unit up on its settings
// page by group, each with its plain line and none pinned out (D-254, D-456); the scope label names the single root
// unit (D-173, D-253). On desktop and mobile, RTL, with axe. Sample data, tests only.

const COMPANY = 'פלוגה א'
const ROLE = 'לוחם'
/** A fighter's own record and own requests (D-003), and nothing that sets the organization up. */
const SELF_PERMISSIONS: readonly (readonly [string, readonly string[]])[] = [
  [he.permissionLabels.resources.soldiers, [he.permissionLabels.actions.view]],
  [he.permissionLabels.resources.leaves, [he.permissionLabels.actions.view, he.permissionLabels.actions.create]],
]

test('"ניהול" and the scope label', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)
  await testInfo.attach('bars', { body: await page.screenshot(), contentType: 'image/png' })

  await test.step('with no rotation, the root unit from the claim holds one, so the owner is offered to open it (D-218, D-223)', async () => {
    await expect(page.getByRole('heading', { name: he.workspace.routineTitle })).toBeVisible()
    await expect(page.getByText(he.workspace.routineOpenBody)).toBeVisible()
    await expectNoAxeViolations(page)
    // "היום" says the same, and has no request to offer while no rotation takes one.
    await openTab(page, 'today')
    await expect(page.getByRole('heading', { name: he.workspace.routineTitle })).toBeVisible()
    await expect(page.getByRole('button', { name: he.leaves.new })).toHaveCount(0)
    // The bell is the owner's in routine too: an update of the last days still matters there (D-488).
    await expect(page.getByRole('main').getByRole('button', { name: new RegExp(`^${he.me.notificationsTitle}`) })).toBeVisible()
    await expectNoAxeViolations(page)
    await page.getByRole('button', { name: he.workspace.openRotation }).click()
    await expect(page).toHaveURL(/panel=deployments&entity=new/)
    await closeDrawer(page)
  })

  await test.step('the tab bar holds the destinations only; the modules are not in it', async () => {
    await expect(navigation(page).getByRole('button')).toHaveCount(4)
    // On a phone a tab is an icon; the side rail of a wide screen writes each name under its icon (D-491).
    if (testInfo.project.name === 'desktop') await expect(tab(page, 'me')).toContainText(he.shell.tabMe)
    for (const name of [he.units.open, he.soldiers.open, he.roles.open, he.transfer.open]) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
    }
  })

  await test.step('"ניהול" lists the tools, its settings page the modules by section, and a row opens one', async () => {
    await openTab(page, 'manage')
    await expect(page.getByRole('heading', { level: 1, name: he.navigation.tab, exact: true })).toBeVisible()
    await expect(managePage(page).getByText(ORGANIZATION, { exact: true })).toBeVisible()
    // The tools first; what a unit defines once is a step in, behind the last row, with a way back (D-285, D-456).
    // The rows; the bell in the corner is not one (D-488).
    const rows = managePage(page).getByRole('listitem').getByRole('button')
    await expect(rows).toHaveText([
      new RegExp(`^${he.soldiers.open}`),
      new RegExp(`^${he.accountLinks.open}`),
      new RegExp(`^${he.rules.open}`),
      new RegExp(`^${he.units.open}`),
      new RegExp(`^${he.deployments.open}`),
      new RegExp(`^${he.dashboard.open}`),
      new RegExp(`^${he.navigation.setupOpen}`),
    ])
    // A row is named by its tool alone; what it holds describes it.
    await expect(managePage(page).getByRole('button', { name: he.soldiers.open, exact: true })).toHaveAccessibleDescription('1')
    await expect(managePage(page).getByRole('heading', { name: he.navigation.sections.structure, exact: true })).toHaveCount(0)
    await expectNoAxeViolations(page)
    await testInfo.attach('manage', { body: await page.screenshot(), contentType: 'image/png' })
    await openSetup(page)
    // The page takes the keyboard on its heading, and a reload keeps the page, never another screen first.
    await expect(page.getByRole('heading', { level: 1, name: he.navigation.setupOpen, exact: true })).toBeFocused()
    // Closing returns the keyboard to the row that opened the page.
    await managePage(page).getByRole('button', { name: he.shell.back, exact: true }).click()
    await expect(managePage(page).getByRole('button', { name: he.navigation.setupOpen, exact: true })).toBeFocused()
    await openSetup(page)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: he.navigation.setupOpen, exact: true })).toBeVisible()
    for (const section of [
      he.navigation.sections.structure,
      he.navigation.sections.access,
      he.navigation.sections.catalogs,
      he.navigation.sections.data,
      he.navigation.sections.advanced,
    ]) {
      await expect(managePage(page).getByRole('heading', { name: section, exact: true })).toBeVisible()
    }
    // Each module says what it is for, and none can be pinned (D-250, D-254).
    await expect(managePage(page).getByRole('button', { name: he.roles.open, exact: true })).toHaveAccessibleDescription(he.navigation.lines.roles)
    await expect(managePage(page).locator('[aria-pressed]')).toHaveCount(0)
    await expectNoAxeViolations(page)
    await testInfo.attach('settings', { body: await page.screenshot(), contentType: 'image/png' })
    await managePage(page).getByRole('button', { name: he.shell.back, exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: he.navigation.tab, exact: true })).toBeVisible()
    await openModule(page, he.units.open)
    await closeDrawer(page)
    // The root unit from the claim is the only unit, and it holds the rotation (D-223).
    await openRotation(page, [OWNER.name])
    // With a rotation that takes requests, "היום" offers one, and the updates of the owner's own requests.
    await openTab(page, 'today')
    await expect(page.getByRole('button', { name: he.leaves.new, exact: true })).toBeVisible()
    await expect(page.getByRole('main').getByRole('button', { name: new RegExp(`^${he.me.notificationsTitle}`) })).toBeVisible()
    await openTab(page, 'board')
  })

  await test.step('a single unit in sight is the only scope: the options offer no unit to choose (D-273, D-480)', async () => {
    await openOptions(page)
    await expect(optionsMenu(page).getByRole('button', { name: new RegExp(`^${he.board.unit} · `) })).toHaveCount(0)
    await expect(optionsMenu(page).getByRole('button', { name: new RegExp(`^${he.board.sort} · `) })).toBeVisible()
    await page.keyboard.press('Escape')
  })
})

test('a fighter sees only the modules their permissions open, and no unit picker', async ({ page }) => {
  const soldier = { email: 'noa@example.test', first: 'נועה', last: 'בר', personalId: '5566778' }
  await enterAsOwner(page)

  await test.step('the owner sets up a unit, a soldier with an invite, and the fighter role as the baseline', async () => {
    await openModule(page, he.units.open)
    await addUnit(page, COMPANY)
    await closeDrawer(page)
    await createSoldier(page, soldier.first, soldier.last, async () => {
      await page.getByLabel(he.soldiers.personalId).fill(soldier.personalId)
      await page.getByLabel(he.soldiers.inviteEmail).fill(soldier.email)
    })
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
    await signOut(page)
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
    // Reading her own leaves, she has the bell (D-488), and nothing to request.
    await expect(page.getByRole('main').getByRole('button', { name: new RegExp(`^${he.me.notificationsTitle}`) })).toBeVisible()
    await expect(page.getByRole('button', { name: he.leaves.new })).toHaveCount(0)
    // Reading nobody else's leaves, the fighter has no board (D-455).
    await expect(tab(page, 'board')).toHaveCount(0)
    await expectNoAxeViolations(page)
  })

  await test.step('"ניהול" holds only what the fighter may open: their own record', async () => {
    await expect(page.getByRole('button', { name: new RegExp(`^${he.board.unit} · `) })).toHaveCount(0)
    await openTab(page, 'manage')
    // Viewing their own record opens the soldiers module (D-053); nothing else of "ניהול" is theirs.
    await expect(managePage(page).getByRole('button', { name: he.soldiers.open, exact: true })).toBeVisible()
    await expect(managePage(page).getByRole('listitem').getByRole('button')).toHaveCount(1)
    for (const name of [he.units.open, he.leaveTypes.open, he.tags.open, he.roles.open, he.grants.open, he.transfer.open]) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
    }
    // No setting of the unit is theirs, so its row is not there either (D-285).
    await expect(managePage(page).getByRole('button', { name: he.navigation.setupOpen, exact: true })).toHaveCount(0)
    await expectNoAxeViolations(page)
  })
})

test('on a tablet held upright, no row of "ניהול" stretches to fill it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one tablet shape, set here')
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)
  await openTab(page, 'manage')
  // The unit is not set up yet: its settings are the last row, a row like the others (D-285).
  const setup = managePage(page).getByRole('button', { name: he.navigation.setupOpen, exact: true })
  await expect(setup).toBeVisible()
  await testInfo.attach('manage, tablet upright', { body: await page.screenshot(), contentType: 'image/png' })
  const heights = await managePage(page)
    .getByRole('button')
    .evaluateAll((buttons) => buttons.map((button) => ({ name: button.textContent ?? '', height: button.getBoundingClientRect().height })))
  expect(heights.length).toBeGreaterThan(1)
  // A row is one line tall, never the page's leftover height.
  for (const row of heights) expect(row.height, row.name).toBeLessThanOrEqual(64)
})
