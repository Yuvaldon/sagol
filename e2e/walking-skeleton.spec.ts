import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { ORGANIZATION, OWNER, claimOrganization, expectNoAxeViolations, navigation, organizationHeading, signIn } from './support/workspace.ts'

// V0's demo: sign in, claim the organization, see the empty workspace, keep the session across a
// reload, and see that a second identity gets no data. Each test starts on an empty browser
// profile, so the store is empty too.

const SECOND_EMAIL = 'second@example.test'
const BOTTOM_BAR_LIMIT = 0.5
const TOUCH_TARGET_PX = 44

async function chooseFromUserMenu(page: Page, item: string) {
  await page.getByRole('button', { name: he.account.menu }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

test('an owner claims the empty organization and reaches the workspace', async ({ page }, testInfo) => {
  await test.step('sign-in is in Hebrew, RTL, and has no axe violations', async () => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/sign-in$/)
    await expect(page.getByRole('heading', { name: he.signIn.title })).toBeVisible()
    await expect(page).toHaveTitle(he.app.name)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('html')).toHaveAttribute('lang', 'he')
    await expectNoAxeViolations(page)
  })

  await test.step('a bad address is refused with the field code message', async () => {
    await signIn(page, 'not-an-email')
    await expect(page.getByText(he.issues.invalidFormat)).toBeVisible()
    await expectNoAxeViolations(page)
  })

  await test.step('an identity on an empty store is offered the claim form', async () => {
    await signIn(page, OWNER.email, OWNER.name)
    await expect(page).toHaveURL(/\/onboarding$/)
    await expect(page.getByRole('heading', { name: he.onboarding.title })).toBeVisible()
    await expect(page.getByRole('combobox', { name: he.onboarding.timezone })).toHaveValue('Asia/Jerusalem')
    await expectNoAxeViolations(page)
  })

  await test.step('required fields are reported', async () => {
    await page.getByRole('button', { name: he.onboarding.submit, exact: true }).click()
    await expect(page.getByText(he.issues.required)).toHaveCount(3)
    await expectNoAxeViolations(page)
  })

  await test.step('the time zone is picked by typing', async () => {
    const zone = page.getByRole('combobox', { name: he.onboarding.timezone })
    await zone.fill('New_York')
    await page.getByRole('option', { name: 'America/New_York' }).click()
    await expect(zone).toHaveValue('America/New_York')
  })

  await test.step('claiming opens the empty workspace', async () => {
    await claimOrganization(page)
    await expect(page).toHaveURL(/\/$/)
    await expect(organizationHeading(page)).toBeVisible()
    // A new organization has no rotation yet, nor a unit to hold one; its owner is sent to found the unit (D-218).
    await expect(page.getByRole('heading', { name: he.workspace.noRotationTitle })).toBeVisible()
    await expect(page.getByRole('button', { name: he.workspace.foundUnits })).toBeVisible()
    await expect(navigation(page).getByText(OWNER.name)).toBeVisible()
    await expectNoAxeViolations(page)
  })

  await test.step('navigation floats on top on desktop and at the bottom on mobile', async () => {
    const box = await navigation(page).boundingBox()
    const viewport = page.viewportSize()
    if (box === null || viewport === null) throw new Error('navigation has no box')
    const inUpperHalf = box.y < viewport.height * BOTTOM_BAR_LIMIT
    expect(inUpperHalf).toBe(testInfo.project.name === 'desktop')
  })

  await test.step('the bars keep the page as wide as the screen, so a phone never zooms out (D-155)', async () => {
    await expect(page.getByRole('button', { name: he.navigation.open })).toHaveCount(1)
    const viewport = page.viewportSize()
    if (viewport === null) throw new Error('the page has no viewport')
    const width = await page.evaluate(() => ({ layout: window.innerWidth, content: document.documentElement.scrollWidth }))
    expect(width).toEqual({ layout: viewport.width, content: viewport.width })
  })

  await test.step('a reload keeps the session and the data', async () => {
    await page.reload()
    await expect(organizationHeading(page)).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
  })

  await test.step('a URL cannot take a linked session back to onboarding', async () => {
    await page.goto('/onboarding')
    await expect(page).toHaveURL(/\/$/)
    await expect(organizationHeading(page)).toBeVisible()
  })

  await test.step('the user menu has no axe violations when open', async () => {
    await page.getByRole('button', { name: he.account.menu }).click()
    await expect(page.getByRole('menuitem', { name: he.account.signOut })).toBeVisible()
    await expectNoAxeViolations(page)
    await page.keyboard.press('Escape')
  })
})

