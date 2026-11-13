import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { TYPE, YAEL, enterAsYael, setUpFighter, signOut } from './support/fighter.ts'
import { choose, closeDrawer, drawer, typeDate } from './support/leaves.ts'
import { stubPush, subscribeCalls } from './support/push.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations, navigation, openModule, signIn } from './support/workspace.ts'

// The notifications slice's demo (D-352, D-356): the profile's "התראות" group with a stubbed push manager, and the
// updates on "שלי" after the owner approves Yael's request. On desktop and mobile, RTL, with axe. Sample data, tests
// only.

async function openAccountMenu(page: Page) {
  await page.getByRole('button', { name: he.account.menu }).click()
  await expect(page.getByRole('menuitem', { name: he.account.signOut })).toBeVisible()
}

function menuItem(page: Page, name: string) {
  return page.getByRole('menuitemcheckbox', { name, exact: true })
}

async function turnDeviceOn(page: Page) {
  await openAccountMenu(page)
  const device = menuItem(page, he.notifications.device)
  await expect(device).toHaveAttribute('aria-checked', 'false')
  const before = await subscribeCalls(page)
  await device.click()
  await expect.poll(() => subscribeCalls(page)).toBe(before + 1)
  if (!(await device.isVisible())) await openAccountMenu(page)
  await expect(device).toHaveAttribute('aria-checked', 'true')
}

async function closeMenu(page: Page) {
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toBeHidden()
}

test('the profile turns this device on, and offers only the kinds the soldier can get', async ({ page }) => {
  await stubPush(page)
  await setUpFighter(page)

  await test.step('the owner turns the device on, and both kinds follow', async () => {
    await turnDeviceOn(page)
    await expect(menuItem(page, he.notifications.kindMyRequest)).toHaveAttribute('aria-checked', 'true')
    await expect(menuItem(page, he.notifications.kindAwaitingMe)).toHaveAttribute('aria-checked', 'true')
    await expectNoAxeViolations(page)
    await closeMenu(page)
  })

  await test.step('Yael approves nothing, so she gets her own requests only', async () => {
    // Signing out forgets this device first (D-358).
    await signOut(page)
    await enterAsYael(page)
    await closeDrawer(page)
    await turnDeviceOn(page)
    await expect(menuItem(page, he.notifications.kindMyRequest)).toBeVisible()
    await expect(menuItem(page, he.notifications.kindAwaitingMe)).toHaveCount(0)
    await closeMenu(page)
  })
})

test('a browser that cannot push shows no "התראות" group', async ({ page }) => {
  await stubPush(page, { withPushManager: false })
  await enterAsOwner(page)
  await openAccountMenu(page)
  await expect(page.getByText(he.notifications.group, { exact: true })).toHaveCount(0)
  await expect(menuItem(page, he.notifications.device)).toHaveCount(0)
})

test('the owner approves Yael\'s request, and "שלי" shows her the update', async ({ page }) => {
  await setUpFighter(page)
  await signOut(page)
  await enterAsYael(page)

  await test.step('Yael asks for a leave', async () => {
    await closeDrawer(page)
    await page.getByRole('button', { name: he.leaves.new }).click()
    await choose(page, he.leaves.type, TYPE)
    await typeDate(page, he.leaves.from, '15', '11', '2026')
    await typeDate(page, he.leaves.to, '16', '11', '2026')
    await drawer(page).getByRole('button', { name: he.leaves.submit, exact: true }).click()
    await expect(drawer(page)).toBeHidden()
  })

  await test.step('the owner approves it', async () => {
    await signOut(page)
    await signIn(page, OWNER.email)
    await openModule(page, new RegExp(`^${he.inbox.open}( \\d+ ${he.inbox.pendingCount})?$`))
    const list = drawer(page).getByRole('list', { name: he.inbox.pendingLabel })
    await list.getByRole('button', { name: he.leaves.approve }).click()
    await expect(drawer(page).getByText(he.inbox.emptyPendingTitle)).toBeVisible()
    await closeDrawer(page)
    await signOut(page)
  })

  const unreadOne = new RegExp(`^${he.myLeaves.open} 1 ${he.myLeaves.updatesUnread}$`)

  await test.step('"שלי" counts one unread update, and the section shows its line', async () => {
    await signIn(page, YAEL.email)
    // An address that names a view does not land on "שלי" (D-265), so the count shows before it is opened.
    await page.goto('/?range=week')
    await expect(navigation(page).getByRole('button', { name: unreadOne })).toBeVisible()
    await openModule(page, unreadOne)
    const updates = drawer(page).getByRole('list', { name: he.myLeaves.updatesTitle })
    await expect(updates.getByRole('listitem')).toHaveCount(1)
    // A fighter who cannot read the approver's record sees a neutral name (D-119).
    await expect(updates).toContainText(he.myLeaves.updateVerbs.approved)
    await expectNoAxeViolations(page)
  })

  await test.step('after a reload the update is read: no count, and the section is closed', async () => {
    await page.goto('/?range=week')
    await expect(navigation(page).getByRole('button', { name: he.myLeaves.open, exact: true })).toBeVisible()
    await openModule(page, he.myLeaves.open)
    const trigger = drawer(page).getByRole('button', { name: he.myLeaves.updatesTitle, exact: true })
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await trigger.click()
    await expect(drawer(page).getByRole('list', { name: he.myLeaves.updatesTitle }).getByRole('listitem')).toHaveCount(1)
  })
})
