import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { TYPE, YAEL, enterAsYael, setUpFighter, signOut } from './support/fighter.ts'
import { choose, drawer, typeDate, openNewLeave } from './support/leaves.ts'
import { stubPush, subscribeCalls } from './support/push.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations, signIn, openMePage, openRequests, requestsList, backToBoard } from './support/workspace.ts'

// The notifications slice's demo (D-352, D-356): the profile's "התראות" group with a stubbed push manager, and the
// updates on "שלי" after the owner approves Yael's request. On desktop and mobile, RTL, with axe. Sample data, tests
// only.

/** "העדפות" of "אני", where the notifications card is (D-356, D-488). */
async function openMe(page: Page) {
  await openMePage(page, 'preferences')
  await expect(page.getByRole('button', { name: he.account.signOut, exact: true })).toBeVisible()
}

function menuItem(page: Page, name: string) {
  return page.getByRole('switch', { name, exact: true })
}

/** A switch hides its input inside its label: a person presses the label. */
function switchLabel(page: Page, name: string) {
  return page.locator('label').filter({ has: menuItem(page, name) })
}

async function turnDeviceOn(page: Page) {
  await openMe(page)
  const device = menuItem(page, he.notifications.device)
  await expect(device).not.toBeChecked()
  const before = await subscribeCalls(page)
  await switchLabel(page, he.notifications.device).click()
  await expect.poll(() => subscribeCalls(page)).toBe(before + 1)
  await expect(device).toBeChecked()
}

test('the profile turns this device on, and offers only the kinds the soldier can get', async ({ page }) => {
  await stubPush(page)
  await setUpFighter(page)

  await test.step('the owner turns the device on, and both kinds follow', async () => {
    await turnDeviceOn(page)
    await expect(menuItem(page, he.notifications.kindMyRequest)).toBeChecked()
    await expect(menuItem(page, he.notifications.kindAwaitingMe)).toBeChecked()
    await expectNoAxeViolations(page)
  })

  await test.step('Yael approves nothing, so she gets her own requests only', async () => {
    // Signing out forgets this device first (D-358).
    await signOut(page)
    await enterAsYael(page)
    await turnDeviceOn(page)
    await expect(menuItem(page, he.notifications.kindMyRequest)).toBeVisible()
    await expect(menuItem(page, he.notifications.kindAwaitingMe)).toHaveCount(0)
  })
})

test('a browser that cannot push shows no "התראות" group', async ({ page }) => {
  await stubPush(page, { withPushManager: false })
  await enterAsOwner(page)
  await openMe(page)
  await expect(page.getByText(he.notifications.group, { exact: true })).toHaveCount(0)
  await expect(menuItem(page, he.notifications.device)).toHaveCount(0)
})

test('the owner approves Yael\'s request, and "שלי" shows her the update', async ({ page }) => {
  await setUpFighter(page)
  await signOut(page)
  await enterAsYael(page)

  await test.step('Yael asks for a leave', async () => {
    await openNewLeave(page)
    await choose(page, he.leaves.type, TYPE)
    await typeDate(page, he.leaves.from, '15', '11', '2026')
    await typeDate(page, he.leaves.to, '16', '11', '2026')
    await drawer(page).getByRole('button', { name: he.leaves.submit, exact: true }).click()
    await expect(drawer(page)).toBeHidden()
  })

  await test.step('the owner approves it', async () => {
    await signOut(page)
    await signIn(page, OWNER.email)
    await openRequests(page)
    const list = requestsList(page)
    await list.getByRole('button', { name: he.leaves.approve }).click()
    await expect(page.getByText(he.inbox.emptyPendingTitle)).toBeVisible()
    await backToBoard(page)
    await signOut(page)
  })

  const updates = page.getByRole('main').getByRole('button', { name: new RegExp(`^${he.me.notificationsTitle}`) })

  await test.step('the bell of "היום" counts one unread update, and its drawer shows the line (D-488)', async () => {
    await signIn(page, YAEL.email)
    await expect(updates).toHaveAccessibleName(`${he.me.notificationsTitle} 1 ${he.myLeaves.updatesUnread}`)
    await updates.click()
    const lines = drawer(page).getByRole('list', { name: he.me.notificationsTitle })
    await expect(lines.getByRole('listitem')).toHaveCount(1)
    // A fighter who cannot read the approver's record sees a neutral name (D-119).
    await expect(lines).toContainText(he.myLeaves.updateVerbs.approved)
    await expectNoAxeViolations(page)
  })

  await test.step('after a reload the update is read: no count, and the drawer still lists it', async () => {
    await page.goto('/')
    await expect(updates).toHaveAccessibleName(he.me.notificationsTitle)
    await updates.click()
    await expect(drawer(page).getByRole('list', { name: he.me.notificationsTitle }).getByRole('listitem')).toHaveCount(1)
  })
})
