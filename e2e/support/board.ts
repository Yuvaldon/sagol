import { expect, type Page } from '@playwright/test'
import { dictionary as he } from '../../src/i18n/he/dictionary.ts'
import { openTab, tab } from './workspace.ts'

// The board's controls (D-480): the view switcher (the fan) and the options menu in the head's capsule, the saved views
// behind the options, and the builder behind "סינון" and "מיון מתקדם" (D-312, D-313).

export function boardTab(page: Page) {
  return tab(page, 'board')
}

/** The options menu of the board's head (OI-386). */
export function optionsMenu(page: Page) {
  return page.getByRole('dialog', { name: he.board.options })
}

export async function openOptions(page: Page) {
  await openTab(page, 'board')
  if (await optionsMenu(page).isVisible()) return
  await page.getByRole('button', { name: new RegExp(`^${he.board.options}`) }).click()
  await expect(optionsMenu(page)).toBeVisible()
}

/** A row of the options menu, by its name: it opens its choices in the same menu. */
export async function openOptionRow(page: Page, name: string) {
  await openOptions(page)
  await optionsMenu(page).getByRole('button', { name: new RegExp(`^${name} · `) }).click()
}

/** Picks a choice of a row; the menu returns to its rows, and is closed after. */
export async function chooseOption(page: Page, row: string, choice: string) {
  await openOptionRow(page, row)
  // A choice is named by its words, then by its quiet line where it has one (a rotation's dates).
  const exact = optionsMenu(page).locator('label').filter({ has: page.getByRole('radio', { name: choice, exact: true }) })
  const lined = optionsMenu(page).locator('label').filter({ has: page.getByRole('radio', { name: new RegExp(`^${choice}\\d`) }) })
  await ((await exact.count()) > 0 ? exact : lined).first().click()
  await page.keyboard.press('Escape')
  await expect(optionsMenu(page)).toBeHidden()
}

/** The saved views' sheet (D-387): "תצוגות שמורות" after the menu's divider. */
export function viewSheet(page: Page) {
  return page.getByRole('dialog', { name: he.board.savedViews })
}

export async function openViewSheet(page: Page) {
  await openOptions(page)
  await optionsMenu(page).getByRole('button', { name: new RegExp(`^${he.board.savedViews}`) }).click()
  await expect(viewSheet(page)).toBeVisible()
}

/** The fan: the icon of the view in sight opens the views; a pick shows it (D-480). */
export async function selectView(page: Page, name: string) {
  await openTab(page, 'board')
  await page.getByRole('button', { name: he.workspace.view, exact: true }).click()
  await page.getByRole('group', { name: he.board.fan }).getByRole('button', { name, exact: true }).click()
  await expect(page.getByRole('group', { name: he.board.fan })).toBeHidden()
}

/** The colors of the old bars: a row of the options on a wide screen (D-454). */
export async function selectColors(page: Page, name: string) {
  await chooseOption(page, he.board.colors, name)
}

export function builder(page: Page) {
  return page.getByRole('dialog', { name: he.filters.builder })
}

/** The builder, from "הוספת תנאי" in the options' "סינון". */
export async function openBuilder(page: Page) {
  if (await builder(page).isVisible()) return
  await openOptionRow(page, he.board.filter)
  await optionsMenu(page).getByRole('button', { name: he.board.addCondition }).click()
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

/** The set conditions, as the options' "סינון" lists them. */
export async function conditions(page: Page) {
  await openOptionRow(page, he.board.filter)
  return optionsMenu(page)
}

/** "ניקוי הסינון" in the options' "סינון". */
export async function clearConditions(page: Page) {
  await openOptionRow(page, he.board.filter)
  await optionsMenu(page).getByRole('button', { name: he.board.clearConditions }).click()
  await expect(optionsMenu(page)).toBeHidden()
}
