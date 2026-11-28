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
      // A tooltip never covers anything (it takes no press), and a tab's tooltip can stay in its exiting state under a
      // modal drawer when an emulated phone hovers (OI-406): it is not waited for.
      [...document.querySelectorAll<HTMLElement>('[data-rac]')].every((element) => element.style.clipPath !== 'inset(50%)' || element.getAttribute('role') === 'tooltip'),
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

/** The claim opens the setup over the board (V27): the drawer that offers the template. */
export function setupDrawer(page: Page) {
  return page.getByRole('dialog', { name: he.setup.title })
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

/** The destinations of the tab bar (D-455), by their names. "ניהול" also reads what waits behind it. */
export const TABS = {
  today: he.shell.tabToday,
  board: he.workspace.board,
  manage: new RegExp(`^${he.navigation.tab}( \\d+ ${he.navigation.waiting})?$`),
  me: he.shell.tabMe,
} as const
export type TabName = keyof typeof TABS

export function tab(page: Page, name: TabName) {
  const label = TABS[name]
  return navigation(page).getByRole('button', typeof label === 'string' ? { name: label, exact: true } : { name: label })
}

/** Moves to a destination from its tab; on it already, nothing is pressed. */
export async function openTab(page: Page, name: TabName) {
  await expect(async () => {
    if ((await tab(page, name).getAttribute('aria-current', { timeout: 1_000 })) !== 'page') await tab(page, name).click({ timeout: 1_000 })
    await expect(tab(page, name)).toHaveAttribute('aria-current', 'page', { timeout: 1_000 })
  }).toPass({ timeout: 10_000 })
}

/**
 * Back to the board once nothing is open over the screen, for who has it: a module opens from "ניהול" and a request
 * from "היום", and the demos that follow look at the board.
 */
export async function backToBoard(page: Page) {
  await expect(page.getByRole('dialog')).toHaveCount(0)
  if ((await tab(page, 'board').count()) > 0) await openTab(page, 'board')
}

/** A new owner on an empty store, on the board, with the setup that the claim opens set aside. */
export async function enterAsOwner(page: Page) {
  await page.goto('/')
  await signIn(page, OWNER.email, OWNER.name)
  await claimOrganization(page)
  await closeSetup(page)
  await openTab(page, 'board')
  await expect(organizationHeading(page)).toBeVisible()
}

/** A page of "אני" from its row or door (D-488): "העדפות", "כל הבקשות" or "הסבב שלי". */
export async function openMePage(page: Page, which: 'preferences' | 'requests' | 'rotation') {
  await openTab(page, 'me')
  // A press on the tab in sight returns "אני" to its first screen (D-465), where the rows are.
  if (/[?&]page=/.test(page.url())) await tab(page, 'me').click()
  const main = page.getByRole('main')
  if (which === 'preferences') await main.getByRole('button', { name: he.me.preferences, exact: true }).click()
  else if (which === 'requests') await main.getByRole('button', { name: he.me.allRequests, exact: true }).click()
  else await main.getByRole('button', { name: he.me.myRotation, exact: true }).click()
  const title = which === 'preferences' ? he.me.preferences : which === 'requests' ? he.me.myRequests : he.me.myRotation
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible()
}

/** Signs out from "העדפות" of "אני", where the account is (D-488). */
export async function signOut(page: Page) {
  await openMePage(page, 'preferences')
  await page.getByRole('button', { name: he.account.signOut, exact: true }).click()
  await expect(page).toHaveURL(/\/sign-in(\?view=\w+(&tab=today)?)?$/)
}

/** The soldier's own requests: "כל הבקשות" of "אני", on its open part (D-488). */
export async function openMyLeaves(page: Page) {
  await openMePage(page, 'requests')
}

/** The open part of "כל הבקשות", or its history. */
export function myRequestsList(page: Page, part: 'open' | 'history' = 'open') {
  return page.getByRole('main').getByRole('region', { name: part === 'open' ? he.me.openTab : he.me.historyTab })
}

/** A row of "כל הבקשות" by its leave type: the row's button, and its badge beside it. */
export function myRequestRow(page: Page, type: string | RegExp) {
  return myRequestsList(page).getByRole('listitem').filter({ hasText: type })
}

/** The appearance, chosen on "העדפות" of "אני" (D-181). */
export function appearanceChoice(page: Page, name: string) {
  return page.getByRole('radiogroup', { name: he.account.appearance }).getByRole('radio', { name, exact: true })
}

export async function chooseAppearance(page: Page, name: string) {
  await openMePage(page, 'preferences')
  await appearanceChoice(page, name).click()
  await expect(appearanceChoice(page, name)).toBeChecked()
}

/** The requests row of "ניהול": named alone, and described by what waits (D-120). */
export const INBOX = he.inbox.open

/** The page of every request that waits, from its row of "ניהול" (D-474). */
export async function openRequests(page: Page) {
  await openTab(page, 'manage')
  await managePage(page).getByRole('button', { name: INBOX, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: he.today.approvals })).toBeVisible()
}

