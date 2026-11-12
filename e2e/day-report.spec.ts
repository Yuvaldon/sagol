import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import {
  NOW,
  ROTATION_UNIT,
  choose,
  closeDrawer,
  createType,
  drawer,
  openRotation,
  openRotationInNewUnit,
  requestLeave,
  typeDate,
} from './support/leaves.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations, openBoardOnTimeline, openModule } from './support/workspace.ts'

// V22's demo: the day report opens from a day of the timeline and of the calendar, holds the counts and the names per
// unit, shows the reasons behind a switch kept on the device, spans days, and leaves as text and as an image, on
// desktop and mobile, RTL, with axe (D-193 … D-197). Sample data, tests only.

function report(page: Page) {
  return page.getByRole('dialog', { name: he.presence.title })
}

/** A day's control on the board: "the day report of", then what the day shows, then its whole date. */
function dayControl(page: Page, date: string) {
  return page.getByRole('button', { name: new RegExp(`^${he.presence.openDay}.*${date}`) })
}

async function openUnits(page: Page) {
  const closed = report(page).getByRole('heading').getByRole('button', { expanded: false })
  await expect(closed.first()).toBeVisible()
  while ((await closed.count()) > 0) await closed.first().click()
}

async function selectView(page: Page, name: string) {
  await page.getByRole('button', { name: new RegExp(he.workspace.view) }).click()
  await page.getByRole('menuitemradio', { name }).click()
}

// The steps read the timeline's bars, which a phone opens only when asked (D-290).
test.beforeEach(async ({ page, isMobile }) => {
  await openBoardOnTimeline(page, isMobile)
})

test('the day report: counts and names, reasons, a span, a text copy and an image', async ({ page, context }, testInfo) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)
  await openRotationInNewUnit(page, [OWNER.name])

  await test.step('a leave with a reason, from Thursday 12 November', async () => {
    await page.goto('/?panel=leave_types')
    await createType(page, { name: 'רגילה', color: he.palette.teal })
    await closeDrawer(page)
    await requestLeave(page, { type: 'רגילה', from: ['12', '11', '2026'], to: ['13', '11', '2026'], reason: 'חתונה', approveNow: true })
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  await test.step('a day of the timeline opens its report', async () => {
    await dayControl(page, '12 בנוב').click()
    await expect(page).toHaveURL(/day=2026-11-12/)
    await expect(report(page).getByText('יום חמישי, 12 בנובמבר 2026')).toBeVisible()
    await openUnits(page)
    await expect(report(page).getByRole('heading', { name: `${he.presence.leaving} 1`, exact: true })).toBeVisible()
    await expect(report(page)).toContainText(OWNER.name)
    await expect(report(page)).not.toContainText('חתונה')
    await expectNoAxeViolations(page)
  })

  await test.step('the reasons show behind the switch, and stay on the device', async () => {
    await report(page).locator('label').filter({ has: page.getByRole('switch', { name: he.presence.reasons }) }).click()
    await expect(report(page)).toContainText('חתונה')
    await page.reload()
    await openUnits(page)
    await expect(report(page)).toContainText('חתונה')
    await testInfo.attach('day-report', { body: await page.screenshot(), contentType: 'image/png' })
  })

  await test.step('the text copy, right to left, with the reasons', async () => {
    await report(page).getByRole('button', { name: he.presence.copy }).click()
    await expect(report(page).getByRole('status')).toHaveText(he.presence.copied)
    const text = await page.evaluate(() => navigator.clipboard.readText())
    expect(text.split('\n').every((line) => line.startsWith('‏'))).toBe(true)
    expect(text).toContain(OWNER.name)
    expect(text).toContain('חתונה')
  })

  await test.step('the image, downloaded where the device cannot share a file', async () => {
    const download = page.waitForEvent('download')
    await report(page).getByRole('button', { name: he.presence.download }).click()
    expect((await download).suggestedFilename()).toBe('sagol-day-report-2026-11-12.png')
  })

  await test.step('a span of days, one block per day', async () => {
    await report(page).getByRole('button', { name: he.presence.span }).click()
    await report(page).getByRole('group', { name: he.presence.until }).getByRole('spinbutton').first().click()
    await page.keyboard.type('14112026')
    await expect(page).toHaveURL(/until=2026-11-14/)
    await expect(report(page).getByRole('heading', { level: 3 })).toHaveCount(3)
    await expectNoAxeViolations(page)
    await report(page).getByRole('button', { name: he.presence.oneDay }).click()
    await expect(page).not.toHaveURL(/until=/)
    await report(page).getByRole('button', { name: he.common.close }).click()
    await expect(report(page)).toBeHidden()
  })

  await test.step('a day of the calendar opens its report', async () => {
    await selectView(page, he.workspace.views.calendar)
    await dayControl(page, '13 בנוב').click()
    await expect(page).toHaveURL(/day=2026-11-13/)
    await expect(report(page).getByText('יום שישי, 13 בנובמבר 2026')).toBeVisible()
    await expectNoAxeViolations(page)
    await page.keyboard.press('Escape')
    await expect(report(page)).toBeHidden()
  })
})

