import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, choose, closeDrawer, createType, drawer, openRotation, typeDate } from './support/leaves.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations, navigation, openModule, signIn } from './support/workspace.ts'

// V11's demo: a fighter links on their own, asks for a leave from "my requests", comments on it, the owner approves
// it in the inbox, and the fighter sees it approved (D-167). On desktop and mobile, RTL, with axe. Sample data, tests
// only.

const UNIT = 'מחלקה ד'
const TYPE = 'רגילה'
const YAEL = { email: 'yael.s@example.test', first: 'יעל', last: 'סלע', personalId: '6677889' }
const ROLE = 'לוחם'
const SELF_PERMISSIONS: readonly (readonly [string, readonly string[]])[] = [
  [he.permissionLabels.resources.soldiers, [he.permissionLabels.actions.view]],
  [he.permissionLabels.resources.leave_types, [he.permissionLabels.actions.view]],
  [he.permissionLabels.resources.leaves, [he.permissionLabels.actions.view, he.permissionLabels.actions.create]],
  [he.permissionLabels.resources.leave_comments, [he.permissionLabels.actions.view, he.permissionLabels.actions.create]],
]

async function signOut(page: Page) {
  await page.getByRole('button', { name: he.account.menu }).click()
  await page.getByRole('menuitem', { name: he.account.signOut }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
}

/** The owner's setup: a unit, a type, Yael with the fields auto-link reads, and the fighter role as the baseline. */
async function setUp(page: Page) {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)

  await openModule(page, he.units.open)
  await page.getByRole('button', { name: he.units.new }).first().click()
  await page.getByLabel(he.units.name).fill(UNIT)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(page.getByRole('list', { name: he.units.listLabel }).getByText(UNIT, { exact: true })).toBeVisible()
  await closeDrawer(page)

  await openModule(page, he.leaveTypes.open)
  await createType(page, { name: TYPE, color: he.palette.teal })
  await closeDrawer(page)

  await openModule(page, he.soldiers.open)
  await page.getByRole('button', { name: he.soldiers.new }).first().click()
  await page.getByLabel(he.soldiers.firstName).fill(YAEL.first)
  await page.getByLabel(he.soldiers.lastName).fill(YAEL.last)
  await page.getByLabel(he.soldiers.personalId).fill(YAEL.personalId)
  await page.getByLabel(he.soldiers.inviteEmail).fill(YAEL.email)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(page.getByRole('list', { name: he.soldiers.listLabel }).getByText(`${YAEL.first} ${YAEL.last}`)).toBeVisible()
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

  await openRotation(page, [`${YAEL.first} ${YAEL.last}`])
}

/** Yael signs in; the personal number and the invite email link her without a reviewer. */
async function enterAsYael(page: Page) {
  await signIn(page, YAEL.email)
  await expect(page).toHaveURL(/\/onboarding$/)
  await page.getByLabel(he.linkRequest.firstName).fill(YAEL.first)
  await page.getByLabel(he.linkRequest.lastName).fill(YAEL.last)
  await page.getByLabel(he.linkRequest.personalId).fill(YAEL.personalId)
  await page.getByRole('button', { name: he.linkRequest.submit }).click()
  await expect(navigation(page).getByRole('button', { name: he.myLeaves.open })).toBeVisible()
}

function openList(page: Page) {
  return drawer(page).getByRole('list', { name: he.myLeaves.openTitle })
}

test('a fighter asks for a leave from "my requests", and sees it approved', async ({ page }) => {
  await setUp(page)
  await signOut(page)
  await enterAsYael(page)

  await test.step('"my requests" sits in the bar and starts empty', async () => {
    await openModule(page, he.myLeaves.open)
    await expect(drawer(page).getByText(he.myLeaves.emptyTitle)).toBeVisible()
    await expectNoAxeViolations(page)
  })

  await test.step('the new request names Yael already, and waits for approval', async () => {
    await closeDrawer(page)
    await page.getByRole('button', { name: he.leaves.new }).click()
    await expect(drawer(page).getByRole('heading', { name: he.leaves.newTitle })).toBeVisible()
    await expect(drawer(page).getByRole('combobox', { name: he.leaves.soldier })).toHaveValue(`${YAEL.first} ${YAEL.last}`)
    await choose(page, he.leaves.type, TYPE)
    await typeDate(page, he.leaves.from, '15', '11', '2026')
    await typeDate(page, he.leaves.to, '16', '11', '2026')
    await drawer(page).getByRole('button', { name: he.leaves.submit, exact: true }).click()
    await expect(drawer(page)).toBeHidden()
    await openModule(page, he.myLeaves.open)
    const row = openList(page).getByRole('button', { name: new RegExp(TYPE) })
    await expect(row.getByText(he.leaves.statusPending, { exact: true })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  await test.step('a row opens the details, where Yael comments', async () => {
    await openList(page).getByRole('button', { name: new RegExp(TYPE) }).click()
    await expect(page).toHaveURL(/panel=leaves&entity=[0-9a-f-]{36}/)
    await drawer(page).getByRole('textbox', { name: he.leaves.commentLabel }).fill('חתונה של אח')
    await drawer(page).getByRole('button', { name: he.leaves.commentAdd }).click()
    await expect(drawer(page).getByRole('list', { name: he.leaves.threadTitle })).toContainText('חתונה של אח')
    await closeDrawer(page)
  })

  await test.step('the owner approves it in the inbox', async () => {
    await signOut(page)
    await signIn(page, OWNER.email)
    await openModule(page, new RegExp(`^${he.inbox.open}( \\d+ ${he.inbox.pendingCount})?$`))
    const list = drawer(page).getByRole('list', { name: he.inbox.pendingLabel })
    await expect(list.getByText(`${YAEL.first} ${YAEL.last}`)).toBeVisible()
    await list.getByRole('button', { name: he.leaves.approve }).click()
    await expect(drawer(page).getByText(he.inbox.emptyPendingTitle)).toBeVisible()
    await closeDrawer(page)
  })

  await test.step('Yael sees it approved', async () => {
    await signOut(page)
    await signIn(page, YAEL.email)
    await openModule(page, he.myLeaves.open)
    const row = openList(page).getByRole('button', { name: new RegExp(TYPE) })
    await expect(row.getByText(he.leaves.statusApproved, { exact: true })).toBeVisible()
    await expectNoAxeViolations(page)
  })
})
