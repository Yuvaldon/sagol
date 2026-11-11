import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { choose, closeDrawer, drawer } from './support/leaves.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations, navigation, signIn, waitForSettledScreen } from './support/workspace.ts'

// V9's demo: a second identity asks to link and the owner reviews. Auto-link on the personal number and the invite
// email, a link to a candidate, a new soldier from the request, a rejection, and the identity that waits. On desktop
// and mobile, RTL, with axe. Sample data, tests only.

const UNIT = 'מחלקה א'
const YAEL = { email: 'yael@example.test', first: 'יעל', last: 'שחר', personalId: '4455667' }
const ASHER = { email: 'asher@example.test', first: 'אשר', last: 'פרץ' }
const GIL = { email: 'gil@example.test', first: 'גיל', last: 'חדש', personalId: '7770001' }
const DANA = { email: 'dana.k@example.test', first: 'דנה', last: 'כהן' }

async function userMenu(page: Page, item: string | RegExp) {
  await page.getByRole('button', { name: he.account.menu }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

async function signOut(page: Page) {
  await userMenu(page, he.account.signOut)
  await expect(page).toHaveURL(/\/sign-in$/)
}

async function createUnit(page: Page, name: string) {
  await navigation(page).getByRole('button', { name: he.units.open }).click()
  await page.getByRole('button', { name: he.units.new }).first().click()
  await page.getByLabel(he.units.name).fill(name)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(page.getByRole('list', { name: he.units.listLabel }).getByText(name, { exact: true })).toBeVisible()
  await closeDrawer(page)
}

/** A soldier in the unit, with the private fields auto-link reads (D-153). */
async function addSoldier(page: Page, first: string, last: string, privateFields?: { personalId: string; email: string }) {
  await navigation(page).getByRole('button', { name: he.soldiers.open }).click()
  await page.getByRole('button', { name: he.soldiers.new }).first().click()
  await page.getByLabel(he.soldiers.firstName).fill(first)
  await page.getByLabel(he.soldiers.lastName).fill(last)
  if (privateFields !== undefined) {
    await page.getByLabel(he.soldiers.personalId).fill(privateFields.personalId)
    await page.getByLabel(he.soldiers.inviteEmail).fill(privateFields.email)
  }
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(page.getByRole('list', { name: he.soldiers.listLabel }).getByText(`${first} ${last}`, { exact: true })).toBeVisible()
  await closeDrawer(page)
}

/** An identity signs in and asks to link. */
async function ask(page: Page, who: { email: string; first: string; last: string; personalId?: string }) {
  await signIn(page, who.email)
  await expect(page).toHaveURL(/\/onboarding$/)
  await page.getByLabel(he.linkRequest.firstName).fill(who.first)
  await page.getByLabel(he.linkRequest.lastName).fill(who.last)
  if (who.personalId !== undefined) await page.getByLabel(he.linkRequest.personalId).fill(who.personalId)
  await page.getByRole('button', { name: he.linkRequest.submit }).click()
}

function accountLinksButton(page: Page) {
  return navigation(page).getByRole('button', { name: new RegExp(he.accountLinks.open) })
}

async function openRequest(page: Page, name: string) {
  await accountLinksButton(page).click()
  await expect(page.getByRole('heading', { name: he.accountLinks.title, exact: true })).toBeVisible()
  await page.getByRole('list', { name: he.accountLinks.listLabel }).getByRole('button', { name: new RegExp(name) }).click()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
}

/** From an identity waiting on the onboarding screen back to the owner, through the device's identity list. */
async function backToOwner(page: Page) {
  await page.getByRole('button', { name: new RegExp(OWNER.email) }).click()
  await expect(accountLinksButton(page)).toBeVisible()
}

test.describe('account linking', () => {
  test('auto-link, a link to a candidate, and an identity that waits', async ({ page }) => {
    await enterAsOwner(page)
    await createUnit(page, UNIT)
    await addSoldier(page, YAEL.first, YAEL.last, { personalId: YAEL.personalId, email: YAEL.email })
    await addSoldier(page, ASHER.first, ASHER.last)

    await test.step('the owner has nothing to review, and the invite email is a private field', async () => {
      await accountLinksButton(page).click()
      await expect(page.getByText(he.accountLinks.emptyTitle)).toBeVisible()
      await closeDrawer(page)
    })

    await test.step('a verified invite email and the personal number link without a reviewer (D-005)', async () => {
      await signOut(page)
      await ask(page, { ...YAEL })
      await expect(page.getByText(he.timeline.noDayBody)).toBeVisible()
      await expect(page.getByText(he.linkRequest.waitingTitle)).toHaveCount(0)
      await expectNoAxeViolations(page)
    })

    await test.step('without a match the identity asks, and waits', async () => {
      await signOut(page)
      await signIn(page, ASHER.email)
      await expect(page).toHaveURL(/\/onboarding$/)
      await expect(page.getByRole('heading', { name: he.noAccess.title })).toBeVisible()
      await expectNoAxeViolations(page)
      await page.getByLabel(he.linkRequest.firstName).fill(ASHER.first)
      await page.getByLabel(he.linkRequest.lastName).fill(ASHER.last)
      await page.getByRole('button', { name: he.linkRequest.submit }).click()
      await expect(page.getByRole('heading', { name: he.linkRequest.waitingTitle })).toBeVisible()
      await expect(page.getByText(`${ASHER.first} ${ASHER.last}`)).toBeVisible()
      await expectNoAxeViolations(page)
    })

    await test.step('the asker withdraws, and may ask again', async () => {
      await page.getByRole('button', { name: he.linkRequest.withdraw }).click()
      await expect(page.getByLabel(he.linkRequest.firstName)).toBeVisible()
      await page.getByLabel(he.linkRequest.firstName).fill(ASHER.first)
      await page.getByLabel(he.linkRequest.lastName).fill(ASHER.last)
      await page.getByRole('button', { name: he.linkRequest.submit }).click()
      await expect(page.getByRole('heading', { name: he.linkRequest.waitingTitle })).toBeVisible()
    })

    await test.step('the owner sees the request, with the soldier whose name matches', async () => {
      await backToOwner(page)
      await expect(accountLinksButton(page)).toContainText('1')
      await openRequest(page, `${ASHER.first} ${ASHER.last}`)
      const candidates = page.getByRole('list', { name: he.accountLinks.candidatesLabel })
      await expect(candidates.getByRole('listitem')).toHaveCount(1)
      await expect(candidates.getByText(he.accountLinks.matchName)).toBeVisible()
      await waitForSettledScreen(page)
      await expectNoAxeViolations(page)
    })

    await test.step('linking asks first, and lets the identity in as that soldier', async () => {
      await page.getByRole('button', { name: he.accountLinks.link, exact: true }).click()
      await expect(page.getByRole('dialog').last().getByText(he.accountLinks.linkTitle)).toBeVisible()
      await waitForSettledScreen(page)
      await page.getByRole('dialog').last().getByRole('button', { name: he.accountLinks.linkConfirm }).click()
      await expect(page.getByText(he.accountLinks.emptyTitle)).toBeVisible()
      await closeDrawer(page)
      await userMenu(page, he.account.signOut)
      await signIn(page, ASHER.email)
      await expect(page.getByText(he.timeline.noDayBody)).toBeVisible()
    })
  })

  test('a new soldier from a request, and a rejection', async ({ page }) => {
    await enterAsOwner(page)
    await createUnit(page, UNIT)

    await test.step('two identities ask and wait', async () => {
      await signOut(page)
      await ask(page, GIL)
      await expect(page.getByRole('heading', { name: he.linkRequest.waitingTitle })).toBeVisible()
      await page.getByRole('button', { name: he.account.signOut }).click()
      await ask(page, DANA)
      await expect(page.getByRole('heading', { name: he.linkRequest.waitingTitle })).toBeVisible()
      await backToOwner(page)
      await expect(accountLinksButton(page)).toContainText('2')
    })

    await test.step('with no soldier to match, the owner creates one from the request', async () => {
      await openRequest(page, `${GIL.first} ${GIL.last}`)
      await expect(page.getByText(he.accountLinks.noCandidates)).toBeVisible()
      await page.getByRole('button', { name: he.accountLinks.createSoldier }).click()
      await expect(drawer(page).getByRole('heading', { name: he.accountLinks.createTitle })).toBeVisible()
      await waitForSettledScreen(page)
      await expectNoAxeViolations(page)
      await choose(page, he.soldiers.unit, UNIT)
      await page.getByRole('button', { name: he.accountLinks.createSubmit }).click()
      await expect(page.getByRole('list', { name: he.accountLinks.listLabel })).toHaveCount(1)
    })

    await test.step('the new soldier is on the roster with the number of the request', async () => {
      await closeDrawer(page)
      await navigation(page).getByRole('button', { name: he.soldiers.open }).click()
      const name = `${GIL.first} ${GIL.last}`
      await page.getByRole('list', { name: he.soldiers.listLabel }).getByRole('button', { name: new RegExp(name) }).click()
      await expect(page.getByLabel(he.soldiers.personalId)).toHaveValue(GIL.personalId)
      await closeDrawer(page)
    })

    await test.step('a rejection asks first, and the asker is shown the form again', async () => {
      await openRequest(page, `${DANA.first} ${DANA.last}`)
      await page.getByRole('button', { name: he.accountLinks.reject }).click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
      await waitForSettledScreen(page)
      await page.getByRole('alertdialog').getByRole('button', { name: he.accountLinks.rejectConfirm }).click()
      await expect(page.getByText(he.accountLinks.emptyTitle)).toBeVisible()
      await closeDrawer(page)
      await userMenu(page, he.account.signOut)
      await signIn(page, DANA.email)
      await expect(page.getByLabel(he.linkRequest.firstName)).toBeVisible()
      await expect(page.getByText(he.linkRequest.waitingTitle)).toHaveCount(0)
    })
  })
})
