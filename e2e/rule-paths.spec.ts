import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, choose, closeDrawer, createType, drawer, leavesOf, openRotation, typeDate } from './support/leaves.ts'
import { addUnit, enterAsOwner, expectNoAxeViolations, openModule } from './support/workspace.ts'

// The rest of the rule paths on screen (OI-107): the warning on the edit form, and the acknowledgment dialog on the
// details' approve step, the inbox's approve and the close dialog. Desktop and mobile, RTL, with axe. Sample data,
// tests only.

const PLATOON = 'מחלקה ב'
const TYPE = 'בית'
const AT_LEAST_TWO = 'שניים במחלקה'
const AT_MOST_ONE = 'לכל היותר אחד'

async function createRule(page: Page, name: string, bound: 'min' | 'max', value: string) {
  await openModule(page, he.rules.open)
  await drawer(page).getByRole('button', { name: he.rules.new }).first().click()
  await page.getByLabel(he.rules.name).fill(name)
  await page.getByLabel(bound === 'min' ? he.rules.min : he.rules.max, { exact: true }).fill(value)
  await choose(page, he.rules.scope, PLATOON)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(drawer(page).getByRole('list', { name: he.rules.listLabel }).getByText(name, { exact: true })).toBeVisible()
  await closeDrawer(page)
}

/** A platoon with two soldiers, a type, and a soft rule that wants both of them there. */
async function setUp(page: Page) {
  await openModule(page, he.units.open)
  await addUnit(page, PLATOON)
  await closeDrawer(page)
  await openModule(page, he.soldiers.open)
  for (const [first, last] of [
    ['יעל', 'שחר'],
    ['נועם', 'בר'],
  ] as const) {
    await drawer(page).getByRole('button', { name: he.soldiers.new }).first().click()
    await page.getByLabel(he.soldiers.firstName).fill(first)
    await page.getByLabel(he.soldiers.lastName).fill(last)
    await choose(page, he.soldiers.unit, PLATOON)
    await page.getByRole('button', { name: he.common.create }).click()
    await expect(drawer(page).getByRole('list', { name: he.soldiers.listLabel }).getByText(`${first} ${last}`)).toBeVisible()
  }
  await closeDrawer(page)
  await openModule(page, he.leaveTypes.open)
  await createType(page, { name: TYPE, color: he.palette.teal })
  await closeDrawer(page)
  await createRule(page, AT_LEAST_TWO, 'min', '2')
  await openRotation(page, ['יעל שחר', 'נועם בר'])
}

/** A request of today, left pending: a pending leave does not count yet, so it breaks nothing. */
async function requestToday(page: Page, soldier: string) {
  await page.getByRole('button', { name: he.leaves.new }).click()
  await expect(drawer(page).getByRole('heading', { name: he.leaves.newTitle })).toBeVisible()
  await drawer(page).getByRole('combobox', { name: he.leaves.soldier }).fill(soldier.split(' ')[0] ?? soldier)
  await page.getByRole('option', { name: soldier, exact: true }).click()
  await choose(page, he.leaves.type, TYPE)
  await drawer(page).getByRole('button', { name: he.leaves.submit, exact: true }).click()
  await expect(drawer(page)).toHaveCount(0)
}

function ackDialog(page: Page) {
  return page.getByRole('alertdialog', { name: he.rules.ackTitle })
}

function actions(page: Page) {
  return drawer(page).getByRole('group', { name: he.leaves.actionsLabel })
}

test('the edit form warns, and approving or closing asks before a soft rule is broken', async ({ page }) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)
  await setUp(page)

  await test.step('approving in the details asks, and the leave is approved after the answer', async () => {
    await requestToday(page, 'יעל שחר')
    await expect(leavesOf(page)).toHaveCount(1)
    await leavesOf(page).first().click()
    await actions(page).getByRole('button', { name: he.leaves.approve }).click()
    await expect(ackDialog(page)).toContainText(AT_LEAST_TWO)
    await expectNoAxeViolations(page)
    await ackDialog(page).getByRole('button', { name: he.rules.ackConfirm }).click()
    await expect(ackDialog(page)).toHaveCount(0)
    await expect(drawer(page).getByText(he.leaves.statusApproved, { exact: true }).first()).toBeVisible()
  })

  await test.step('the edit form warns while a change would break the rule on more days', async () => {
    await actions(page).getByRole('button', { name: he.leaves.edit }).click()
    await typeDate(page, he.leaves.to, '12', '11', '2026')
    const warning = drawer(page).getByRole('status', { name: he.rules.warningTitle })
    await expect(warning).toContainText(AT_LEAST_TWO)
    await expect(warning).toContainText('יעל שחר')
    await expectNoAxeViolations(page)
    await closeDrawer(page)
  })

  await test.step('approving in the inbox asks too', async () => {
    await requestToday(page, 'נועם בר')
    await openModule(page, new RegExp(`^${he.inbox.open}( \\d+ ${he.inbox.pendingCount})?$`))
    const list = drawer(page).getByRole('list', { name: he.inbox.pendingLabel })
    await expect(list.getByText('נועם בר')).toBeVisible()
    await list.getByRole('button', { name: he.leaves.approve }).click()
    await expect(ackDialog(page)).toContainText(AT_LEAST_TWO)
    await expectNoAxeViolations(page)
    await ackDialog(page).getByRole('button', { name: he.rules.ackConfirm }).click()
    await expect(drawer(page).getByText(he.inbox.emptyPendingTitle)).toBeVisible()
    await closeDrawer(page)
  })

  await test.step('cancelling can break a maximum, and the close dialog asks for it', async () => {
    await createRule(page, AT_MOST_ONE, 'max', '1')
    // The first cancel brings one back, which the maximum allows; the second brings the second one back.
    for (const [index, asks] of [
      [0, false],
      [0, true],
    ] as const) {
      await leavesOf(page).nth(index).click()
      await actions(page).getByRole('button', { name: he.leaves.cancel }).click()
      const close = page.getByRole('dialog', { name: he.leaves.cancelTitle })
      await close.getByRole('button', { name: he.leaves.cancel }).click()
      if (asks) {
        await expect(ackDialog(page)).toContainText(AT_MOST_ONE)
        await expectNoAxeViolations(page)
        await ackDialog(page).getByRole('button', { name: he.rules.ackConfirm }).click()
      }
      await expect(close).toHaveCount(0)
      await closeDrawer(page)
    }
    await expect(leavesOf(page)).toHaveCount(0)
  })
})
