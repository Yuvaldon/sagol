import { expect, test, type Locator, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, closeDrawer, createType, drawer, leavesOf, openRotationInNewUnit } from './support/leaves.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations, openBoardOnTimeline, openModule } from './support/workspace.ts'

// V28's demo: the request sheet (D-275). One soldier, two requests of their own types and days, the second repeating
// every week; one send puts every leave on the board and in "my requests". Desktop and mobile, RTL, with axe.
// Sample data, tests only.

function row(page: Page, n: number) {
  return drawer(page).getByRole('group', { name: `${he.leaves.row} ${String(n)}`, exact: true })
}

async function chooseIn(page: Page, scope: Locator, label: string, option: string) {
  await scope.getByRole('button', { name: new RegExp(`${label}$`) }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

async function typeDateIn(page: Page, scope: Locator, label: string, day: string, month: string, year: string) {
  await scope.getByRole('group', { name: label, exact: true }).getByRole('spinbutton').first().click()
  await page.keyboard.type(`${day}${month}${year}`)
}

// The steps read the timeline's bars, which a phone opens only when asked (D-290).
test.beforeEach(async ({ page, isMobile }) => {
  await openBoardOnTimeline(page, isMobile)
})

test('one sheet sends several requests, one of them repeating every week', async ({ page }) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)
  await openRotationInNewUnit(page, [OWNER.name])
  await openModule(page, he.leaveTypes.open)
  await createType(page, { name: 'רגילה', color: he.palette.teal, icon: he.icons.home })
  await createType(page, { name: 'מחלה', color: he.palette.red })
  await closeDrawer(page)

  await test.step('two rows, the second repeating', async () => {
    await page.getByRole('button', { name: he.leaves.new }).click()
    await expect(drawer(page).getByRole('heading', { name: he.leaves.newTitle })).toBeVisible()
    await drawer(page).getByRole('combobox', { name: he.leaves.soldier }).fill('דנה')
    await page.getByRole('option', { name: OWNER.name, exact: true }).click()

    const first = row(page, 1)
    await chooseIn(page, first, he.leaves.type, 'מחלה')
    await typeDateIn(page, first, he.leaves.from, '12', '11', '2026')
    await typeDateIn(page, first, he.leaves.to, '12', '11', '2026')
    // One row has nothing to remove.
    await expect(first.getByRole('button', { name: he.leaves.removeRow })).toHaveCount(0)

    await drawer(page).getByRole('button', { name: he.leaves.addRow }).click()
    const second = row(page, 2)
    await expect(second).toBeVisible()
    await chooseIn(page, second, he.leaves.type, 'רגילה')
    await typeDateIn(page, second, he.leaves.from, '10', '11', '2026')
    await typeDateIn(page, second, he.leaves.to, '10', '11', '2026')
    await second.locator('label').filter({ has: page.getByRole('switch', { name: he.leaves.repeats, exact: true }) }).click()
    await second.getByRole('textbox', { name: he.leaves.everyDays }).fill('7')
    await typeDateIn(page, second, he.leaves.repeatUntil, '24', '11', '2026')
    await expectNoAxeViolations(page)
    await drawer(page).getByRole('button', { name: he.leaves.submit, exact: true }).click()
    await expect(drawer(page)).toHaveCount(0)
  })

  await test.step('every leave is on the board and in "my requests"', async () => {
    // The sick day on the 12th, and the regular day on the 10th, 17th and 24th.
    await expect(leavesOf(page)).toHaveCount(4)
    await openModule(page, he.myLeaves.open)
    const list = drawer(page).getByRole('list', { name: he.myLeaves.openTitle })
    await expect(list.getByRole('button', { name: /רגילה/ })).toHaveCount(3)
    await expect(list.getByRole('button', { name: /מחלה/ })).toHaveCount(1)
    await expectNoAxeViolations(page)
  })
})
