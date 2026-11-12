import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, choose, closeDrawer, createType, drawer, leavesOf, openRotation, press } from './support/leaves.ts'
import { addUnit, enterAsOwner, expectNoAxeViolations, openModule } from './support/workspace.ts'

// V7's demo: a rule builder, the heat row, a soft rule that asks for an acknowledgment, a hard rule that refuses,
// and a configuration conflict, on desktop and mobile, RTL, with axe. Sample data, tests only.

const PLATOON = 'מחלקה א'

async function createUnit(page: Page, name: string) {
  await openModule(page, he.units.open)
  await addUnit(page, name)
  await closeDrawer(page)
}

async function createPlacedSoldier(page: Page, firstName: string, lastName: string) {
  await drawer(page).getByRole('button', { name: he.soldiers.new }).first().click()
  await page.getByLabel(he.soldiers.firstName).fill(firstName)
  await page.getByLabel(he.soldiers.lastName).fill(lastName)
  await choose(page, he.soldiers.unit, PLATOON)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(drawer(page).getByRole('list', { name: he.soldiers.listLabel }).getByText(`${firstName} ${lastName}`)).toBeVisible()
}

interface RuleSpec {
  readonly name: string
  readonly min?: string
  readonly max?: string
  readonly hard?: boolean
}

async function createRule(page: Page, spec: RuleSpec) {
  await drawer(page).getByRole('button', { name: he.rules.new }).first().click()
  await expect(drawer(page).getByRole('heading', { name: he.rules.newTitle })).toBeVisible()
  await page.getByLabel(he.rules.name).fill(spec.name)
  if (spec.hard === true) await choose(page, he.rules.enforcement, he.rules.enforcementHard)
  if (spec.min !== undefined) await page.getByLabel(he.rules.min, { exact: true }).fill(spec.min)
  if (spec.max !== undefined) await page.getByLabel(he.rules.max, { exact: true }).fill(spec.max)
  await choose(page, he.rules.scope, PLATOON)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(drawer(page).getByRole('list', { name: he.rules.listLabel }).getByText(spec.name, { exact: true })).toBeVisible()
}

/** A leave of today for a soldier, approved at once, from the floating "+". */
async function startLeave(page: Page, soldier: string) {
  await page.getByRole('button', { name: he.leaves.new }).click()
  await expect(drawer(page).getByRole('heading', { name: he.leaves.newTitle })).toBeVisible()
  await drawer(page).getByRole('combobox', { name: he.leaves.soldier }).fill(soldier.split(' ')[0] ?? soldier)
  await page.getByRole('option', { name: soldier, exact: true }).click()
  await choose(page, he.leaves.type, 'בית')
  await press(page, 'switch', he.leaves.approveNow)
}

function heatRow(page: Page) {
  return page.getByRole('group', { name: he.rules.heatRow })
}

test('a rule, the heat row, a soft rule acknowledged and a hard rule that refuses', async ({ page }) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)

  await test.step('a platoon, two soldiers in it and a leave type', async () => {
    await createUnit(page, PLATOON)
    await openModule(page, he.soldiers.open)
    await createPlacedSoldier(page, 'יעל', 'שחר')
    await createPlacedSoldier(page, 'נועם', 'בר')
    await closeDrawer(page)
    await openModule(page, he.leaveTypes.open)
    await createType(page, { name: 'בית', color: he.palette.teal })
    await closeDrawer(page)
    await openRotation(page, ['יעל שחר', 'נועם בר'])
  })

  await test.step('the rules drawer starts empty, and a soft rule asks for two in the platoon', async () => {
    await expect(heatRow(page)).toHaveCount(0)
    await openModule(page, he.rules.open)
    await expect(drawer(page).getByRole('heading', { name: he.rules.emptyTitle })).toBeVisible()
    await expectNoAxeViolations(page)
    await createRule(page, { name: 'שניים במחלקה', min: '2' })
    const row = drawer(page).getByRole('list', { name: he.rules.listLabel }).getByRole('listitem').filter({ hasText: 'שניים במחלקה' })
    await expect(row).toContainText(`${he.rules.min} 2`)
    await expect(row).toContainText(he.rules.soft)
    await expect(drawer(page).getByText(he.rules.noConflicts)).toBeVisible()
    await expectNoAxeViolations(page)
    await closeDrawer(page)
    await expect(heatRow(page)).toBeVisible()
  })

  await test.step('a leave that breaks it warns while filled, and asks before it is saved', async () => {
    await startLeave(page, 'יעל שחר')
    const warning = drawer(page).getByRole('status', { name: he.rules.warningTitle })
    await expect(warning).toContainText('שניים במחלקה')
    await expect(warning).toContainText('יעל שחר')
    await expectNoAxeViolations(page)
    await drawer(page).getByRole('button', { name: he.leaves.submit, exact: true }).click()
    const dialog = page.getByRole('alertdialog', { name: he.rules.ackTitle })
    await expect(dialog).toContainText('שניים במחלקה')
    await expectNoAxeViolations(page)
    await dialog.getByRole('button', { name: he.rules.ackConfirm }).click()
    await expect(leavesOf(page)).toHaveCount(1)
  })

  await test.step('the heat row marks the day, and opens its broken rules with who is missing', async () => {
    // Before the soldiers joined (8 to 10 November) the platoon had nobody, so those days break the rule too (D-071).
    const cell = heatRow(page).getByRole('button', { name: new RegExp(`^11 .*${he.rules.heatSoft}`) })
    await expect(cell).toHaveText('1')
    await cell.click()
    const day = drawer(page).getByRole('region', { name: new RegExp(he.rules.dayTitle) })
    await expect(day).toContainText('שניים במחלקה')
    await expect(day).toContainText(`${he.rules.unavailable}: יעל שחר`)
    await expectNoAxeViolations(page)
  })

  await test.step('a hard rule refuses the next leave, which is not saved', async () => {
    await createRule(page, { name: 'לפחות אחד', min: '1', hard: true })
    await closeDrawer(page)
    await startLeave(page, 'נועם בר')
    await expect(drawer(page).getByRole('status', { name: he.rules.warningHardTitle })).toContainText('לפחות אחד')
    await drawer(page).getByRole('button', { name: he.leaves.submit, exact: true }).click()
    const dialog = page.getByRole('alertdialog', { name: he.rules.refusedTitle })
    await expect(dialog).toContainText('לפחות אחד')
    await expectNoAxeViolations(page)
    await dialog.getByRole('button', { name: he.common.close }).click()
    await closeDrawer(page)
    await expect(leavesOf(page)).toHaveCount(1)
  })

  await test.step('a maximum below the minimum is a conflict in the rules drawer', async () => {
    await openModule(page, he.rules.open)
    await createRule(page, { name: 'לכל היותר אחד', max: '1' })
    const conflicts = drawer(page).getByRole('region', { name: he.rules.conflictsTitle })
    await expect(conflicts).toContainText('שניים במחלקה')
    await expect(conflicts).toContainText('לכל היותר אחד')
    await expectNoAxeViolations(page)
  })
})
