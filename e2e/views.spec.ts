import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, board, closeDrawer, createType, requestLeave, openRotationInNewUnit } from './support/leaves.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations } from './support/workspace.ts'
import { selectView } from './support/board.ts'

// V13's demo: the list, the table and the calendar show the same soldiers and leaves as the timeline, from the
// view menu, on desktop and mobile, RTL, with axe (D-174). Sample data, tests only.

// A chip's name is its text: what is seen, then the status a reader cannot see, then the days.
const REGULAR = `רגילה ${he.leaves.statusPending}, 9–10 בנוב׳`
const SICK = `מחלה ${he.leaves.statusApproved}, 12 בנוב׳`

function region(page: Page, name: string) {
  return page.getByRole('region', { name })
}

test('the list, the table and the calendar show the board\'s leaves', async ({ page, isMobile }) => {
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

  await test.step('the list: a row for the soldier, with their leaves and dates', async () => {
    // A phone opens on the list and a desktop on the timeline, and the address names only a view chosen over it (D-290).
    await expect(isMobile ? region(page, he.engines.listLabel) : board(page)).toBeVisible()
    await selectView(page, he.workspace.views.list)
    // Choosing the view already shown changes nothing, so a phone's link stays bare (D-290).
    if (!isMobile) await expect(page).toHaveURL(/view=list/)
    const list = region(page, he.engines.listLabel)
    await expect(list.getByRole('button', { name: OWNER.name })).toBeVisible()
    await expect(list.getByRole('button', { name: REGULAR })).toBeVisible()
    await expect(list.getByRole('button', { name: SICK })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  await test.step('the table: a row for each leave, sorted by a header', async () => {
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

  await test.step('the calendar: a leave on each of its days, and who is out', async () => {
    await selectView(page, he.workspace.views.calendar)
    await expect(page).toHaveURL(/view=calendar/)
    const calendar = region(page, he.engines.calendarLabel)
    if (isMobile) {
      // A phone's day shows its number and who is out, and opens its report; the chips are from md up (D-338).
      await expect(calendar.getByText(new RegExp(`^${he.engines.away} 1$`))).toHaveCount(1)
    } else {
      await expect(calendar.getByRole('button', { name: `${OWNER.name} רגילה, ${he.leaves.statusPending}` })).toHaveCount(2)
      await expect(calendar.getByRole('button', { name: `${OWNER.name} מחלה` })).toHaveCount(1)
      // Only an approved leave takes a soldier out; a pending one is drawn but counts nobody (D-133).
      await expect(calendar.getByRole('heading', { name: new RegExp(he.engines.away) })).toHaveCount(1)
    }
    await expectNoAxeViolations(page)
  })

  await test.step('a leave opens from any view', async () => {
    // On a phone the calendar has no chips (D-338): the table opens the leave there.
    if (isMobile) await selectView(page, he.workspace.views.table)
    const opener = isMobile
      ? region(page, he.engines.tableLabel).getByRole('button', { name: 'מחלה' })
      : region(page, he.engines.calendarLabel).getByRole('button', { name: `${OWNER.name} מחלה` })
    await opener.click()
    await expect(page).toHaveURL(/panel=leaves/)
    await expect(page.getByRole('dialog').last()).toContainText('מחלה')
  })
})
