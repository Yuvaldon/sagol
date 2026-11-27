import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { closeDrawer } from './support/leaves.ts'
import { closeDrawers, createSoldier, openManageIndex, openSoldierCard } from './support/soldiers.ts'
import { addUnit, OWNER, enterAsOwner, expectNoAxeViolations, openModule, openTab, signIn, waitForSettledScreen, signOut, tab } from './support/workspace.ts'

// V9's demo: a second identity asks to link and the owner reviews. Auto-link on the personal number and the invite
// email, a link to a candidate, a new soldier from the request, a rejection, and the identity that waits. On desktop
// and mobile, RTL, with axe. Sample data, tests only.

const UNIT = 'מחלקה א'
const YAEL = { email: 'yael@example.test', first: 'יעל', last: 'שחר', personalId: '4455667' }
const ASHER = { email: 'asher@example.test', first: 'אשר', last: 'פרץ' }
const GIL = { email: 'gil@example.test', first: 'גיל', last: 'חדש', personalId: '7770001' }
const DANA = { email: 'dana.k@example.test', first: 'דנה', last: 'כהן' }
const ROTEM = { email: 'rotem@example.test', first: 'רותם', last: 'בר', personalId: '5566778' }

async function createUnit(page: Page, name: string) {
  await openModule(page, he.units.open)
  await addUnit(page, name)
  await closeDrawer(page)
}

