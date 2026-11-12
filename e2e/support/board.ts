import { expect, type Page } from '@playwright/test'
import { dictionary as he } from '../../src/i18n/he/dictionary.ts'

// The board's controls (D-311, D-312, D-313): the view sheet behind the "לוח" tab, and the builder behind "סינון ומיון".

export function viewSheet(page: Page) {
  return page.getByRole('dialog', { name: he.workspace.view })
}

export function boardTab(page: Page) {
  return page.getByRole('button', { name: he.workspace.board, exact: true })
}

/** The "לוח" tab opens the sheet on the board; from another destination it first returns to the board (D-311). */
export async function openViewSheet(page: Page) {
  if ((await boardTab(page).getAttribute('aria-current')) !== 'page') {
    await boardTab(page).click()
    await expect(boardTab(page)).toHaveAttribute('aria-current', 'page')
  }
  await boardTab(page).click()
  await expect(viewSheet(page)).toBeVisible()
}

/** A card of the sheet is a radio inside its label: a person presses the card, and the sheet closes. */
export async function selectView(page: Page, name: string) {
  await openViewSheet(page)
  await viewSheet(page).locator('label').filter({ has: page.getByRole('radio', { name, exact: true }) }).click()
  await expect(viewSheet(page)).toBeHidden()
}

/** The colors stay open to compare, so the sheet is closed after them. */
export async function selectColors(page: Page, name: string) {
  await openViewSheet(page)
  await viewSheet(page).locator('label').filter({ has: page.getByRole('radio', { name, exact: true }) }).click()
  await viewSheet(page).getByRole('button', { name: he.common.close }).click()
  await expect(viewSheet(page)).toBeHidden()
}

export function builder(page: Page) {
  return page.getByRole('dialog', { name: he.filters.builder })
}

export async function openBuilder(page: Page) {
  if (await builder(page).isVisible()) return
  await page.getByRole('button', { name: he.filters.builder, exact: true }).click()
  await expect(builder(page)).toBeVisible()
}

export async function closeBuilder(page: Page) {
  await builder(page).getByRole('button', { name: he.common.close }).click()
  await expect(builder(page)).toBeHidden()
}

/** A select of the builder is a button named by its value and its name; the last one is the newest row's. */
export async function pick(page: Page, label: string, option: string) {
  await builder(page).getByRole('button', { name: new RegExp(label) }).last().click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

/** Checks values in a row's choices, by the field's name. */
export async function chooseValues(page: Page, field: string, values: readonly string[]) {
  await builder(page).getByRole('button', { name: new RegExp(`^${he.filters.values} ${field}`) }).last().click()
  const choices = page.getByRole('dialog', { name: field, exact: true })
  for (const value of values) await choices.locator('label').filter({ hasText: value }).click()
  await page.keyboard.press('Escape')
  await expect(choices).toBeHidden()
}

/**
 * Adds a rule in the builder and closes it: "+ add filter", the field, the operator when one is named, the values
 * (D-312). A leave field turns the row into its own.
 */
export async function addFilter(page: Page, field: string, values: readonly string[], operator?: string) {
  await openBuilder(page)
  await builder(page).getByRole('button', { name: he.filters.add, exact: true }).click()
  await pick(page, he.filters.field, field)
  if (operator !== undefined) await pick(page, he.filters.operator, operator)
  if (values.length > 0) await chooseValues(page, field, values)
  await closeBuilder(page)
}

/** "Only who is missing" is a suggestion of the builder, set in one press. */
export async function setOnlyMissing(page: Page) {
  await openBuilder(page)
  await builder(page).getByRole('button', { name: he.filters.onlyMissing, exact: true }).click()
  await closeBuilder(page)
}
