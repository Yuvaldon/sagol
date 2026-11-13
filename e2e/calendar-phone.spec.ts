import { expect, test } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, closeDrawer, createType, openRotationInNewUnit, requestLeave, typeDate } from './support/leaves.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations } from './support/workspace.ts'
import { selectView } from './support/board.ts'

// The phone's calendar is a month grid, as on a desktop: seven columns, no sideways scroll at 360 pixels, a day's tap
// opens its day report, and the range picker holds another range from and to (D-339). RTL, with axe. Tests only.

const NARROW = { width: 360, height: 760 }

test('a phone: the calendar is a grid, a day opens its report, another range from and to', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the phone grid')
  await page.setViewportSize(NARROW)
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)
  await openRotationInNewUnit(page, [OWNER.name])

  await test.step('an approved leave', async () => {
    await page.goto('/?panel=leave_types')
    await createType(page, { name: 'רגילה', color: he.palette.teal })
    await closeDrawer(page)
    await requestLeave(page, { type: 'רגילה', from: ['12', '11', '2026'], to: ['13', '11', '2026'], approveNow: true })
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  await test.step('seven columns and no sideways scroll', async () => {
    await selectView(page, he.workspace.views.calendar)
    const calendar = page.getByRole('region', { name: he.engines.calendarLabel })
    await expect(calendar).toBeVisible()
    const columns = await calendar.locator('ol').first().evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length)
    expect(columns).toBe(7)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await expectNoAxeViolations(page)
  })

  await test.step('a tap on a day opens its report', async () => {
    await page.getByRole('button', { name: new RegExp(`^${he.presence.openDay}.*13 בנובמבר 2026`) }).click()
    await expect(page).toHaveURL(/day=2026-11-13/)
    const report = page.getByRole('dialog', { name: he.presence.title })
    await expect(report.getByText('יום שישי, 13 בנובמבר 2026')).toBeVisible()
    await expect(report).toContainText(OWNER.name)
    await expectNoAxeViolations(page)
    await page.keyboard.press('Escape')
    await expect(report).toBeHidden()
  })

  await test.step('another range, from and to', async () => {
    await page.getByRole('button', { name: new RegExp(he.workspace.window) }).click()
    await page.getByRole('menuitemradio', { name: he.workspace.customRange }).click()
    const dialog = page.getByRole('dialog', { name: he.workspace.customTitle })
    await expect(dialog).toBeVisible()
    await typeDate(page, he.workspace.customFrom, '01', '11', '2026')
    await typeDate(page, he.workspace.customTo, '20', '11', '2026')
    await expectNoAxeViolations(page)
    await dialog.getByRole('button', { name: he.workspace.customShow }).click()
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/from=2026-11-01/)
    await expect(page).toHaveURL(/to=2026-11-20/)
  })
})
