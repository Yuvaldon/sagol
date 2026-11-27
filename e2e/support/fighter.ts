import { expect, type Page } from '@playwright/test'
import { dictionary as he } from '../../src/i18n/he/dictionary.ts'
import { NOW, choose, closeDrawer, createType, drawer, openRotation } from './leaves.ts'
import { addUnit, enterAsOwner, openModule, signIn, tab } from './workspace.ts'

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

/** Who sees who of their unit is on base with them (D-478). */
const PRESENCE_PERMISSION = [he.permissionLabels.resources.presence, [he.permissionLabels.actions.view]] as const

export { signOut } from './workspace.ts'

export interface FighterOptions {
  /** The fighter role also holds `presence:view` (D-478). */
  readonly presence?: boolean
  /** The fighter role holds only `leaves:view`, beside the presence pair: a role the migration gave it to (D-479). */
  readonly bare?: boolean
  /** Soldiers of the unit beside Yael: with any, she and they are placed in it, and they serve in the rotation too. */
  readonly unitmates?: readonly { readonly first: string; readonly last: string }[]
}

/** The owner's setup: a unit, a type, Yael with the fields auto-link reads, the fighter role as the baseline, a rotation. */
export async function setUpFighter(page: Page, { presence = false, bare = false, unitmates = [] }: FighterOptions = {}) {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)

  await openModule(page, he.units.open)
  await addUnit(page, UNIT)
  await closeDrawer(page)

  await openModule(page, he.leaveTypes.open)
  await createType(page, { name: TYPE, color: he.palette.teal })
  await closeDrawer(page)

  await openModule(page, he.soldiers.open)
  await page.getByRole('button', { name: he.soldiers.new }).first().click()
  await page.getByLabel(he.soldiers.firstName).fill(YAEL.first)
  await page.getByLabel(he.soldiers.lastName).fill(YAEL.last)
  if (unitmates.length > 0) await choose(page, he.soldiers.unit, UNIT)
  await page.getByLabel(he.soldiers.personalId).fill(YAEL.personalId)
  await page.getByLabel(he.soldiers.inviteEmail).fill(YAEL.email)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(page.getByRole('list', { name: he.soldiers.listLabel }).getByText(YAEL_NAME)).toBeVisible()
  for (const mate of unitmates) {
    await page.getByRole('button', { name: he.soldiers.new }).first().click()
    await page.getByLabel(he.soldiers.firstName).fill(mate.first)
    await page.getByLabel(he.soldiers.lastName).fill(mate.last)
    await choose(page, he.soldiers.unit, UNIT)
    await page.getByRole('button', { name: he.common.create }).click()
    await expect(page.getByRole('list', { name: he.soldiers.listLabel }).getByText(`${mate.first} ${mate.last}`, { exact: true })).toBeVisible()
  }
  await closeDrawer(page)

  await openModule(page, he.roles.open)
  await drawer(page).getByRole('button', { name: he.roles.new }).click()
  await page.getByLabel(he.roles.name).fill(ROLE)
  const own = bare ? [[he.permissionLabels.resources.leaves, [he.permissionLabels.actions.view]] as const] : SELF_PERMISSIONS
  for (const [resource, actions] of presence ? [...own, PRESENCE_PERMISSION] : own) {
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

  await openRotation(page, [YAEL_NAME, ...unitmates.map((mate) => `${mate.first} ${mate.last}`)])
}

/** Yael signs in; the personal number and the invite email link her without a reviewer. */
export async function enterAsYael(page: Page) {
  await signIn(page, YAEL.email)
  await expect(page).toHaveURL(/\/onboarding(\?view=\w+(&tab=today)?)?$/)
  await page.getByLabel(he.linkRequest.firstName).fill(YAEL.first)
  await page.getByLabel(he.linkRequest.lastName).fill(YAEL.last)
  await page.getByLabel(he.linkRequest.personalId).fill(YAEL.personalId)
  await page.getByRole('button', { name: he.linkRequest.submit }).click()
  await expect(tab(page, 'today')).toHaveAttribute('aria-current', 'page')
}
