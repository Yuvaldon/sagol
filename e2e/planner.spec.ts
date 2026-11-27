import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { createSoldier, openManageIndex } from './support/soldiers.ts'
import { NOW, closeDrawer, createType, drawer, leavesOf, openRotationInNewUnit } from './support/leaves.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations, openBoardOnTimeline, openModule, openTab, backToBoard } from './support/workspace.ts'
import { chooseOption } from './support/board.ts'

// V31's demo: the leave-round planner (D-270, D-316). Two groups of the rotation's soldiers take turns on the routine
// rhythm (8 days in, 6 home) from their own first day home; one send puts every round on the board. Desktop and
// mobile, RTL, with axe. Sample data, tests only.

const SOLDIER = 'יעל שחר'


function group(page: Page, n: number) {
  return drawer(page).getByRole('group', { name: `${he.leaves.roundsGroup} ${String(n)}`, exact: true })
}

// The steps read the timeline's bars, which a phone opens only when asked (D-290).
test.beforeEach(async ({ page, isMobile }) => {
  await openBoardOnTimeline(page, isMobile)
})

test('two groups take turns going home, sent as one collective leave', async ({ page, isMobile }) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)
  await createSoldier(page, 'יעל', 'שחר')
  await openRotationInNewUnit(page, [OWNER.name, SOLDIER])
  await openModule(page, he.leaveTypes.open)
  await createType(page, { name: 'רגילה', color: he.palette.teal })
  await closeDrawer(page)

  await test.step('"היום" reminds the planner who has no round yet, and its card opens the planner (OI-389)', async () => {
    await openTab(page, 'today')
    const card = page.getByRole('region', { name: he.manage.round.card })
    await expect(card).toContainText('2')
    await expectNoAxeViolations(page)
    await card.getByRole('button', { name: he.manage.round.card }).click()
    await expect(drawer(page).getByRole('heading', { name: he.leaves.roundsTitle })).toBeVisible()
    await closeDrawer(page)
  })

  await test.step('a plan of two groups, each with its rounds', async () => {
    // The planner has its own entry: a row of "ניהול" saying who has no round yet (OI-389, D-482).
    await openManageIndex(page)
    await expect(page.getByRole('main').getByRole('button', { name: he.manage.round.row, exact: true })).toHaveAccessibleDescription(`2 ${he.manage.round.unplanned}`)
    await page.getByRole('main').getByRole('button', { name: he.manage.round.row, exact: true }).click()
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
    await backToBoard(page)
  })

  await test.step('every round is on the board', async () => {
    // A phone's timeline opens on a week; the whole rotation is a range of the options (D-480).
    if (isMobile) await chooseOption(page, he.board.range, he.workspace.rotations)
    await expect(leavesOf(page)).toHaveCount(3)
    await expectNoAxeViolations(page)
  })

  await test.step('once every soldier has a round, the card is gone and the row says it is planned', async () => {
    await openTab(page, 'today')
    await expect(page.getByRole('region', { name: he.manage.round.card })).toHaveCount(0)
    await openManageIndex(page)
    await expect(page.getByRole('main').getByRole('button', { name: he.manage.round.row, exact: true })).toHaveAccessibleDescription(he.manage.round.planned)
  })
})
