import { expect, test } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, closeDrawer, createType, drawer, openRotationInNewUnit, requestLeave } from './support/leaves.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations, openTab } from './support/workspace.ts'

// The phone's calendar (the handoff's board spec, §3; D-480): the board opens on it; a month of seven columns, no
// sideways scroll at 360 pixels; a tap selects a day and a second opens its drawer to the middle; a held day starts a
// range, and "בחירת טווח" does the same by tap (D-458), the tray then opening a new leave on those days, which the back
// button closes first (D-337); the arrows by the title move the month. RTL, with axe. Tests only.

const NARROW = { width: 360, height: 760 }

test('a phone: the calendar, its selected day and drawer, and a range for a new leave', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the phone calendar')
  await page.setViewportSize(NARROW)
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)
  await openRotationInNewUnit(page, [OWNER.name])
  const calendar = page.getByRole('region', { name: he.engines.calendarLabel })
  const day = (date: string) => calendar.getByRole('button', { name: new RegExp(date) })

  await test.step('an approved leave', async () => {
    await page.goto('/?panel=leave_types')
    await createType(page, { name: 'רגילה', color: he.palette.teal })
    await closeDrawer(page)
    await requestLeave(page, { type: 'רגילה', from: ['12', '11', '2026'], to: ['13', '11', '2026'], approveNow: true })
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  await test.step('the board opens on the month: seven columns and no sideways scroll', async () => {
    await openTab(page, 'board')
    await expect(calendar).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'נובמבר' })).toBeVisible()
    await expect(day('12 בנובמבר 2026')).toContainText('דנה')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await expectNoAxeViolations(page)
  })

  await test.step('a tap selects a day; a second opens its drawer to the middle, with its leave', async () => {
    await day('13 בנובמבר 2026').click()
    await expect(page).toHaveURL(/day=2026-11-13/)
    await expect(day('13 בנובמבר 2026')).toHaveAttribute('aria-pressed', 'true')
    await day('13 בנובמבר 2026').click()
    await expect(page.getByRole('button', { name: he.board.sheetGrow })).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('button', { name: new RegExp(`^${OWNER.name} · רגילה · ${he.board.returningToday}`) })).toBeVisible()
    await expectNoAxeViolations(page)
    // "היום" brings the board back to today.
    await page.getByRole('button', { name: he.workspace.today, exact: true }).click()
    await expect(page).not.toHaveURL(/day=/)
  })

  await test.step('a held day starts a range; a second day ends it, and the tray opens a new leave on them', async () => {
    const box = await day('17 בנובמבר 2026').boundingBox()
    if (box === null) throw new Error('no day')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(700)
    await page.mouse.up()
    await day('18 בנובמבר 2026').click()
    const tray = page.getByRole('group', { name: he.board.rangeTray })
    const action = tray.getByRole('button', { name: `${he.board.leaveForSoldiers} · 2 ${he.leaves.days}` })
    await expect(action).toBeVisible()
    await expectNoAxeViolations(page)
    await action.click()
    await expect(drawer(page).getByRole('heading', { name: he.leaves.newTitle })).toBeVisible()
    await expect(page).toHaveURL(/draft=/)
    await expect(drawer(page).getByRole('group', { name: he.leaves.from })).toContainText('17')
    await expect(drawer(page).getByRole('group', { name: he.leaves.to })).toContainText('18')
  })

  await test.step('the back button closes the form first and stays on the calendar (D-337)', async () => {
    await page.goBack()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).not.toHaveURL(/panel=/)
    await expect(calendar).toBeVisible()
  })

  await test.step('"בחירת טווח" starts a range without holding (D-458), and ✕ lets it go', async () => {
    await page.getByRole('button', { name: he.board.pickRange }).click()
    const tray = page.getByRole('group', { name: he.board.rangeTray })
    await expect(tray.getByRole('button', { name: `${he.board.leaveForSoldiers} · ${he.leaves.oneDay}` })).toBeVisible()
    await tray.getByRole('button', { name: he.board.clearSelection }).click()
    await expect(tray).toHaveCount(0)
  })

  await test.step('the arrows by the title move the month', async () => {
    await page.getByRole('button', { name: he.board.nextMonth }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'דצמבר' })).toBeVisible()
    await expect(page).toHaveURL(/day=2026-12-01/)
    await page.getByRole('button', { name: he.board.previousMonth }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'נובמבר' })).toBeVisible()
  })
})
