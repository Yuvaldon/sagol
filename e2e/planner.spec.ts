import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, closeDrawer, createType, drawer, leavesOf, openRotationInNewUnit } from './support/leaves.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations, openBoardOnTimeline, openModule } from './support/workspace.ts'

// V31's demo: the leave-round planner (D-270, D-316). Two groups of the rotation's soldiers take turns on the routine
// rhythm (8 days in, 6 home) from their own first day home; one send puts every round on the board. Desktop and
// mobile, RTL, with axe. Sample data, tests only.

const SOLDIER = 'יעל שחר'

async function createSoldier(page: Page, firstName: string, lastName: string) {
  await drawer(page).getByRole('button', { name: he.soldiers.new }).first().click()
  await page.getByLabel(he.soldiers.firstName).fill(firstName)
  await page.getByLabel(he.soldiers.lastName).fill(lastName)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(drawer(page).getByRole('list', { name: he.soldiers.listLabel }).getByText(`${firstName} ${lastName}`)).toBeVisible()
}

function group(page: Page, n: number) {
  return drawer(page).getByRole('group', { name: `${he.leaves.roundsGroup} ${String(n)}`, exact: true })
}

// The steps read the timeline's bars, which a phone opens only when asked (D-290).
test.beforeEach(async ({ page, isMobile }) => {
  await openBoardOnTimeline(page, isMobile)
})

test('two groups take turns going home, sent as one collective leave', async ({ page }) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)
  await openModule(page, he.soldiers.open)
  await createSoldier(page, 'יעל', 'שחר')
  await closeDrawer(page)
  await openRotationInNewUnit(page, [OWNER.name, SOLDIER])
  await openModule(page, he.leaveTypes.open)
  await createType(page, { name: 'רגילה', color: he.palette.teal })
  await closeDrawer(page)

  await test.step('a plan of two groups, each with its rounds', async () => {
    await page.getByRole('button', { name: he.leaves.new }).click()
    await drawer(page).getByRole('button', { name: he.leaves.rounds }).click()
    await expect(drawer(page).getByRole('heading', { name: he.leaves.roundsTitle })).toBeVisible()
    await page.getByLabel(he.leaves.roundsName).fill('סבבי נובמבר')
    // The plan runs from today to the rotation's end, at the routine rhythm; the first group goes home today.
    await expect(page.getByRole('textbox', { name: he.leaves.daysIn })).toHaveValue('8')
    await expect(page.getByRole('textbox', { name: he.leaves.daysHome })).toHaveValue('6')
    await group(page, 1).locator('label').filter({ has: page.getByRole('checkbox', { name: OWNER.name, exact: true }) }).click()
    // A new group goes home right after the last one: they take turns.
    await drawer(page).getByRole('button', { name: he.leaves.addGroup }).click()
    // A soldier goes home with one group only.
    await expect(group(page, 2).getByRole('checkbox', { name: OWNER.name, exact: true })).toHaveCount(0)
    await group(page, 2).locator('label').filter({ has: page.getByRole('checkbox', { name: SOLDIER, exact: true }) }).click()
    // 11–16 and 25–30 November for the first group, 17–22 for the second.
    await expect(drawer(page).getByText(`${he.leaves.roundsCount} 3`, { exact: true })).toBeVisible()
    await drawer(page).getByRole('button', { name: new RegExp(`${he.leaves.type}$`) }).click()
    await page.getByRole('option', { name: 'רגילה', exact: true }).click()
    await expectNoAxeViolations(page)
    await drawer(page).getByRole('button', { name: he.leaves.roundsSubmit }).click()
    await expect(drawer(page)).toHaveCount(0)
  })

  await test.step('every round is on the board', async () => {
    await expect(leavesOf(page)).toHaveCount(3)
    await expectNoAxeViolations(page)
  })
})
