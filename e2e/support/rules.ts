import { expect, type Page } from '@playwright/test'
import { dictionary as he } from '../../src/i18n/he/dictionary.ts'
import { closeDrawers } from './soldiers.ts'
import { openTab, tab, waitForSettledScreen } from './workspace.ts'

// "כללי נוכחות" (D-482): the page of "ניהול", a new rule from its capsule, and a rule's drawer. Sample data, tests only.

export function rulesHeading(page: Page) {
  return page.getByRole('heading', { level: 1, name: he.manage.pages.rules, exact: true })
}

export async function openRules(page: Page) {
  await closeDrawers(page)
  if (await rulesHeading(page).isVisible()) return
  await openTab(page, 'manage')
  await expect(async () => {
    // Another page of "ניהול" may be open: the tab in sight returns to the index (D-465).
    if (!(await page.getByRole('main').getByRole('button', { name: he.navigation.setupOpen, exact: true }).isVisible())) {
      await tab(page, 'manage').click({ timeout: 1_000 })
    }
    if (await rulesHeading(page).isVisible()) return
    await page.getByRole('main').getByRole('button', { name: he.rules.open, exact: true }).click({ timeout: 1_000 })
    await expect(rulesHeading(page)).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: 10_000 })
}

export interface RuleSpec {
  readonly name: string
  readonly scope: string
  readonly min?: string
  readonly max?: string
  readonly hard?: boolean
  readonly priority?: string
}

/** Picks from a select of the rule's form. */
async function pick(page: Page, label: string, option: string) {
  await page.getByRole('dialog').last().getByRole('button', { name: new RegExp(`${label}$`) }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

/** A new rule from the "+" of the page's capsule; its drawer closes once it is made, and the row shows. */
export async function createRule(page: Page, spec: RuleSpec) {
  await openRules(page)
  await page.getByRole('button', { name: he.manage.rules.new, exact: true }).click()
  const form = page.getByRole('dialog', { name: he.rules.newTitle })
  await expect(form).toBeVisible()
  await waitForSettledScreen(page)
  await form.getByLabel(he.rules.name).fill(spec.name)
  if (spec.hard === true) await pick(page, he.rules.enforcement, he.rules.enforcementHard)
  if (spec.min !== undefined) await form.getByLabel(he.rules.min, { exact: true }).fill(spec.min)
  if (spec.max !== undefined) await form.getByLabel(he.rules.max, { exact: true }).fill(spec.max)
  if (spec.priority !== undefined) await form.getByLabel(he.rules.priority, { exact: true }).fill(spec.priority)
  await pick(page, he.rules.scope, spec.scope)
  await form.getByRole('button', { name: he.common.create }).click()
  await expect(form).toBeHidden()
  await expect(page.getByRole('main').getByRole('button', { name: new RegExp(`^${spec.name}`) })).toBeVisible()
}
