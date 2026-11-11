import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations, navigation, organizationHeading, signIn } from './support/workspace.ts'

// V9's demo: a new identity asks to join, a reviewer links it to a soldier or makes one from the request,
// the requester reaches the workspace, and a revoke takes the access back. Sample data, tests only.

const REQUESTER = 'requester@example.test'

async function chooseFromUserMenu(page: Page, item: string) {
  await page.getByRole('button', { name: he.account.menu }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

async function openSoldiers(page: Page) {
  await navigation(page).getByRole('button', { name: he.soldiers.open }).click()
  await expect(page.getByRole('heading', { name: he.soldiers.title, exact: true })).toBeVisible()
}

async function closeDrawer(page: Page) {
  await page.getByRole('button', { name: he.common.close }).click()
}

async function createSoldier(page: Page, firstName: string, lastName: string) {
  await page.getByRole('button', { name: he.soldiers.new }).first().click()
  await page.getByLabel(he.soldiers.firstName).fill(firstName)
  await page.getByLabel(he.soldiers.lastName).fill(lastName)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(page.getByRole('list', { name: he.soldiers.listLabel }).getByText(`${firstName} ${lastName}`, { exact: true })).toBeVisible()
}

/** Signs out the owner and files a request as a new identity. */
async function fileRequest(page: Page, firstName: string, lastName: string) {
  await chooseFromUserMenu(page, he.account.signOut)
  await signIn(page, REQUESTER)
  await expect(page.getByRole('heading', { name: he.linkRequest.title })).toBeVisible()
  await page.getByLabel(he.onboarding.firstName).fill(firstName)
  await page.getByLabel(he.onboarding.lastName).fill(lastName)
  await page.getByRole('button', { name: he.linkRequest.submit }).click()
  await expect(page.getByRole('heading', { name: he.linkRequest.pendingTitle })).toBeVisible()
}

async function backToOwner(page: Page) {
  await page.getByRole('button', { name: new RegExp(OWNER.email) }).click()
  await expect(organizationHeading(page)).toBeVisible()
}

/** Linked, with no role yet (V10): the workspace opens, and shows nothing of the organization. */
async function expectLinkedWorkspace(page: Page) {
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('button', { name: new RegExp(REQUESTER) })).toBeVisible()
  await expectNoAxeViolations(page)
}

async function openRequests(page: Page) {
  await openSoldiers(page)
  await page.getByRole('button', { name: he.soldiers.tabRequests }).click()
}

test.beforeEach(async ({ page }) => {
  await enterAsOwner(page)
})

test('a request is linked to a matching soldier, and a revoke takes the access back', async ({ page }) => {
  await openSoldiers(page)
  await createSoldier(page, 'אורי', 'כהן')
  await page.getByRole('button', { name: he.soldiers.tabRequests }).click()
  await expect(page.getByText(he.accounts.emptyTitle)).toBeVisible()
  await expectNoAxeViolations(page)
  await closeDrawer(page)

  await test.step('a new identity files a request and sees it pending', async () => {
    await fileRequest(page, 'אורי', 'כהן')
    await expect(page.getByText('אורי כהן', { exact: true })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  await test.step('the owner sees the request with the soldier of the same name and links it', async () => {
    await backToOwner(page)
    await openRequests(page)
    await expect(page.getByText(REQUESTER)).toBeVisible()
    const candidates = page.getByRole('list', { name: he.accounts.candidates })
    await expect(candidates.getByText(he.accounts.matchName)).toBeVisible()
    await expectNoAxeViolations(page)
    await candidates.getByRole('button', { name: he.accounts.link }).click()
    await expect(page.getByText(he.accounts.emptyTitle)).toBeVisible()
  })

  await test.step('the soldier page shows the linked account', async () => {
    await page.getByRole('button', { name: he.soldiers.tabList }).click()
    await page.getByRole('list', { name: he.soldiers.listLabel }).getByRole('button', { name: /אורי כהן/ }).click()
    await expect(page.getByRole('heading', { name: he.accounts.sectionTitle })).toBeVisible()
    await expect(page.getByText(REQUESTER)).toBeVisible()
    await expectNoAxeViolations(page)
  })

  await test.step('the requester now reaches the workspace', async () => {
    await closeDrawer(page)
    await chooseFromUserMenu(page, REQUESTER)
    await expectLinkedWorkspace(page)
  })

  await test.step('a revoke sends the requester back to a new request', async () => {
    await chooseFromUserMenu(page, OWNER.email)
    await expect(organizationHeading(page)).toBeVisible()
    await openSoldiers(page)
    await page.getByRole('list', { name: he.soldiers.listLabel }).getByRole('button', { name: /אורי כהן/ }).click()
    await page.getByRole('button', { name: he.accounts.revoke }).click()
    await expectNoAxeViolations(page)
    await page.getByRole('alertdialog').getByRole('button', { name: he.accounts.revoke }).click()
    await expect(page.getByText(he.accounts.notLinked)).toBeVisible()
    await closeDrawer(page)
    await chooseFromUserMenu(page, REQUESTER)
    await expect(page.getByRole('heading', { name: he.linkRequest.title })).toBeVisible()
  })
})

test('a request with no match becomes a new soldier, and a rejected one can be filed again', async ({ page }) => {
  await test.step('a request names someone the roster does not hold', async () => {
    await fileRequest(page, 'נועה', 'ברק')
    await backToOwner(page)
    await openRequests(page)
    await expect(page.getByText(he.accounts.noCandidates)).toBeVisible()
  })

  await test.step('rejecting clears it, and the requester may ask again', async () => {
    await page.getByRole('button', { name: he.accounts.reject }).click()
    await expectNoAxeViolations(page)
    await page.getByRole('alertdialog').getByRole('button', { name: he.accounts.reject }).click()
    await expect(page.getByText(he.accounts.emptyTitle)).toBeVisible()
    await closeDrawer(page)
    await chooseFromUserMenu(page, he.account.signOut)
    await page.getByRole('button', { name: new RegExp(REQUESTER) }).click()
    await expect(page.getByRole('heading', { name: he.linkRequest.title })).toBeVisible()
    await page.getByLabel(he.onboarding.firstName).fill('נועה')
    await page.getByLabel(he.onboarding.lastName).fill('ברק')
    await page.getByRole('button', { name: he.linkRequest.submit }).click()
    await expect(page.getByRole('heading', { name: he.linkRequest.pendingTitle })).toBeVisible()
  })

  await test.step('the owner makes a soldier from the request', async () => {
    await backToOwner(page)
    await openRequests(page)
    await page.getByRole('button', { name: he.accounts.createSoldier }).click()
    await expect(page.getByRole('dialog', { name: he.accounts.createTitle })).toBeVisible()
    await expectNoAxeViolations(page)
    await page.getByRole('dialog', { name: he.accounts.createTitle }).getByRole('button', { name: he.accounts.createSubmit }).click()
    await expect(page.getByText(he.accounts.emptyTitle)).toBeVisible()
    await page.getByRole('button', { name: he.soldiers.tabList }).click()
    await expect(page.getByRole('list', { name: he.soldiers.listLabel }).getByText('נועה ברק', { exact: true })).toBeVisible()
  })

  await test.step('the requester reaches the workspace', async () => {
    await closeDrawer(page)
    await chooseFromUserMenu(page, REQUESTER)
    await expectLinkedWorkspace(page)
  })
})
