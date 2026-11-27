import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, board, closeDrawer, createType, requestLeave, openRotationInNewUnit } from './support/leaves.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations } from './support/workspace.ts'
import { selectView } from './support/board.ts'

// V13's demo, the board's views (D-174, D-480): the movements, the table (a wide screen's) and the calendar show the
// same soldiers and leaves as the timeline, from the view switcher, on desktop and mobile, RTL, with axe. Sample data,
// tests only.

// A row of a day is named by the person, the type, whether it waits, and whether it starts or ends today.
const REGULAR = `${OWNER.name} · רגילה · ${he.leaves.badgePending}`
const SICK = `${OWNER.name} · מחלה`

function region(page: Page, name: string) {
  return page.getByRole('region', { name })
}

test('the movements, the table and the calendar show the board\'s leaves', async ({ page, isMobile }) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)
  await openRotationInNewUnit(page, [OWNER.name])

  await test.step('two leaves of two types', async () => {
    await page.goto('/?panel=leave_types')
    await createType(page, { name: 'רגילה', color: he.palette.teal })
    await createType(page, { name: 'מחלה', color: he.palette.red })
    await closeDrawer(page)
    await requestLeave(page, { type: 'רגילה', from: ['09', '11', '2026'], to: ['10', '11', '2026'] })
    await requestLeave(page, { type: 'מחלה', from: ['12', '11', '2026'], to: ['12', '11', '2026'], approveNow: true })
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  await test.step('the movements: who leaves and who returns, by day', async () => {
    // A phone opens on the calendar and a desktop on the timeline (D-463).
    await expect(isMobile ? region(page, he.engines.calendarLabel) : board(page)).toBeVisible()
    await selectView(page, he.workspace.views.list)
    await expect(page).toHaveURL(/view=list/)
    const movements = region(page, he.board.movements)
    // The request leaves on the 9th and returns on the 10th; the one day of the sick leave is listed once, leaving.
    await expect(movements.getByRole('button', { name: REGULAR })).toHaveCount(2)
    await expect(movements.getByRole('button', { name: SICK })).toHaveCount(1)
    await expect(movements.getByRole('heading', { name: new RegExp(he.board.todayTag) })).toBeVisible()
    await expectNoAxeViolations(page)
    // A day's header opens the unit's drawer on it, and the list stays where its reader left it (D-480).
    const twelfth = movements.getByRole('button', { name: /12 בנובמבר 2026/ })
    const before = await twelfth.boundingBox()
    await twelfth.click()
    await expect(page).toHaveURL(/day=2026-11-12/)
    await expect(page.getByRole('dialog').last()).toContainText('יום חמישי, 12 בנובמבר 2026')
    await page.getByRole('dialog').last().getByRole('button', { name: he.common.close }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const after = await twelfth.boundingBox()
    expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThanOrEqual(2)
  })

  await test.step('the table: a row for each leave, sorted by a header; a phone has no table', async () => {
    if (isMobile) {
      await page.getByRole('button', { name: he.workspace.view, exact: true }).click()
      const fan = page.getByRole('group', { name: he.board.fan })
      await expect(fan.getByRole('button', { name: he.workspace.views.calendar })).toBeVisible()
      await expect(fan.getByRole('button', { name: he.workspace.views.table })).toHaveCount(0)
      await page.keyboard.press('Escape')
      return
    }
    await selectView(page, he.workspace.views.table)
    await expect(page).toHaveURL(/view=table/)
    const table = region(page, he.engines.tableLabel)
    const rows = table.getByRole('row')
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(1)).toContainText('רגילה')
    const type = table.getByRole('columnheader', { name: he.engines.columns.type })
    await type.getByRole('button').click()
    await expect(type).toHaveAttribute('aria-sort', 'ascending')
    await expect(rows.nth(1)).toContainText('מחלה')
    await expect(rows.nth(2)).toContainText('רגילה')
    await expectNoAxeViolations(page)
    await page.reload()
    await expect(region(page, he.engines.tableLabel)).toBeVisible()
  })

  await test.step('the calendar: a request on each of its days, and who is on base', async () => {
    await selectView(page, he.workspace.views.calendar)
    await expect(page).toHaveURL(/view=calendar/)
    const calendar = region(page, he.engines.calendarLabel)
    // Only an approved leave takes a soldier off base; a pending one is named but counts nobody (D-133).
    await expect(calendar.getByRole('button', { name: new RegExp(`9 בנובמבר 2026 · 1 ${he.kit.fractionOf} 1 ${he.board.onBase} · ${OWNER.name}`) })).toBeVisible()
    await expect(calendar.getByRole('button', { name: new RegExp(`12 בנובמבר 2026 · 0 ${he.kit.fractionOf} 1 ${he.board.onBase} · ${OWNER.name}`) })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  await test.step('a leave opens from the day it is on', async () => {
    const day = region(page, he.engines.calendarLabel).getByRole('button', { name: /12 בנובמבר 2026/ })
    await day.click()
    // A second tap on the selected day opens its drawer to the middle.
    await day.click()
    await page.getByRole('button', { name: `${SICK} · ${he.board.leavingToday}` }).click()
    await expect(page).toHaveURL(/panel=leaves/)
    await expect(page.getByRole('dialog').last()).toContainText('מחלה')
  })
})