const SOLDIER = 'יעל שחר'

/** A unit with one soldier placed in it, and the rotation over it: a unit section the report can confirm. */
async function soldierInRotation(page: Page) {
  await openModule(page, he.units.open)
  await drawer(page).getByRole('button', { name: he.units.new }).first().click()
  await page.getByLabel(he.units.name).fill(ROTATION_UNIT)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(drawer(page).getByText(ROTATION_UNIT, { exact: true })).toBeVisible()
  await closeDrawer(page)
  await openModule(page, he.soldiers.open)
  await drawer(page).getByRole('button', { name: he.soldiers.new }).first().click()
  await page.getByLabel(he.soldiers.firstName).fill('יעל')
  await page.getByLabel(he.soldiers.lastName).fill('שחר')
  await choose(page, he.soldiers.unit, ROTATION_UNIT)
  await typeDate(page, he.soldiers.placedFrom, '01', '01', '2026')
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(drawer(page).getByRole('list', { name: he.soldiers.listLabel }).getByText(SOLDIER)).toBeVisible()
  await closeDrawer(page)
  await openRotation(page, [SOLDIER])
}

test('each unit confirms its report, a change shows, and it confirms again (D-293)', async ({ page }) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)
  await soldierInRotation(page)
  await openModule(page, he.leaveTypes.open)
  await createType(page, { name: 'רגילה', color: he.palette.teal })
  await closeDrawer(page)
  const leave = { type: 'רגילה', soldier: ['יעל', SOLDIER] } as const
  await requestLeave(page, { ...leave, from: ['12', '11', '2026'], to: ['12', '11', '2026'], approveNow: true })
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await test.step('the unit is not yet confirmed, and confirms', async () => {
    await dayControl(page, '12 בנוב').click()
    await expect(report(page).getByText(he.presence.statusNotYet, { exact: true })).toBeVisible()
    await expect(report(page).getByText(he.presence.summaryConfirmed)).toBeVisible()
    await expectNoAxeViolations(page)
    await report(page).getByRole('button', { name: he.presence.confirm }).click()
    await expect(report(page).getByText(he.presence.statusConfirmed, { exact: true })).toBeVisible()
    await expect(report(page).getByRole('button', { name: he.presence.confirm })).toHaveCount(0)
    await report(page).getByRole('button', { name: he.common.close }).click()
    await expect(report(page)).toBeHidden()
  })

  await test.step('a request for the next day changes it, and it confirms again', async () => {
    await page.clock.setFixedTime(NOW.getTime() + 60_000)
    await requestLeave(page, { ...leave, from: ['13', '11', '2026'], to: ['13', '11', '2026'] })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await dayControl(page, '12 בנוב').click()
    await expect(report(page).getByText(he.presence.statusChanged, { exact: true })).toBeVisible()
    await expect(report(page).getByText(he.presence.summaryChanged)).toBeVisible()
    await expectNoAxeViolations(page)
    await report(page).getByRole('button', { name: he.presence.confirmAgain }).click()
    await expect(report(page).getByText(he.presence.statusConfirmed, { exact: true })).toBeVisible()
  })
})
