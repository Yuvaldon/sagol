import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'
import { DEFAULT_VIEW_BY_DEVICE } from '../../src/config/views/index.ts'
import { dictionary as he } from '../../src/i18n/he/dictionary.ts'

// What the slice demos share: signing in, claiming the organization, axe. Sample data, tests only.

export const OWNER = { email: 'owner@example.test', name: 'דנה לוי' }
export const ORGANIZATION = 'פלוגה ב׳'

/**
 * Waits until what is on screen rests: no animation runs, and no overlay is still hidden while it prepares to enter.
 * react-aria hides an overlay with `opacity: 0` and a clip until its enter animation is ready, and Playwright counts
 * that as visible, so a check of what covers what made during that moment fails on a slow runner only.
 */
export async function waitForSettledScreen(page: Page) {
  await page.waitForFunction(
    () =>
      document.getAnimations().every((animation) => animation.playState !== 'running') &&
      [...document.querySelectorAll<HTMLElement>('[data-rac]')].every((element) => element.style.clipPath !== 'inset(50%)'),
  )
}

/**
 * Axe measures what rests on screen. A surface that is still fading in has its text at partial
 * opacity, which fails contrast on a slow runner only (OI-059), so the check waits for running
 * animations to end. A failure names each element, so the next one says where it is.
 */
export async function expectNoAxeViolations(page: Page) {
  await waitForSettledScreen(page)
  const { violations } = await new AxeBuilder({ page }).analyze()
  const found = violations.flatMap((violation) =>
    violation.nodes.map((node) => `${violation.id}: ${node.target.join(' ')} — ${node.failureSummary ?? violation.help}`),
  )
  expect(found).toEqual([])
}

export async function signIn(page: Page, email: string, displayName = '') {
  await page.getByLabel(he.signIn.email).fill(email)
  if (displayName !== '') await page.getByLabel(he.signIn.displayName).fill(displayName)
  await page.getByRole('button', { name: he.signIn.submit, exact: true }).click()
}

export async function claimOrganization(page: Page) {
  await page.getByLabel(he.onboarding.organizationName).fill(ORGANIZATION)
  await page.getByLabel(he.onboarding.firstName).fill('דנה')
  await page.getByLabel(he.onboarding.lastName).fill('לוי')
  await page.getByRole('button', { name: he.onboarding.submit, exact: true }).click()
}

export function navigation(page: Page) {
  return page.getByRole('navigation', { name: he.workspace.navigation })
}

/** The organization's name is the page's one heading, in a bar (D-108). */
export function organizationHeading(page: Page, name = ORGANIZATION) {
  return page.getByRole('heading', { level: 1, name })
}

/**
 * A phone opens the board on the list (D-290). A spec about the timeline's bars names the timeline on every load of
 * the board, as a link to it would, so a phone shows the same board as a desktop. Call it before the first load.
 */
export async function openBoardOnTimeline(page: Page, isMobile: boolean) {
  if (!isMobile) return
  await page.addInitScript((view) => {
    const url = new URL(window.location.href)
    if (url.pathname !== '/' || url.searchParams.has('view')) return
    url.searchParams.set('view', view)
    window.history.replaceState(window.history.state, '', url)
  }, DEFAULT_VIEW_BY_DEVICE.desktop)
}

/** A new owner on an empty store, in the workspace. */
export async function enterAsOwner(page: Page) {
  await page.goto('/')
  await signIn(page, OWNER.email, OWNER.name)
  await claimOrganization(page)
  await expect(organizationHeading(page)).toBeVisible()
}

/** The navigation panel (D-173), once open: at the work, or a step in at the unit's setup (D-285). */
export function navigationPanel(page: Page) {
  return page.getByRole('dialog', { name: new RegExp(`^(${he.navigation.title}|${he.navigation.setupTitle})$`) })
}

/** Opens the unit's setup from the open panel's foot row (D-285). */
export async function openSetup(page: Page) {
  await navigationPanel(page).getByRole('button', { name: he.navigation.setupOpen, exact: true }).click()
  await expect(navigationPanel(page).getByRole('heading', { name: he.navigation.setupTitle, exact: true })).toBeVisible()
}

/**
 * Opens a module from the bar, or from the navigation panel when it is not there (D-173). The bar fills while access
 * loads, so the place of a module can still change: the whole step retries.
 */
export async function openModule(page: Page, name: string | RegExp) {
  // A string names the module exactly, so its pin ("pin <module>") never answers for it.
  const options = typeof name === 'string' ? { name, exact: true } : { name }
  const panel = navigationPanel(page)
  const dialogs = page.getByRole('dialog')
  const othersOpen = async () => (await dialogs.count()) - ((await panel.isVisible()) ? 1 : 0)
  const openedBefore = await othersOpen()
  await expect(async () => {
    // A press that landed while the page was busy can still time out: when the module's drawer opened since, the
    // step is done, and the caller checks what it opened.
    if ((await othersOpen()) > openedBefore) return
    const inPanel = panel.getByRole('button', options)
    // A module of the unit's setup is a step in, behind the panel's foot row (D-285).
    const toSetup = panel.getByRole('button', { name: he.navigation.setupOpen, exact: true })
    if (await panel.isVisible()) {
      if (await inPanel.isVisible()) {
        await inPanel.click({ timeout: 1_000 })
        return
      }
      if (await toSetup.isVisible()) {
        await toSetup.click({ timeout: 1_000 })
        await inPanel.click({ timeout: 1_000 })
        return
      }
      // Opened while the bar was still filling: the module is in the bar after all.
      await page.keyboard.press('Escape')
      await expect(panel).toBeHidden({ timeout: 1_000 })
    }
    const inBar = navigation(page).getByRole('button', options)
    if (await inBar.isVisible()) {
      await inBar.click({ timeout: 1_000 })
      return
    }
    await page.getByRole('button', { name: he.navigation.open }).click({ timeout: 1_000 })
    await inPanel.or(toSetup).first().waitFor({ timeout: 1_000 })
    if (!(await inPanel.isVisible())) await toSetup.click({ timeout: 1_000 })
    await inPanel.click({ timeout: 1_000 })
  }).toPass({ timeout: 10_000 })
}
