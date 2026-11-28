import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { createRule as createRuleOnPage, openRules, type RuleSpec } from './support/rules.ts'
import { createSoldier } from './support/soldiers.ts'
import { NOW, choose, closeDrawer, createType, drawer, leavesOf, openRotation, press, openNewLeave } from './support/leaves.ts'
import { addUnit, enterAsOwner, expectNoAxeViolations, openBoardOnTimeline, openModule, backToBoard } from './support/workspace.ts'
import { selectView } from './support/board.ts'

// V7's demo: a rule builder, the heat row, a soft rule that asks for an acknowledgment, a hard rule that refuses,
// and a configuration conflict, on desktop and mobile, RTL, with axe. Sample data, tests only.

const PLATOON = 'מחלקה א'

async function createUnit(page: Page, name: string) {
  await openModule(page, he.units.open)
  await addUnit(page, name)
  await closeDrawer(page)
}

async function createPlacedSoldier(page: Page, firstName: string, lastName: string) {
  await createSoldier(page, firstName, lastName, async () => {
    await choose(page, he.soldiers.unit, PLATOON)
  })
}

/** A rule of the platoon, from the page "כללי נוכחות" (D-482); back on the board after. */
async function createRule(page: Page, spec: Omit<RuleSpec, 'scope'>) {
  await createRuleOnPage(page, { ...spec, scope: PLATOON })
  await backToBoard(page)
}

/** A leave of today for a soldier, approved at once, from the floating "+". */
async function startLeave(page: Page, soldier: string) {
  await openNewLeave(page)
  await expect(drawer(page).getByRole('heading', { name: he.leaves.newTitle })).toBeVisible()
  await drawer(page).getByRole('combobox', { name: he.leaves.soldier }).fill(soldier.split(' ')[0] ?? soldier)
  await page.getByRole('option', { name: soldier, exact: true }).click()
  await choose(page, he.leaves.type, 'בית')
  await press(page, 'switch', he.leaves.approveNow)
}

function heatRow(page: Page) {
  return page.getByRole('group', { name: he.rules.heatRow })
}

// The steps read the timeline's bars, which a phone opens only when asked (D-290).
test.beforeEach(async ({ page, isMobile }) => {
  await openBoardOnTimeline(page, isMobile)
})

/** A day of the phone's calendar, by its date; its name says when it is below a rule (D-480). */
function calendarDay(page: Page, date: string) {
  return page.getByRole('region', { name: he.engines.calendarLabel }).getByRole('button', { name: new RegExp(date) })
}

test('a rule, the heat row, a soft rule acknowledged and a hard rule that refuses', async ({ page, isMobile }) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)

  await test.step('a platoon, two soldiers in it and a leave type', async () => {
    await createUnit(page, PLATOON)
    await createPlacedSoldier(page, 'יעל', 'שחר')
    await createPlacedSoldier(page, 'נועם', 'בר')
    await openModule(page, he.leaveTypes.open)
    await createType(page, { name: 'בית', color: he.palette.teal })
    await closeDrawer(page)
    await openRotation(page, ['יעל שחר', 'נועם בר'])
  })

  await test.step('"כללי נוכחות" starts empty, and a soft rule asks for two in the platoon', async () => {
    await expect(heatRow(page)).toHaveCount(0)
    await openRules(page)
    await expect(page.getByRole('heading', { name: he.rules.emptyTitle })).toBeVisible()
    await expectNoAxeViolations(page)
    await createRuleOnPage(page, { name: 'שניים במחלקה', scope: PLATOON, min: '2' })
    const row = page.getByRole('main').getByRole('listitem').filter({ hasText: 'שניים במחלקה' })
    await expect(row).toContainText(`${he.rules.min} 2`)
    // "soft", "hard" and "priority" never show on the list (the handoff's Availability rules).
    await expect(row).not.toContainText(he.rules.soft)
    await expectNoAxeViolations(page)
    await backToBoard(page)
    if (isMobile) {
      // A phone's timeline marks no threshold (the handoff's board spec, §3): its calendar does, by the day.
      await selectView(page, he.workspace.views.calendar)
      await expect(calendarDay(page, '10 בנובמבר 2026')).toHaveAccessibleName(new RegExp(he.kit.fractionLow))
      await selectView(page, he.workspace.views.timeline)
    } else {
      await expect(heatRow(page)).toBeVisible()
    }
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
    await backToBoard(page)
    await expect(leavesOf(page)).toHaveCount(1)
  })

  await test.step('the heat row marks the day, and opens its broken rules with who is missing', async () => {
    // Before the soldiers joined (8 to 10 November) the platoon had nobody, so those days break the rule too (D-071).
    if (isMobile) {
      // On a phone the calendar's day says it is below, and its drawer opens the day's rules.
      await selectView(page, he.workspace.views.calendar)
      await expect(calendarDay(page, '11 בנובמבר 2026')).toHaveAccessibleName(new RegExp(he.kit.fractionLow))
      await page.getByRole('button', { name: he.board.rulesBroken }).click()
    } else {
      const cell = heatRow(page).getByRole('button', { name: new RegExp(`^11 .*${he.rules.heatSoft}`) })
      await expect(cell).toHaveText('1')
      await cell.click()
    }
    const day = drawer(page).getByRole('region', { name: new RegExp(he.rules.dayTitle) })
    await expect(day).toContainText('שניים במחלקה')
    await expect(day).toContainText(`${he.rules.unavailable}: יעל שחר`)
    await expectNoAxeViolations(page)
  })

  await test.step('a hard rule refuses the next leave, which is not saved', async () => {
    await createRule(page, { name: 'לפחות אחד', min: '1', hard: true })
    if (isMobile) await selectView(page, he.workspace.views.timeline)
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

  await test.step('a maximum below the minimum is a conflict in the rules drawer of the board', async () => {
    await createRule(page, { name: 'לכל היותר אחד', max: '1' })
    if (isMobile) {
      await selectView(page, he.workspace.views.calendar)
      await calendarDay(page, '11 בנובמבר 2026').click()
      await page.getByRole('button', { name: he.board.rulesBroken }).click()
    } else {
      await heatRow(page).getByRole('button', { name: /^11 / }).click()
    }
    const conflicts = drawer(page).getByRole('region', { name: he.rules.conflictsTitle })
    await expect(conflicts).toContainText('שניים במחלקה')
    await expect(conflicts).toContainText('לכל היותר אחד')
    await expectNoAxeViolations(page)
  })
})
