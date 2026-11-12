import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, closeDrawer, createType, drawer, leavesOf, press, typeDate } from './support/leaves.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations, openModule } from './support/workspace.ts'

// V15's demo: deployments and who serves in them (D-019), a collective leave and a copy of a leave (D-012, D-049),
// and a soldier's personal seniority (D-029), on desktop and mobile, RTL, with axe. Sample data, tests only.

async function createSoldier(page: Page, firstName: string, lastName: string) {
  await drawer(page).getByRole('button', { name: he.soldiers.new }).first().click()
  await page.getByLabel(he.soldiers.firstName).fill(firstName)
  await page.getByLabel(he.soldiers.lastName).fill(lastName)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(drawer(page).getByRole('list', { name: he.soldiers.listLabel }).getByText(`${firstName} ${lastName}`)).toBeVisible()
}

test('deployments, a collective leave, a copy and personal seniority', async ({ page }) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)

  await test.step('a unit, soldiers and a type to work with', async () => {
    await openModule(page, he.deployments.open)
    await expect(drawer(page).getByText(he.deployments.emptyNoUnits)).toBeVisible()
    await closeDrawer(page)
    await openModule(page, he.units.open)
    await drawer(page).getByRole('button', { name: he.units.new }).first().click()
    await page.getByLabel(he.units.name).fill('פלוגה ב')
    await page.getByRole('button', { name: he.common.create }).click()
    await expect(drawer(page).getByText('פלוגה ב', { exact: true })).toBeVisible()
    await closeDrawer(page)
    await openModule(page, he.soldiers.open)
    await createSoldier(page, 'יעל', 'שחר')
    await createSoldier(page, 'נועם', 'לב')
    await closeDrawer(page)
    await openModule(page, he.leaveTypes.open)
    await createType(page, { name: 'רגילה', color: he.palette.teal })
    await closeDrawer(page)
  })

  await test.step('a deployment, and who serves in it', async () => {
    await openModule(page, he.deployments.open)
    await expect(drawer(page).getByRole('heading', { name: he.deployments.emptyTitle })).toBeVisible()
    await expectNoAxeViolations(page)
    await drawer(page).getByRole('button', { name: he.deployments.new }).first().click()
    await page.getByLabel(he.deployments.name).fill('תעסוקה צפונית')
    await typeDate(page, he.deployments.from, '01', '11', '2026')
    await typeDate(page, he.deployments.to, '31', '12', '2026')
    await page.getByRole('button', { name: he.common.create }).click()
    // Creating it goes straight on to who serves (D-220).
    await expect(drawer(page).getByRole('heading', { name: he.deployments.membersTitle })).toBeVisible()
    await press(page, 'checkbox', 'יעל שחר')
    await press(page, 'checkbox', 'נועם לב')
    await press(page, 'checkbox', OWNER.name)
    await expect(drawer(page).getByText(he.deployments.memberDates, { exact: true })).toBeVisible()
    await expectNoAxeViolations(page)
    await drawer(page).getByRole('button', { name: he.common.save }).click()
    const list = drawer(page).getByRole('list', { name: he.deployments.listLabel })
    await expect(list).toContainText('תעסוקה צפונית')
    await expect(list).toContainText(he.deployments.active)
    await expect(list).toContainText(`${he.deployments.memberCount} 3`)
    await closeDrawer(page)
  })

  await test.step('a collective leave for several soldiers at once', async () => {
    await page.getByRole('button', { name: he.leaves.new }).click()
    await drawer(page).getByRole('button', { name: he.leaves.collective }).click()
    await expect(drawer(page).getByRole('heading', { name: he.leaves.batchTitle })).toBeVisible()
    await page.getByLabel(he.leaves.batchName).fill('שבת גיבוש')
    await press(page, 'checkbox', 'יעל שחר')
    await press(page, 'checkbox', 'נועם לב')
    await drawer(page).getByRole('button', { name: new RegExp(`${he.leaves.type}$`) }).click()
    await page.getByRole('option', { name: 'רגילה', exact: true }).click()
    await typeDate(page, he.leaves.from, '13', '11', '2026')
    await typeDate(page, he.leaves.to, '14', '11', '2026')
    await expectNoAxeViolations(page)
    await drawer(page).getByRole('button', { name: he.leaves.batchSubmit }).click()
    await expect(drawer(page)).toHaveCount(0)
    await expect(leavesOf(page)).toHaveCount(2)
  })

  await test.step('a leave copied to another soldier', async () => {
    await leavesOf(page).first().click()
    await drawer(page).getByRole('button', { name: he.leaves.duplicate }).click()
    await expect(drawer(page).getByRole('heading', { name: he.leaves.duplicateTitle })).toBeVisible()
    await press(page, 'checkbox', OWNER.name)
    await expectNoAxeViolations(page)
    await drawer(page).getByRole('button', { name: he.leaves.duplicateSubmit }).click()
    await expect(leavesOf(page)).toHaveCount(3)
    await closeDrawer(page)
  })

  await test.step("a soldier's personal seniority", async () => {
    await openModule(page, he.soldiers.open)
    await drawer(page).getByRole('list', { name: he.soldiers.listLabel }).getByRole('button', { name: /יעל שחר/ }).click()
    await expect(drawer(page).getByRole('heading', { name: he.seniority.title })).toBeVisible()
    await expect(drawer(page).getByText(he.seniority.none)).toBeVisible()
    await drawer(page).getByRole('button', { name: he.seniority.new }).click()
    await page.getByRole('textbox', { name: he.seniority.value, exact: true }).fill('7')
    await page.getByRole('dialog', { name: he.seniority.newTitle }).getByRole('button', { name: he.common.create }).click()
    const list = drawer(page).getByRole('list', { name: he.seniority.listLabel })
    await expect(list).toContainText(he.seniority.current)
    await expect(list).toContainText(he.seniority.permanent)
    await expectNoAxeViolations(page)
  })
})
