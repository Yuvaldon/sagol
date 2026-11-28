import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, ROTATION, closeDrawer, createType, drawer, openRotationInNewUnit, requestLeave } from './support/leaves.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations, openModule, openMePage } from './support/workspace.ts'

// The 1.0 dashboards' demo: the command board opens from a rotation's row on that rotation, counts it under a
// template, takes the actor's own list of modules and keeps it, and "הסבב שלי" sums the actor's rotation at the top of
// "שלי" (D-349, D-350). On desktop and mobile, RTL, with axe. Sample data, tests only.

/** 19:00 in Jerusalem on NOW's day: past the cut-over hour (D-443), and tomorrow is in the rotation. */
const EVENING = '2026-11-11T17:00:00Z'

function card(page: Page, title: string) {
  return drawer(page).getByRole('region', { name: title, exact: true })
}

function templates(page: Page) {
  return drawer(page).getByRole('radiogroup', { name: he.dashboard.template })
}

test('the command board and "הסבב שלי"', async ({ page }) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)
  await openRotationInNewUnit(page, [OWNER.name])

  await test.step('an approved leave in the rotation', async () => {
    await page.goto('/?panel=leave_types')
    await createType(page, { name: 'רגילה', color: he.palette.teal })
    await closeDrawer(page)
    await requestLeave(page, { type: 'רגילה', from: ['12', '11', '2026'], to: ['13', '11', '2026'], approveNow: true })
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  await test.step('a rotation\'s row opens the board on that rotation', async () => {
    await openModule(page, he.deployments.open)
    const row = drawer(page).getByRole('list', { name: he.deployments.listLabel }).getByRole('listitem').filter({ hasText: ROTATION.name })
    await row.getByRole('button', { name: he.common.actions }).click()
    await page.getByRole('menuitem', { name: he.dashboard.open }).click()
    await expect(page).toHaveURL(/panel=dashboard/)
    await expect(page).toHaveURL(/range=rotation/)
    await expect(drawer(page)).toContainText(ROTATION.name)
    await expect(templates(page).getByRole('radio', { name: he.dashboard.templateLeaves })).toBeChecked()
    await expect(card(page, he.dashboard.metricPresentToday)).toBeVisible()
    await expect(card(page, he.dashboard.moduleHeatMap)).toBeVisible()
    await expectNoAxeViolations(page)
  })

  await test.step('another template, then the actor\'s own list', async () => {
    await templates(page).getByRole('radio', { name: he.dashboard.templateReport }).click()
    await expect(card(page, he.dashboard.moduleReportStatus)).toBeVisible()
    await expect(card(page, he.dashboard.moduleHeatMap)).toHaveCount(0)
    await drawer(page).getByRole('button', { name: he.dashboard.edit }).click()
    await card(page, he.dashboard.metricHomeToday).getByRole('button', { name: he.dashboard.remove }).click()
    await expect(card(page, he.dashboard.metricHomeToday)).toHaveCount(0)
    await drawer(page).getByRole('button', { name: he.dashboard.add }).click()
    await page.getByRole('menuitem', { name: he.dashboard.moduleHeatMap }).click()
    await expect(card(page, he.dashboard.moduleHeatMap)).toBeVisible()
    await card(page, he.dashboard.moduleHeatMap).getByRole('button', { name: he.dashboard.moveUp }).click()
    await expect(templates(page).getByRole('radio', { name: he.dashboard.templateCustom })).toBeChecked()
    await expectNoAxeViolations(page)
    await drawer(page).getByRole('button', { name: he.dashboard.done }).click()
  })

  await test.step('the list is kept, and a template asks before it drops it', async () => {
    await page.reload()
    await expect(card(page, he.dashboard.moduleHeatMap)).toBeVisible()
    await expect(card(page, he.dashboard.metricHomeToday)).toHaveCount(0)
    await templates(page).getByRole('radio', { name: he.dashboard.templateLeaves }).click()
    const confirm = page.getByRole('alertdialog', { name: he.dashboard.leaveCustom })
    await confirm.getByRole('button', { name: he.dashboard.leaveCustomConfirm }).click()
    await expect(templates(page).getByRole('radio', { name: he.dashboard.templateLeaves })).toBeChecked()
    await expect(card(page, he.dashboard.metricHomeToday)).toBeVisible()
    await closeDrawer(page)
  })

  await test.step('after the cut-over hour, "סטטוס דוח 1" shows tomorrow\'s report too (D-443)', async () => {
    const report = () => card(page, he.dashboard.moduleReportStatus).getByRole('button', { name: new RegExp(`^${he.presence.openDay}`) })
    await openModule(page, he.dashboard.open)
    await templates(page).getByRole('radio', { name: he.dashboard.templateReport }).click()
    await expect(report()).toHaveCount(1)
    await page.clock.setFixedTime(EVENING)
    await page.reload()
    await expect(report()).toHaveCount(2)
    await expectNoAxeViolations(page)
    await page.clock.setFixedTime(NOW)
    await page.reload()
    await expect(report()).toHaveCount(1)
    await closeDrawer(page)
  })

  await test.step('"הסבב שלי" of "אני" sums the rotation (D-488)', async () => {
    await openMePage(page, 'rotation')
    await expect(page.getByRole('main')).toContainText(ROTATION.name)
    const summary = page.getByRole('main').getByRole('definition').first()
    await expect(summary).toBeVisible()
    await expect(page.getByRole('main')).toContainText(he.myRotation.baseDays)
    await expect(page.getByRole('main')).toContainText(he.myRotation.homeDays)
    await expect(page.getByRole('main')).toContainText(he.me.approvedRequests)
    await expectNoAxeViolations(page)
  })
})
