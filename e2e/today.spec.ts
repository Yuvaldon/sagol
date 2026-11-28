import { expect, test } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { TYPE, YAEL_NAME, enterAsYael, setUpFighter, signOut } from './support/fighter.ts'
import { choose, drawer } from './support/leaves.ts'
import { OWNER, expectNoAxeViolations, openTab, signIn, tab } from './support/workspace.ts'

// "היום" (D-454, D-459, D-467): a soldier marks days in the month and asks for them from the tray; the commander
// answers on the card and on the page of requests, and takes an answer back from the toast; a day column opens the
// unit's drawer. On desktop and mobile, RTL, with axe. Sample data, tests only.

test('a soldier asks for days from the month, and the commander answers on "היום"', async ({ page }, testInfo) => {
  await setUpFighter(page)
  await signOut(page)
  await enterAsYael(page)
  const strip = page.getByRole('list', { name: he.myLeaves.nextDaysTitle })
  const tray = page.getByRole('group', { name: he.today.selection })

  await test.step('the strip opens into the month, where two taps mark a range and the tray replaces the tab bar', async () => {
    await expect(strip.getByRole('listitem')).toHaveCount(14)
    await page.getByRole('main').getByRole('button', { name: he.today.noOut }).click()
    await expect(strip).toHaveCount(0)
    const days = page.getByRole('grid').getByRole('gridcell')
    // A day that has passed takes no request, and says so.
    await expect(days.filter({ hasText: '10 בנובמבר' })).toHaveAttribute('aria-disabled', 'true')
    // Forced: the press is made on a day that says it is unavailable, to see that nothing comes of it.
    await days.filter({ hasText: '10 בנובמבר' }).click({ force: true })
    await expect(tray).toHaveCount(0)
    // The grid is walked with the keyboard: one day takes Tab (today), the arrows move by a day and by a week, and
    // Enter marks the day. Right to left, the left arrow is the next day.
    await days.filter({ hasText: '11 בנובמבר' }).focus()
    await page.keyboard.press('ArrowDown')
    await expect(days.filter({ hasText: '18 בנובמבר' })).toBeFocused()
    await page.keyboard.press('Enter')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await expect(days.filter({ hasText: '20 בנובמבר' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('grid').getByRole('gridcell', { selected: true })).toHaveCount(3)
    await expect(tray.getByRole('button', { name: `${he.today.requestDays} · 3 ${he.leaves.days}` })).toBeVisible()
    // The tray stands in the tab bar's place on a phone; the rail of a wide screen stays (D-491).
    await expect(tab(page, 'today')).toHaveCount(testInfo.project.name === 'desktop' ? 1 : 0)
    await expectNoAxeViolations(page)
  })

  await test.step('the tray opens the request with the days filled, and letting go of the days returns the bar', async () => {
    await tray.getByRole('button', { name: he.today.clearSelection }).click()
    await expect(tray).toHaveCount(0)
    await expect(tab(page, 'today')).toBeVisible()
    const days = page.getByRole('grid').getByRole('gridcell')
    await days.filter({ hasText: '18 בנובמבר' }).click()
    await days.filter({ hasText: '20 בנובמבר' }).click()
    await tray.getByRole('button', { name: new RegExp(`^${he.today.requestDays}`) }).click()
    await expect(drawer(page).getByRole('heading', { name: he.leaves.newTitle })).toBeVisible()
    await expect(drawer(page).getByRole('combobox', { name: he.leaves.soldier })).toHaveValue(YAEL_NAME)
    // The type is a row of chips, and the row says how many days it holds.
    await choose(page, he.leaves.type, TYPE)
    await expect(drawer(page).getByRole('radio', { name: TYPE, exact: true })).toBeChecked()
    const row = drawer(page).getByRole('group', { name: `${he.leaves.row} 1` })
    await expect(row.getByText(`3 ${he.leaves.days}`, { exact: true })).toBeVisible()
    // The days are picked again on the form's own month: one tap a day, a second a range.
    await row.getByRole('button', { name: he.leaves.pickDays, exact: true }).click()
    const month = row.getByRole('grid').getByRole('gridcell')
    await expect(month.filter({ hasText: '19 בנובמבר' })).toHaveAttribute('aria-selected', 'true')
    await month.filter({ hasText: '23 בנובמבר' }).click()
    await month.filter({ hasText: '24 בנובמבר' }).click()
    await expect(row.getByText(`2 ${he.leaves.days}`, { exact: true })).toBeVisible()
    await expectNoAxeViolations(page)
    await drawer(page).getByRole('button', { name: he.leaves.submit, exact: true }).click()
    await expect(drawer(page)).toBeHidden()
    const mine = page.getByRole('region', { name: he.today.myRequest })
    await expect(mine).toContainText('23–24 בנוב׳')
    await expect(mine.getByText(he.leaves.badgePending, { exact: true })).toBeVisible()
  })

  await test.step('the request opens its card: the days large, the type and the badge', async () => {
    await page.getByRole('region', { name: he.today.myRequest }).getByRole('button', { name: new RegExp(TYPE) }).click()
    const card = page.getByRole('dialog', { name: TYPE })
    const details = card.getByRole('region', { name: he.leaves.detailsLabel })
    await expect(details).toContainText('23–24 בנוב׳')
    await expect(details).toContainText(`${TYPE} · 2 ${he.leaves.days}`)
    await expect(details.getByText(he.leaves.badgePending, { exact: true })).toBeVisible()
    // Her role may neither edit nor cancel, so the card offers no action.
    await expect(card.getByRole('group', { name: he.leaves.actionsLabel }).getByRole('button')).toHaveCount(0)
    await expectNoAxeViolations(page)
    await card.getByRole('button', { name: he.common.close }).click()
    await expect(card).toHaveCount(0)
  })

  await test.step('who reads the unit\'s soldiers and has no unit block still opens "דוח 1", from its card (D-472)', async () => {
    const card = page.getByRole('region', { name: he.presence.title })
    await card.getByRole('button', { name: he.today.openReport, exact: true }).click()
    const report = page.getByRole('dialog', { name: he.presence.title })
    await expect(report).toBeVisible()
    await report.getByRole('button', { name: he.common.close }).click()
    await expect(report).toHaveCount(0)
  })

  await test.step('the page of requests is not for who approves nobody: its address shows "היום"', async () => {
    await page.goto('/?page=requests')
    await expect(page.getByRole('list', { name: he.myLeaves.nextDaysTitle })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: he.today.approvals })).toHaveCount(0)
    await expect(page.getByRole('button', { name: he.today.closedDoor })).toHaveCount(0)
    await expect(page).not.toHaveURL(/page=/)
  })

  const waiting = page.getByRole('region', { name: he.today.approvals })
  const toast = page.getByRole('status').filter({ hasText: new RegExp(`${he.today.approved}|${he.today.rejected}`) })

  await test.step('the commander approves on the card, and "ביטול" in the toast takes it back', async () => {
    await signOut(page)
    await signIn(page, OWNER.email)
    await expect(waiting).toContainText(`1 ${he.inbox.pendingCount}`)
    await expectNoAxeViolations(page)
    // The row opens the leave card, where the actions stand two in a row with equal weight.
    await waiting.getByRole('button', { name: new RegExp(`^${YAEL_NAME}`) }).click()
    const card = page.getByRole('dialog', { name: TYPE })
    const actions = card.getByRole('group', { name: he.leaves.actionsLabel })
    const approve = await actions.getByRole('button', { name: he.leaves.approve, exact: true }).boundingBox()
    const reject = await actions.getByRole('button', { name: he.leaves.reject, exact: true }).boundingBox()
    if (approve === null || reject === null) throw new Error('an action of the card is missing')
    expect(Math.abs(approve.width - reject.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(approve.y - reject.y)).toBeLessThanOrEqual(1)
    await expectNoAxeViolations(page)
    await card.getByRole('button', { name: he.common.close }).click()
    await expect(card).toHaveCount(0)
    await waiting.getByRole('button', { name: `${he.leaves.approve} ${YAEL_NAME}` }).click()
    // The card leaves with its last row; the toast stays to say what happened.
    await expect(waiting).toHaveCount(0)
    await expect(toast).toContainText(he.today.approved)
    await expectNoAxeViolations(page)
    await toast.getByRole('button', { name: he.common.cancel }).click()
    await expect(waiting).toContainText(`1 ${he.inbox.pendingCount}`)
    await expect(toast).toHaveCount(0)
  })

  await test.step('the title opens the page of requests, where a rejection asks first', async () => {
    await waiting.getByRole('button', { name: he.today.approvals, exact: true }).click()
    await expect(page).toHaveURL(/page=requests/)
    // The page takes the keyboard on its heading, and gives it back to the card's title when it closes.
    await expect(page.getByRole('heading', { level: 1, name: he.today.approvals })).toBeFocused()
    await page.getByRole('button', { name: he.shell.back, exact: true }).click()
    await expect(waiting.getByRole('button', { name: he.today.approvals, exact: true })).toBeFocused()
    await waiting.getByRole('button', { name: he.today.approvals, exact: true }).click()
    // A reload keeps the page.
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: he.today.approvals })).toBeVisible()
    await expectNoAxeViolations(page)
    await page.getByRole('button', { name: `${he.leaves.reject} ${YAEL_NAME}` }).click()
    await expect(page.getByRole('heading', { name: he.leaves.rejectTitle })).toBeVisible()
    await page.getByRole('button', { name: he.leaves.reject, exact: true }).click()
    await expect(toast).toContainText(he.today.rejected)
    await expect(page.getByRole('heading', { name: he.inbox.emptyPendingTitle })).toBeVisible()
    // The answered row is gone with the button that was pressed: the page's heading has the keyboard.
    await expect(page.getByRole('heading', { level: 1, name: he.today.approvals })).toBeFocused()
    await page.getByRole('button', { name: he.shell.back, exact: true }).click()
    await expect(page).not.toHaveURL(/page=/)
    await expect(waiting).toHaveCount(0)
  })

  await test.step('"דוח 1" opens in the drawer, and once every unit is sent its button says so with the time', async () => {
    const button = page.getByRole('main').getByRole('button', { name: new RegExp(`^${he.presence.title}`) })
    await expect(button).toHaveAccessibleName(he.presence.title)
    await button.click()
    const report = page.getByRole('dialog', { name: he.presence.title })
    await expect(report).toBeVisible()
    await expectNoAxeViolations(page)
    const send = report.getByRole('button', { name: he.presence.confirm, exact: true })
    await expect(send.first()).toBeVisible()
    while ((await send.count()) > 0) {
      const left = await send.count()
      await send.first().click()
      await expect(send).toHaveCount(left - 1)
    }
    await report.getByRole('button', { name: he.common.close }).click()
    await expect(report).toHaveCount(0)
    // The clock of the demo stands at noon in Israel.
    await expect(button).toHaveAccessibleName(`${he.presence.title} ${he.presence.statusConfirmed} 12:00`)
    await expect(button).toHaveText('12:00')
    await expectNoAxeViolations(page)
  })

  await test.step('the fraction opens the unit\'s drawer, which grows from its handle on a phone', async () => {
    const columns = page.getByRole('list', { name: he.today.unitDays }).getByRole('button')
    await expect(columns).toHaveCount(7)
    await page.getByRole('main').getByRole('button', { name: new RegExp(`^\\d+ ${he.kit.fractionOf} \\d+ ${he.today.onBase}$`) }).click()
    const unit = page.getByRole('dialog')
    await expect(unit.getByRole('heading', { name: new RegExp(`^${he.presence.present}`) })).toBeVisible()
    await expect(unit).toContainText(YAEL_NAME)
    await expectNoAxeViolations(page)
    const grow = unit.getByRole('button', { name: he.kit.drawerGrow })
    if (await grow.isVisible()) {
      await grow.click()
      await expect(unit.getByRole('button', { name: he.kit.drawerShrink })).toHaveAttribute('aria-expanded', 'true')
    }
    await unit.getByRole('button', { name: he.common.close }).click()
    await expect(unit).toHaveCount(0)
  })

  await test.step('a day column opens the board on its day, the day\'s drawer at its middle stop (D-480)', async () => {
    const columns = page.getByRole('list', { name: he.today.unitDays }).getByRole('button')
    await columns.nth(1).click()
    await expect(tab(page, 'board')).toHaveAttribute('aria-current', 'page')
    await expect(page).toHaveURL(/day=/)
    if ((await page.getByRole('region', { name: he.engines.calendarLabel }).count()) > 0) {
      await expect(page.getByRole('button', { name: he.board.sheetGrow })).toHaveAttribute('aria-expanded', 'true')
    }
    await expectNoAxeViolations(page)
    await openTab(page, 'today')
  })

  await test.step('the tab in sight returns to the top, and the board keeps its place behind its tab', async () => {
    await openTab(page, 'board')
    await openTab(page, 'today')
    await expect(page.getByRole('list', { name: he.today.unitDays })).toBeVisible()
  })
})
