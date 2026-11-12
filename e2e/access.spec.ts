import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, board, choose, closeDrawer, drawer, openRotation } from './support/leaves.ts'
import { addUnit, OWNER, enterAsOwner, expectNoAxeViolations, openModule, signIn } from './support/workspace.ts'

// V10's demo: the owner builds a role, gives it to a soldier for a while with a personal grant, the soldier sees the
// board through it, and the board closes again when the grant is revoked (D-165, D-166). On desktop and mobile, RTL,
// with axe. Sample data, tests only.

const UNIT = 'מחלקה ג'
const YAEL = { email: 'yael.r@example.test', first: 'יעל', last: 'רון', personalId: '5566778' }
const ROLE = 'צופה בלוח'
const VIEWS = [
  he.permissionLabels.resources.organization,
  he.permissionLabels.resources.units,
  he.permissionLabels.resources.soldiers,
  he.permissionLabels.resources.memberships,
  he.permissionLabels.resources.leaves,
]

async function signOut(page: Page) {
  await page.getByRole('button', { name: he.account.menu }).click()
  await page.getByRole('menuitem', { name: he.account.signOut }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
}

async function createUnit(page: Page) {
  await openModule(page, he.units.open)
  await addUnit(page, UNIT)
  await closeDrawer(page)
}

/** A soldier with the private fields auto-link reads (D-153). */
async function addYael(page: Page) {
  await openModule(page, he.soldiers.open)
  await page.getByRole('button', { name: he.soldiers.new }).first().click()
  await page.getByLabel(he.soldiers.firstName).fill(YAEL.first)
  await page.getByLabel(he.soldiers.lastName).fill(YAEL.last)
  await page.getByLabel(he.soldiers.personalId).fill(YAEL.personalId)
  await page.getByLabel(he.soldiers.inviteEmail).fill(YAEL.email)
  await page.getByRole('button', { name: he.common.create }).click()
  const name = `${YAEL.first} ${YAEL.last}`
  await expect(page.getByRole('list', { name: he.soldiers.listLabel }).getByText(name, { exact: true })).toBeVisible()
  await closeDrawer(page)
}

/** Yael signs in; the personal number and the invite email link her without a reviewer. */
async function enterAsYael(page: Page) {
  await signIn(page, YAEL.email)
  await expect(page).toHaveURL(/\/onboarding$/)
  await page.getByLabel(he.linkRequest.firstName).fill(YAEL.first)
  await page.getByLabel(he.linkRequest.lastName).fill(YAEL.last)
  await page.getByLabel(he.linkRequest.personalId).fill(YAEL.personalId)
  await page.getByRole('button', { name: he.linkRequest.submit }).click()
}

test.describe('roles and access', () => {
  test('a role, a personal grant that opens the board, and its revocation', async ({ page }) => {
    await page.clock.setFixedTime(NOW)
    await enterAsOwner(page)
    await createUnit(page)
    await addYael(page)
    await openRotation(page, [`${YAEL.first} ${YAEL.last}`])

    await test.step('the owner builds a role from the permission grid', async () => {
      await openModule(page, he.roles.open)
      // The bootstrap left the owner's role; a new one sits beside it.
      await drawer(page).getByRole('button', { name: he.roles.new }).click()
      await page.getByLabel(he.roles.name).fill(ROLE)
      for (const resource of VIEWS) {
        const group = drawer(page).getByRole('group', { name: resource, exact: true })
        await group
          .locator('label')
          .filter({ has: page.getByRole('checkbox', { name: he.permissionLabels.actions.view, exact: true }) })
          .click()
      }
      await expectNoAxeViolations(page)
      await page.getByRole('button', { name: he.common.create }).click()
      const roles = drawer(page).getByRole('list', { name: he.roles.listLabel })
      await expect(roles.getByText(ROLE, { exact: true })).toBeVisible()
      await closeDrawer(page)
    })

    await test.step('a personal grant gives the role to Yael over the whole organization', async () => {
      await openModule(page, he.grants.open)
      await drawer(page).getByRole('button', { name: he.grants.new }).first().click()
      await drawer(page).getByRole('combobox', { name: he.grants.grantee }).fill(YAEL.first)
      await page.getByRole('option', { name: `${YAEL.first} ${YAEL.last}` }).click()
      await choose(page, he.grants.role, ROLE)
      await choose(page, he.scope.anchor, he.scope.anchors.organization)
      await expectNoAxeViolations(page)
      await page.getByRole('button', { name: he.common.create }).click()
      const grants = drawer(page).getByRole('list', { name: he.grants.listLabel })
      const yael = grants.getByRole('listitem').filter({ hasText: `${YAEL.first} ${YAEL.last}` })
      await expect(yael.getByText(he.grants.states.active, { exact: true })).toBeVisible()
      await expectNoAxeViolations(page)
      await closeDrawer(page)
    })

    await test.step('Yael links on her own and sees the board through the grant', async () => {
      await signOut(page)
      await enterAsYael(page)
      await expect(board(page).getByText(`${YAEL.first} ${YAEL.last}`).first()).toBeVisible()
      await expect(page.getByText(he.timeline.noDayBody)).toHaveCount(0)
      await expectNoAxeViolations(page)
    })

    await test.step('the owner revokes the grant, and the board closes for Yael', async () => {
      await signOut(page)
      await signIn(page, OWNER.email)
      await openModule(page, he.grants.open)
      const grants = drawer(page).getByRole('list', { name: he.grants.listLabel })
      const yael = grants.getByRole('listitem').filter({ hasText: `${YAEL.first} ${YAEL.last}` })
      await yael.getByRole('button', { name: he.common.actions }).click()
      await page.getByRole('menuitem', { name: he.grants.revoke }).click()
      await page.getByRole('button', { name: he.grants.revokeConfirm }).click()
      await expect(drawer(page).getByText(`${YAEL.first} ${YAEL.last}`, { exact: true })).toHaveCount(0)
      await drawer(page).locator('label').filter({ has: page.getByRole('switch', { name: he.grants.showInactive }) }).click()
      const revoked = grants.getByRole('listitem').filter({ hasText: `${YAEL.first} ${YAEL.last}` })
      await expect(revoked.getByText(he.grants.states.revoked, { exact: true })).toBeVisible()
      await closeDrawer(page)

      await signOut(page)
      await signIn(page, YAEL.email)
      await expect(page.getByText(he.timeline.noDayBody)).toBeVisible()
    })
  })
})