/** A soldier in the unit, with the private fields auto-link reads (D-153). */
async function addSoldier(page: Page, first: string, last: string, privateFields?: { personalId: string; email: string }) {
  await createSoldier(page, first, last, async () => {
    if (privateFields === undefined) return
    await page.getByLabel(he.soldiers.personalId).fill(privateFields.personalId)
    await page.getByLabel(he.soldiers.inviteEmail).fill(privateFields.email)
  })
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

/** The "ניהול" tab carries what waits behind it, the requests to link (D-173, D-455). */
function menuButton(page: Page) {
  return tab(page, 'manage')
}

const joinsHeading = (page: Page) => page.getByRole('heading', { level: 1, name: he.manage.pages.joins, exact: true })

/** "הצטרפות", from its row of "ניהול" (D-482). */
async function openJoins(page: Page) {
  await closeDrawers(page)
  if (await joinsHeading(page).isVisible()) return
  await openManageIndex(page)
  if (!(await joinsHeading(page).isVisible())) await page.getByRole('main').getByRole('button', { name: he.accountLinks.open, exact: true }).click()
  await expect(joinsHeading(page)).toBeVisible()
}

/** "זה הוא?" of one request, from its row. */
async function openRequest(page: Page, name: string) {
  await openJoins(page)
  await page.getByRole('main').getByRole('button', { name: new RegExp(name) }).click()
  await expect(page.getByRole('dialog', { name })).toBeVisible()
  await waitForSettledScreen(page)
  return page.getByRole('dialog', { name })
}

/** From an identity waiting on the onboarding screen back to the owner, through the device's identity list. */
async function backToOwner(page: Page) {
  await page.getByRole('button', { name: new RegExp(OWNER.email) }).click()
  await expect(menuButton(page)).toBeVisible()
}

test.describe('account linking', () => {
  test('auto-link, a link to a candidate, and an identity that waits', async ({ page }) => {
    await enterAsOwner(page)
    await createUnit(page, UNIT)
    await addSoldier(page, YAEL.first, YAEL.last, { personalId: YAEL.personalId, email: YAEL.email })
    await addSoldier(page, ASHER.first, ASHER.last)

    await test.step('the owner has nothing to review: no row of "הצטרפות" waits', async () => {
      await openManageIndex(page)
      await expect(page.getByRole('main').getByRole('button', { name: he.accountLinks.open, exact: true })).toHaveCount(1)
      await openJoins(page)
      await expect(page.getByText(he.accountLinks.emptyTitle)).toBeVisible()
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

    await test.step('the owner sees the request ready, and "זה הוא?" names the soldier whose name matches', async () => {
      await backToOwner(page)
      await expect(menuButton(page)).toHaveAccessibleName(`${he.navigation.tab} 1 ${he.navigation.waiting}`)
      await openJoins(page)
      await expect(page.getByRole('heading', { level: 2, name: new RegExp(he.manage.joins.ready) })).toBeVisible()
      await expectNoAxeViolations(page)
      const request = await openRequest(page, `${ASHER.first} ${ASHER.last}`)
      await expect(request.getByText(he.manage.joins.isThisHim)).toBeVisible()
      await expect(request.getByText(`${ASHER.first} ${ASHER.last}`, { exact: true }).last()).toBeVisible()
      await expectNoAxeViolations(page)
    })

    await test.step('"כן, לקשר" links, and lets the identity in as that soldier', async () => {
      await page.getByRole('dialog').getByRole('button', { name: he.manage.joins.yesLink }).click()
      await expect(page.getByRole('status').getByText(`${ASHER.first} ${ASHER.last} ${he.manage.joins.linked}`)).toBeVisible()
      await expect(page.getByText(he.accountLinks.emptyTitle)).toBeVisible()
      await signOut(page)
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
      await expect(menuButton(page)).toHaveAccessibleName(`${he.navigation.tab} 2 ${he.navigation.waiting}`)
    })

    await test.step('with no soldier to match, the owner creates one from the request, in a chosen unit', async () => {
      await openJoins(page)
      await expect(page.getByRole('heading', { level: 2, name: new RegExp(he.manage.joins.newSoldiers) })).toBeVisible()
      const request = await openRequest(page, `${GIL.first} ${GIL.last}`)
      await expectNoAxeViolations(page)
      await request.getByRole('button', { name: new RegExp(`${he.manage.add.unit}$`) }).click()
      await page.getByRole('option', { name: UNIT, exact: true }).click()
      await request.getByRole('button', { name: he.manage.joins.createAndLink }).click()
      await expect(request).toBeHidden()
    })

    await test.step('the new soldier is on the roster with the number of the request', async () => {
      const card = await openSoldierCard(page, `${GIL.first} ${GIL.last}`)
      await expect(card.getByText(GIL.personalId)).toBeVisible()
      await closeDrawers(page)
    })

    await test.step('a rejection, behind "עוד", asks first, and the asker is shown the form again', async () => {
      const request = await openRequest(page, `${DANA.first} ${DANA.last}`)
      await request.getByRole('button', { name: he.manage.joins.more }).click()
      await request.getByRole('button', { name: he.accountLinks.reject }).click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
      await waitForSettledScreen(page)
      await page.getByRole('alertdialog').getByRole('button', { name: he.accountLinks.rejectConfirm }).click()
      await expect(page.getByText(he.accountLinks.emptyTitle)).toBeVisible()
      await signOut(page)
      await signIn(page, DANA.email)
      await expect(page.getByLabel(he.linkRequest.firstName)).toBeVisible()
      await expect(page.getByText(he.linkRequest.waitingTitle)).toHaveCount(0)
      // The form says the earlier request was not approved (D-168).
      await expect(page.getByRole('status').getByText(he.linkRequest.rejectedTitle)).toBeVisible()
      await expectNoAxeViolations(page)
    })
  })

  test('approving several requests at once links every ready one (D-448)', async ({ page }) => {
    await enterAsOwner(page)
    await createUnit(page, UNIT)
    // The name alone: the request is ready, yet waits for a reviewer, since a name never links by itself (D-445).
    await addSoldier(page, ROTEM.first, ROTEM.last)

    await test.step('two identities ask, one with the name of a soldier', async () => {
      await signOut(page)
      await ask(page, ROTEM)
      await expect(page.getByRole('heading', { name: he.linkRequest.waitingTitle })).toBeVisible()
      await page.getByRole('button', { name: he.account.signOut }).click()
      await ask(page, ASHER)
      await expect(page.getByRole('heading', { name: he.linkRequest.waitingTitle })).toBeVisible()
      await backToOwner(page)
      await expect(menuButton(page)).toHaveAccessibleName(`${he.navigation.tab} 2 ${he.navigation.waiting}`)
    })

    await test.step('"אישור 1" in the capsule links the ready one; the other stays, with no candidate', async () => {
      await openJoins(page)
      await expect(page.getByRole('heading', { level: 2, name: new RegExp(he.manage.joins.ready) })).toBeVisible()
      await expect(page.getByRole('heading', { level: 2, name: new RegExp(he.manage.joins.newSoldiers) })).toBeVisible()
      await page.getByRole('button', { name: `${he.manage.joins.approve} 1` }).click()
      await expect(page.getByRole('status').getByText(`1 ${he.manage.joins.linkedMany}`)).toBeVisible()
      await expect(page.getByRole('main').getByRole('button', { name: new RegExp(ROTEM.first) })).toHaveCount(0)
      await expect(page.getByRole('main').getByRole('button', { name: new RegExp(ASHER.first) })).toBeVisible()
      await expect(menuButton(page)).toHaveAccessibleName(`${he.navigation.tab} 1 ${he.navigation.waiting}`)
    })

    await test.step('"היום" shows the request on its card, with how many are ready and to review', async () => {
      await openTab(page, 'today')
      const card = page.getByRole('region', { name: he.accountLinks.title })
      await expect(card.getByText(`0 ${he.today.joinsReady} · 1 ${he.today.joinsReview}`)).toBeVisible()
      await card.getByRole('button', { name: new RegExp(ASHER.first) }).click()
      await expect(page.getByRole('dialog', { name: `${ASHER.first} ${ASHER.last}` })).toBeVisible()
    })
  })
})
