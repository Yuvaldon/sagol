import { expect, type Page } from '@playwright/test'
import { dictionary as he } from '../../src/i18n/he/dictionary.ts'
import { NOW, choose, closeDrawer, createType, drawer, openRotation } from './leaves.ts'
import { enterAsOwner, navigation, openModule, signIn } from './workspace.ts'

// What the fighter demos share: the owner's unit, a type, Yael who links on her own, the fighter role as the
// baseline, and a rotation she serves in (D-167, D-216). Sample data, tests only.

export const UNIT = 'מחלקה ד'
export const TYPE = 'רגילה'
export const YAEL = { email: 'yael.s@example.test', first: 'יעל', last: 'סלע', personalId: '6677889' }
export const YAEL_NAME = `${YAEL.first} ${YAEL.last}`
const ROLE = 'לוחם'
const SELF_PERMISSIONS: readonly (readonly [string, readonly string[]])[] = [
  [he.permissionLabels.resources.soldiers, [he.permissionLabels.actions.view]],
  [he.permissionLabels.resources.leave_types, [he.permissionLabels.actions.view]],
  [he.permissionLabels.resources.leaves, [he.permissionLabels.actions.view, he.permissionLabels.actions.create]],
  [he.permissionLabels.resources.leave_comments, [he.permissionLabels.actions.view, he.permissionLabels.actions.create]],
]

export async function signOut(page: Page) {
  await page.getByRole('button', { name: he.account.menu }).click()
  await page.getByRole('menuitem', { name: he.account.signOut }).click()
  await expect(page).toHaveURL(/\/sign-in(\?view=\w+)?$/)
}

/** The owner's setup: a unit, a type, Yael with the fields auto-link reads, the fighter role as the baseline, a rotation. */
export async function setUpFighter(page: Page) {
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
  await expect(page.getByRole('list', { name: he.soldiers.listLabel }).getByText(YAEL_NAME)).toBeVisible()
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

  await openRotation(page, [YAEL_NAME])
}

/** Yael signs in; the personal number and the invite email link her without a reviewer. */
export async function enterAsYael(page: Page) {
  await signIn(page, YAEL.email)
  await expect(page).toHaveURL(/\/onboarding(\?view=\w+)?$/)
  await page.getByLabel(he.linkRequest.firstName).fill(YAEL.first)
  await page.getByLabel(he.linkRequest.lastName).fill(YAEL.last)
  await page.getByLabel(he.linkRequest.personalId).fill(YAEL.personalId)
  await page.getByRole('button', { name: he.linkRequest.submit }).click()
  await expect(navigation(page).getByRole('button', { name: he.myLeaves.open })).toBeVisible()
}