test('a second identity sees no access and no data', async ({ page }) => {
  await page.goto('/')
  await signIn(page, OWNER.email, OWNER.name)
  await claimOrganization(page)
  await expect(organizationHeading(page)).toBeVisible()

  await test.step('after sign-out the app returns to sign-in', async () => {
    await chooseFromUserMenu(page, he.account.signOut)
    await expect(page).toHaveURL(/\/sign-in$/)
    await expect(page.getByRole('button', { name: new RegExp(OWNER.email) })).toBeVisible()
  })

  await test.step('a new identity gets "no access yet", and nothing of the organization', async () => {
    await signIn(page, SECOND_EMAIL)
    await expect(page).toHaveURL(/\/onboarding$/)
    await expect(page.getByRole('heading', { name: he.noAccess.title })).toBeVisible()
    await expect(page.getByText(he.onboarding.organizationName)).toHaveCount(0)
    await expect(page.getByText(ORGANIZATION)).toHaveCount(0)
    await expectNoAxeViolations(page)
  })

  await test.step('a URL cannot take it to the workspace', async () => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/onboarding$/)
    await expect(page.getByText(ORGANIZATION)).toHaveCount(0)
  })

  await test.step('the identity switcher returns to the owner, with the real policy', async () => {
    await page.getByRole('button', { name: new RegExp(OWNER.email) }).click()
    await expect(organizationHeading(page)).toBeVisible()
  })

  await test.step('the user menu switches back to the second identity', async () => {
    await chooseFromUserMenu(page, SECOND_EMAIL)
    await expect(page.getByRole('heading', { name: he.noAccess.title })).toBeVisible()
  })
})

test('a claim in one tab moves the other tab too', async ({ page, context }) => {
  await page.goto('/')
  await signIn(page, OWNER.email, OWNER.name)
  await expect(page.getByRole('heading', { name: he.onboarding.title })).toBeVisible()

  const otherTab = await context.newPage()
  await otherTab.goto('/')
  await expect(otherTab.getByRole('heading', { name: he.onboarding.title })).toBeVisible()

  await claimOrganization(page)
  await expect(organizationHeading(page)).toBeVisible()
  await expect(organizationHeading(otherTab)).toBeVisible()
})

test('every control is a 44 px touch target on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'A mobile requirement (OI-033).')

  async function expectTouchTargets() {
    const heights = await page
      .locator('button:visible, input:visible')
      // A switch or a box hides its input inside its label, and the label is what a finger presses.
      .evaluateAll((elements) => elements.map((element) => (element.closest('label') ?? element).getBoundingClientRect().height))
    expect(heights.length).toBeGreaterThan(0)
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(TOUCH_TARGET_PX)
  }

  await page.goto('/')
  await expect(page.getByRole('heading', { name: he.signIn.title })).toBeVisible()
  await expectTouchTargets()
  await signIn(page, OWNER.email, OWNER.name)
  await expect(page.getByRole('heading', { name: he.onboarding.title })).toBeVisible()
  await expectTouchTargets()
  await claimOrganization(page)
  await expect(organizationHeading(page)).toBeVisible()
  // The settled workspace: its empty state is in place before anything is measured.
  await expect(page.getByRole('button', { name: he.workspace.foundUnits })).toBeVisible()
  await expectTouchTargets()
})
