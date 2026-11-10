import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'
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

/** A new owner on an empty store, in the workspace. */
export async function enterAsOwner(page: Page) {
  await page.goto('/')
  await signIn(page, OWNER.email, OWNER.name)
  await claimOrganization(page)
  await expect(organizationHeading(page)).toBeVisible()
}
