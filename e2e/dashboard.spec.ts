import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, ROTATION, closeDrawer, createType, drawer, openRotationInNewUnit, requestLeave } from './support/leaves.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations, openModule } from './support/workspace.ts'

// The 1.0 dashboards' demo: the command board opens from a rotation's row on that rotation, counts it under a
// template, takes the actor's own list of modules and keeps it, and "הסבב שלי" sums the actor's rotation at the top of
// "שלי" (D-349, D-350). On desktop and mobile, RTL, with axe. Sample data, tests only.

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

  await test.step('"הסבב שלי" sums the rotation at the top of "שלי"', async () => {
    await openModule(page, he.myLeaves.open)
    const mine = drawer(page).getByRole('region', { name: new RegExp(`^${he.myRotation.title}`) })
    await expect(mine).toContainText(ROTATION.name)
    await expect(mine).toContainText(he.myRotation.baseDays)
    await expect(mine).toContainText(he.myRotation.homeDays)
    await expect(mine).toContainText(he.myRotation.nextLeave)
    await expect(mine).toContainText(he.myRotation.untilEnd)
    await expectNoAxeViolations(page)
  })
})
