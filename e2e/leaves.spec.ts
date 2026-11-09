import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations, navigation } from './support/workspace.ts'

// V4's demo: leave types and their groups, a new leave from the floating "+", bars, lanes and a marker on the
// board, and the uniform colors, on desktop and mobile, RTL, with axe. Sample data, tests only.

const TOUCH_TARGET_PX = 44
/** Wednesday 11 November 2026, noon in Israel, so the week is 8–14 November whatever day the test runs. */
const NOW = new Date('2026-11-11T10:00:00Z')

function board(page: Page) {
  return page.getByRole('region', { name: he.timeline.label })
}

/** The leaves of a row, as they are read aloud. */
function leavesOf(page: Page) {
  return board(page).getByRole('list', { name: he.leaves.ofRow }).getByRole('listitem')
}

function drawer(page: Page) {
  return page.getByRole('dialog').last()
}

async function closeDrawer(page: Page) {
  await page.getByRole('button', { name: he.common.close }).click()
}

/** Picks from a select inside the drawer. What a modal makes inert is still found by role. */
async function choose(page: Page, label: string, option: string) {
  await drawer(page).getByRole('button', { name: new RegExp(`${label}$`) }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

/** A radio or a switch is a hidden input inside its label: a person presses the label. */
async function press(page: Page, role: 'radio' | 'switch', name: string) {
  await drawer(page).locator('label').filter({ has: page.getByRole(role, { name, exact: true }) }).click()
}

async function typeDate(page: Page, label: string, day: string, month: string, year: string) {
  const field = drawer(page).getByRole('group', { name: label })
  await field.getByRole('spinbutton').first().click()
  await page.keyboard.type(`${day}${month}${year}`)
}

async function createGroup(page: Page, name: string) {
  await drawer(page).getByRole('button', { name: he.leaveTypes.tabGroups }).click()
  await drawer(page).getByRole('button', { name: he.leaveTypeGroups.new }).first().click()
  await page.getByLabel(he.leaveTypeGroups.name).fill(name)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(drawer(page).getByRole('list', { name: he.leaveTypeGroups.listLabel })).toContainText(name)
}

interface TypeSpec {
  readonly name: string
  readonly group?: string
  readonly color: string
  readonly icon?: string
  readonly marker?: boolean
  readonly requiresReason?: boolean
}

async function createType(page: Page, spec: TypeSpec) {
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

interface LeaveSpec {
  readonly type: string
  readonly from: readonly [string, string, string]
  readonly to: readonly [string, string, string]
  readonly reason?: string
  readonly approveNow?: boolean
}

async function requestLeave(page: Page, spec: LeaveSpec) {
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

test('leave types, a new leave, and its bar on the board', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)

  await test.step('a new leave needs a type first, and the way to one is right there', async () => {
    await page.getByRole('button', { name: he.leaves.new }).click()
    await expect(drawer(page).getByRole('heading', { name: he.leaves.noTypesTitle })).toBeVisible()
    await expectNoAxeViolations(page)
    await drawer(page).getByRole('button', { name: he.leaves.openTypes }).click()
    await expect(page).toHaveURL(/panel=leave_types/)
    await expect(drawer(page).getByRole('heading', { name: he.leaveTypes.newTitle })).toBeVisible()
    await page.getByRole('button', { name: he.common.cancel }).click()
  })

  await test.step('groups and types, with their colors, icons and effects', async () => {
    await createGroup(page, 'חופשות')
    await createType(page, { name: 'רגילה', group: 'חופשות', color: he.palette.teal, icon: he.icons.home })
    await createType(page, { name: 'מחלה', color: he.palette.red, requiresReason: true })
    await createType(page, { name: 'מבחן', color: he.palette.purple, icon: he.icons.exam, marker: true })
    await expect(drawer(page).getByRole('heading', { name: 'חופשות' })).toBeVisible()
    await expect(drawer(page).getByText(`${he.leaveTypes.marker}`, { exact: true })).toBeVisible()
    await expectNoAxeViolations(page)
    await closeDrawer(page)
  })

  await test.step('a pending leave is on the board at once', async () => {
    await requestLeave(page, { type: 'חופשות · רגילה', from: ['09', '11', '2026'], to: ['10', '11', '2026'] })
    await expect(drawer(page)).toHaveCount(0)
    await expect(leavesOf(page)).toHaveText([`רגילה, ${he.leaves.statusPending}, 9–10 בנוב׳`])
    await expectNoAxeViolations(page)
  })

  await test.step('a type that asks for a reason gets one, and an overlap takes a second lane', async () => {
    const row = board(page).getByRole('listitem').filter({ has: page.getByRole('list', { name: he.leaves.ofRow }) })
    const before = await row.boundingBox()
    await requestLeave(page, { type: 'מחלה', from: ['10', '11', '2026'], to: ['12', '11', '2026'], approveNow: true })
    await expect(drawer(page).getByText(he.issues.reasonRequired)).toBeVisible()
    await drawer(page).getByRole('textbox', { name: new RegExp(he.leaves.reason) }).fill('שפעת')
    await drawer(page).getByRole('button', { name: he.leaves.submit, exact: true }).click()
    await expect(drawer(page)).toHaveCount(0)
    await expect(leavesOf(page)).toHaveCount(2)
    await expect(leavesOf(page).nth(1)).toHaveText(`מחלה, ${he.leaves.statusApproved}, 10–12 בנוב׳`)
    const after = await row.boundingBox()
    if (before === null || after === null) throw new Error('no row')
    expect(after.height).toBeGreaterThan(before.height)
  })

  await test.step('a marker is a badge, and the soldier stays present', async () => {
    await requestLeave(page, { type: 'מבחן', from: ['12', '11', '2026'], to: ['12', '11', '2026'] })
    await expect(leavesOf(page)).toHaveCount(3)
    await expect(leavesOf(page).nth(2)).toHaveText(`מבחן, ${he.leaves.marker}, ${he.leaves.statusPending}, 12 בנוב׳`)
    await expectNoAxeViolations(page)
  })

  await test.step('the uniform colors live in the URL and name the type inside the bar', async () => {
    await page.getByRole('button', { name: new RegExp(he.workspace.view) }).click()
    await page.getByRole('menuitemradio', { name: he.workspace.colorsUniform }).click()
    await expect(page).toHaveURL(/colors=uniform/)
    await expect(board(page).getByText('מחלה', { exact: true })).toBeVisible()
    await page.reload()
    await expect(board(page).getByText('מחלה', { exact: true })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  await test.step('on a phone the modules are icons of a touch size, and the "+" too', async () => {
    if (testInfo.project.name !== 'mobile') return
    for (const name of [he.units.open, he.soldiers.open, he.leaveTypes.open]) {
      const box = await navigation(page).getByRole('button', { name }).boundingBox()
      if (box === null) throw new Error(`no ${name}`)
      expect(box.height).toBeGreaterThanOrEqual(TOUCH_TARGET_PX)
      expect(box.width).toBeGreaterThanOrEqual(TOUCH_TARGET_PX)
    }
    const plus = await page.getByRole('button', { name: he.leaves.new }).boundingBox()
    if (plus === null) throw new Error('no +')
    expect(plus.height).toBeGreaterThanOrEqual(TOUCH_TARGET_PX)
  })
})

test('a link opens the new-leave form', async ({ page }) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)
  await page.goto('/?panel=leaves&entity=new')
  await expect(drawer(page).getByRole('heading', { name: he.leaves.noTypesTitle })).toBeVisible()
})
