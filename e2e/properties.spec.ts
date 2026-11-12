import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, board, closeDrawer, drawer, openRotationInNewUnit } from './support/leaves.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations, openModule } from './support/workspace.ts'

// V14's demo: custom properties (D-016), their fields in a soldier's form, and their chips in the filter bar (D-177),
// on desktop and mobile, RTL, with axe. Sample data, tests only.

function filterBar(page: Page) {
  return page.getByRole('search', { name: he.filters.bar })
}

function rowNames(page: Page) {
  return board(page).getByRole('list', { name: he.timeline.names }).getByRole('button', { name: /^[^,]+$/ })
}

async function choose(page: Page, label: string, option: string) {
  await drawer(page).getByRole('button', { name: new RegExp(`${label}$`) }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

async function createProperty(page: Page, label: string, dataType: string, options: readonly string[] = []) {
  await drawer(page).getByRole('button', { name: he.properties.new }).first().click()
  await drawer(page).getByLabel(he.properties.label).fill(label)
  await choose(page, he.properties.dataType, dataType)
  for (const [index, option] of options.entries()) {
    await drawer(page).getByRole('button', { name: he.properties.addOption }).click()
    await drawer(page).getByLabel(he.properties.optionLabel).nth(index).fill(option)
  }
  await drawer(page).getByRole('button', { name: he.common.create }).click()
  await expect(drawer(page).getByRole('list', { name: he.properties.entityTypes.soldier })).toContainText(label)
}

async function createSoldier(page: Page, firstName: string, lastName: string, fill: (page: Page) => Promise<void>) {
  await drawer(page).getByRole('button', { name: he.soldiers.new }).first().click()
  await page.getByLabel(he.soldiers.firstName).fill(firstName)
  await page.getByLabel(he.soldiers.lastName).fill(lastName)
  await fill(page)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(drawer(page).getByRole('list', { name: he.soldiers.listLabel }).getByText(`${firstName} ${lastName}`)).toBeVisible()
}

async function addCondition(page: Page, condition: string, value: string) {
  await page.getByRole('button', { name: he.filters.add, exact: true }).click()
  await page.getByRole('dialog', { name: he.filters.add }).getByRole('button', { name: condition, exact: true }).click()
  await page.getByRole('dialog', { name: he.filters.add }).locator('label').filter({ hasText: value }).click()
  await page.keyboard.press('Escape')
}

test('custom properties: defined once, filled in a form, and filtered by', async ({ page }) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)

  await test.step('properties of soldiers in their own drawer', async () => {
    await openModule(page, he.properties.open)
    await expect(drawer(page).getByRole('heading', { name: he.properties.emptyTitle })).toBeVisible()
    await createProperty(page, 'סוג דם', he.properties.dataTypes.select, ['A', 'O'])
    await createProperty(page, 'רישיון נהיגה', he.properties.dataTypes.boolean)
    await expectNoAxeViolations(page)
    await closeDrawer(page)
  })

  await test.step("a soldier's form holds the properties' fields", async () => {
    await openModule(page, he.soldiers.open)
    await createSoldier(page, 'יעל', 'שחר', async () => {
      await choose(page, 'סוג דם', 'A')
      await choose(page, 'רישיון נהיגה', he.properties.yes)
    })
    await createSoldier(page, 'נועם', 'לב', async () => {
      await choose(page, 'סוג דם', 'O')
    })
    await drawer(page).getByRole('list', { name: he.soldiers.listLabel }).getByRole('button', { name: /יעל שחר/ }).click()
    await expect(drawer(page).getByRole('button', { name: /סוג דם$/ })).toContainText('A')
    await expectNoAxeViolations(page)
    await closeDrawer(page)
  })

  await test.step('a rotation they serve in, so the board and its filters are there (D-218)', async () => {
    await openRotationInNewUnit(page, [OWNER.name, 'יעל שחר', 'נועם לב'])
  })

  await test.step('a property chip keeps who holds the answer', async () => {
    await addCondition(page, 'סוג דם', 'O')
    await expect(rowNames(page)).toHaveText(['נועם לב'])
    await filterBar(page).getByRole('button', { name: `${he.filters.remove} סוג דם` }).click()
    await addCondition(page, 'רישיון נהיגה', he.properties.yes)
    await expect(rowNames(page)).toHaveText(['יעל שחר'])
    await expect(page).toHaveURL(/filter=/)
    await expectNoAxeViolations(page)
    await page.reload()
    await expect(rowNames(page)).toHaveText(['יעל שחר'])
  })
})
