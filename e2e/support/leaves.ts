import { expect, type Page } from '@playwright/test'
import { dictionary as he } from '../../src/i18n/he/dictionary.ts'
import { OWNER } from './workspace.ts'

// What the leave demos share: the board, the drawer, the fields of a form, a type and a new leave. Sample data,
// tests only.

/** Wednesday 11 November 2026, noon in Israel, so the week is 8–14 November whatever day the test runs. */
export const NOW = new Date('2026-11-11T10:00:00Z')

export function board(page: Page) {
  return page.getByRole('region', { name: he.timeline.label })
}

/** A mark's name holds its status between its type and its days (D-119). */
export const MARK_NAME = new RegExp(`, (${he.leaves.statusPending}|${he.leaves.statusApproved}), `)

/** The marks on the board: each is a button named by its type, its status and its days. */
export function leavesOf(page: Page) {
  return board(page).getByRole('button', { name: MARK_NAME })
}

export function drawer(page: Page) {
  return page.getByRole('dialog').last()
}

export async function closeDrawer(page: Page) {
  await page.getByRole('button', { name: he.common.close }).click()
}

/** Picks from a select inside the drawer. What a modal makes inert is still found by role. */
export async function choose(page: Page, label: string, option: string) {
  await drawer(page).getByRole('button', { name: new RegExp(`${label}$`) }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

/** A radio or a switch is a hidden input inside its label: a person presses the label. */
export async function press(page: Page, role: 'radio' | 'switch', name: string) {
  await drawer(page).locator('label').filter({ has: page.getByRole(role, { name, exact: true }) }).click()
}

export async function typeDate(page: Page, label: string, day: string, month: string, year: string) {
  const field = drawer(page).getByRole('group', { name: label })
  await field.getByRole('spinbutton').first().click()
  await page.keyboard.type(`${day}${month}${year}`)
}

export interface TypeSpec {
  readonly name: string
  readonly group?: string
  readonly color: string
  readonly icon?: string
  readonly marker?: boolean
  readonly requiresReason?: boolean
}

/** Inside the open leave-types drawer. */
export async function createType(page: Page, spec: TypeSpec) {
  await drawer(page).getByRole('button', { name: he.leaveTypes.tabTypes }).click()
  await drawer(page).getByRole('button', { name: he.leaveTypes.new }).first().click()
  await page.getByLabel(he.leaveTypes.name).fill(spec.name)
  if (spec.group !== undefined) await choose(page, he.leaveTypes.group, spec.group)
  if (spec.marker === true) await choose(page, he.leaveTypes.effect, he.leaveTypes.effectAvailable)
  if (spec.requiresReason === true) await press(page, 'switch', he.leaveTypes.requiresReason)
  await press(page, 'radio', spec.color)
  if (spec.icon !== undefined) await press(page, 'radio', spec.icon)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(drawer(page).getByText(spec.name, { exact: true })).toBeVisible()
}

export interface LeaveSpec {
  readonly type: string
  readonly from: readonly [string, string, string]
  readonly to: readonly [string, string, string]
  readonly reason?: string
  readonly approveNow?: boolean
}

/** From the floating "+", for the owner, who is the only soldier of these demos. */
export async function requestLeave(page: Page, spec: LeaveSpec) {
  await page.getByRole('button', { name: he.leaves.new }).click()
  await expect(drawer(page).getByRole('heading', { name: he.leaves.newTitle })).toBeVisible()
  await drawer(page).getByRole('combobox', { name: he.leaves.soldier }).fill('דנה')
  await page.getByRole('option', { name: OWNER.name, exact: true }).click()
  await choose(page, he.leaves.type, spec.type)
  await typeDate(page, he.leaves.from, ...spec.from)
  await typeDate(page, he.leaves.to, ...spec.to)
  if (spec.reason !== undefined) await drawer(page).getByRole('textbox', { name: new RegExp(he.leaves.reason) }).fill(spec.reason)
  if (spec.approveNow === true) await press(page, 'switch', he.leaves.approveNow)
  await drawer(page).getByRole('button', { name: he.leaves.submit, exact: true }).click()
}