/** What waits, on that page. */
export function requestsList(page: Page) {
  return page.getByRole('region', { name: he.inbox.pendingLabel })
}

/** The requests that closed: a drawer behind the page's door (D-120). */
export async function openClosedRequests(page: Page) {
  await openRequests(page)
  await page.getByRole('button', { name: he.today.closedDoor, exact: true }).click()
  await expect(page.getByRole('dialog', { name: he.inbox.closedLabel })).toBeVisible()
}

export async function expectWaitingRequests(page: Page, count: number) {
  await openTab(page, 'manage')
  await expect(managePage(page).getByRole('button', { name: INBOX, exact: true })).toHaveAccessibleDescription(
    count === 0 ? '' : `${String(count)} ${he.inbox.pendingCount}`,
  )
}

/** Sets aside the setup that the claim opened. */
export async function closeSetup(page: Page) {
  await expect(setupDrawer(page)).toBeVisible()
  // The drawer enters over the board as the claim lands: a press while it still prepares or slides in can be lost on a
  // slow runner (OI-258), so the close waits for the drawer to rest. A failure names the address the close left.
  await waitForSettledScreen(page)
  await setupDrawer(page).getByRole('button', { name: he.common.close }).click()
  await expect(setupDrawer(page), `the setup drawer stays open at ${page.url()}`).toBeHidden()
}

/** A row of the units tree, by the unit's name. */
export function unitRow(page: Page, name: string) {
  return page
    .getByRole('list', { name: he.units.listLabel })
    .getByRole('listitem')
    .filter({ has: page.getByText(name, { exact: true }) })
}

/**
 * A new unit under another, the root by default: the claim made the root unit (OI-212), and it stays the only one at
 * the top (D-251). The units module is open.
 */
export async function addUnit(page: Page, name: string, parent = ORGANIZATION) {
  await unitRow(page, parent).getByRole('button', { name: he.common.actions }).click()
  await page.getByRole('menuitem', { name: he.units.addChild }).click()
  await page.getByLabel(he.units.name).fill(name)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(unitRow(page, name)).toBeVisible()
}

/** "ניהול" (D-456): the index of tools, or its settings page. */
export function managePage(page: Page) {
  return page.getByRole('main')
}

function settingsHeading(page: Page) {
  return page.getByRole('heading', { level: 1, name: he.navigation.setupOpen, exact: true })
}

/** Opens "הגדרות", the page of "ניהול" that holds what a unit defines once (D-285, D-456). */
export async function openSetup(page: Page) {
  await openTab(page, 'manage')
  if (!(await settingsHeading(page).isVisible())) await managePage(page).getByRole('button', { name: he.navigation.setupOpen, exact: true }).click()
  await expect(settingsHeading(page)).toBeVisible()
}

/**
 * Opens a module from its row of "ניהול", or of its settings page when it is not on the index (D-456). The rows fill
 * while access loads, so the place of a module can still change: the whole step retries.
 */
export async function openModule(page: Page, name: string | RegExp) {
  // A string names the module exactly: a row is named by its tool alone, and what it holds describes it.
  const options = typeof name === 'string' ? { name, exact: true } : { name }
  const dialogs = page.getByRole('dialog')
  const openedBefore = await dialogs.count()
  await expect(async () => {
    // A press that landed while the page was busy can still time out: when the module's drawer opened since, the
    // step is done, and the caller checks what it opened.
    if ((await dialogs.count()) > openedBefore) return
    if ((await tab(page, 'manage').getAttribute('aria-current', { timeout: 1_000 })) !== 'page') await tab(page, 'manage').click({ timeout: 1_000 })
    const row = managePage(page).getByRole('button', options)
    if (!(await row.isVisible())) {
      // A module of the unit's settings is a step in, behind the index's last row; from the settings, the index is a step
      // back; from another page of "ניהול", the tab in sight returns to the index (D-465, D-482).
      const settingsRow = managePage(page).getByRole('button', { name: he.navigation.setupOpen, exact: true })
      if (await settingsHeading(page).isVisible()) await managePage(page).getByRole('button', { name: he.shell.back, exact: true }).click({ timeout: 1_000 })
      else if (await settingsRow.isVisible()) await settingsRow.click({ timeout: 1_000 })
      else await tab(page, 'manage').click({ timeout: 1_000 })
    }
    await row.click({ timeout: 1_000 })
    await expect(dialogs).not.toHaveCount(openedBefore, { timeout: 1_000 })
  }).toPass({ timeout: 10_000 })
  // The drawer slides in over the page: what opens from a field of it is placed once, so the next step waits for it to rest.
  await waitForSettledScreen(page)
}
