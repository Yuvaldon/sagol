import { expect, type Locator, type Page } from '@playwright/test'
import { dictionary as he } from '../../src/i18n/he/dictionary.ts'
import { backToBoard, openTab, tab, waitForSettledScreen } from './workspace.ts'

// "חיילים" and the person card (D-482): the page of "ניהול", its rows, the full form of one new soldier and the card.
// Sample data, tests only.

export function soldiersHeading(page: Page) {
  return page.getByRole('heading', { level: 1, name: he.manage.pages.soldiers, exact: true })
}

export function soldierList(page: Page) {
  return page.getByRole('region', { name: he.manage.people.listLabel })
}

/**
 * The soldiers' rows in sight: the phone's items and the table's rows that hold a soldier's control (a group's header and
 * the table's header hold none). The list renders only what is in sight (OI-403).
 */
export function soldierRows(page: Page): Locator {
  return soldierList(page)
    .getByRole('listitem')
    .or(soldierList(page).getByRole('row'))
    .filter({ has: page.getByRole('button').or(page.getByRole('checkbox')) })
}

/** A soldier's row: an item of the phone's list, or a row of the wide screen's table (D-491). */
export function soldierRow(page: Page, name: string): Locator {
  return soldierList(page)
    .getByRole('listitem')
    .or(soldierList(page).getByRole('row'))
    .filter({ has: page.getByText(name, { exact: true }) })
}

/** Lets go of any drawer, so the page under it takes presses. */
export async function closeDrawers(page: Page) {
  const dialogs = page.getByRole('dialog')
  while ((await dialogs.count()) > 0) {
    await dialogs.last().getByRole('button', { name: he.common.close, exact: true }).first().click()
    await waitForSettledScreen(page)
  }
}

/** The index of "ניהול": the tab, pressed again when another of its pages is open (D-465). */
export async function openManageIndex(page: Page) {
  await closeDrawers(page)
  await openTab(page, 'manage')
  const settings = page.getByRole('main').getByRole('button', { name: he.navigation.setupOpen, exact: true })
  await expect(async () => {
    if (!(await settings.isVisible())) await tab(page, 'manage').click({ timeout: 1_000 })
    await expect(settings).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: 10_000 })
}

/** "חיילים", from its row of "ניהול". */
export async function openSoldiers(page: Page) {
  await closeDrawers(page)
  if (await soldiersHeading(page).isVisible()) return
  await openTab(page, 'manage')
  await expect(async () => {
    // Another page of "ניהול" may be open: the tab in sight returns to the index (D-465).
    if (!(await page.getByRole('main').getByRole('button', { name: he.navigation.setupOpen, exact: true }).isVisible())) {
      await tab(page, 'manage').click({ timeout: 1_000 })
    }
    if (await soldiersHeading(page).isVisible()) return
    await page.getByRole('main').getByRole('button', { name: he.soldiers.open, exact: true }).click({ timeout: 1_000 })
    await expect(soldiersHeading(page)).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: 10_000 })
}

/** The full form of one new soldier: "הוספת חיילים", then its door to the form. */
export async function openNewSoldierForm(page: Page) {
  await openSoldiers(page)
  await page.getByRole('button', { name: he.manage.pages.addSoldiers, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: he.manage.pages.addSoldiers })).toBeVisible()
  await page.getByRole('button', { name: he.manage.add.fullForm }).click()
  await expect(page.getByRole('dialog').getByLabel(he.soldiers.firstName)).toBeVisible()
  await waitForSettledScreen(page)
}

/** A new soldier from the full form; `fill` sets anything beyond the names. The new soldier's card opens, then closes. */
export async function createSoldier(page: Page, first: string, last: string, fill?: (page: Page) => Promise<void>) {
  await openNewSoldierForm(page)
  await page.getByLabel(he.soldiers.firstName).fill(first)
  await page.getByLabel(he.soldiers.lastName).fill(last)
  if (fill !== undefined) await fill(page)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(page.getByRole('dialog', { name: `${first} ${last}` })).toBeVisible()
  await closeDrawers(page)
  // Back where the demos look, as closing the old soldiers' drawer left them.
  await backToBoard(page)
}

/** A soldier's card, from their row; `full` grows it to the full card. */
export async function openSoldierCard(page: Page, name: string, { full = false }: { readonly full?: boolean } = {}) {
  await openSoldiers(page)
  await soldierRow(page, name).getByRole('button').first().click()
  const card = page.getByRole('dialog', { name })
  await expect(card).toBeVisible()
  await waitForSettledScreen(page)
  if (full) {
    await card.getByRole('button', { name: he.manage.person.full }).click()
    await expect(card.getByRole('heading', { name: he.soldiers.profileTitle, exact: true })).toBeVisible()
  }
  return card
}
