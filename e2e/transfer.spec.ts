import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, closeDrawer, drawer } from './support/leaves.ts'
import { enterAsOwner, expectNoAxeViolations, openModule } from './support/workspace.ts'

// V12's demo: the owner imports soldiers from a CSV through the dry-run preview, sees a bad file refused with its
// reason, and downloads the organization's export (D-171). On desktop and mobile, RTL, with axe. Sample data, tests
// only.

const GOOD_CSV = 'first_name,last_name,personal_id\nנועה,ברק,7001001\nעמית,גל,7001002\n'
const BAD_CSV = 'first_name,last_name,rank\nנועה,ברק,סמל\n'

async function openTransfer(page: Page) {
  await page.getByRole('button', { name: he.account.menu }).click()
  await page.getByRole('menuitem', { name: he.transfer.open }).click()
  await expect(drawer(page).getByRole('heading', { name: he.transfer.importTitle, exact: true })).toBeVisible()
}

async function pick(page: Page, name: string, text: string) {
  await drawer(page)
    .locator('input[type=file]')
    .setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(text) })
}

test('the owner imports soldiers from a CSV and downloads the export', async ({ page }) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)
  await openTransfer(page)
  await expectNoAxeViolations(page)

  await test.step('a file with an unknown column is refused with its reason', async () => {
    await pick(page, 'bad.csv', BAD_CSV)
    await expect(drawer(page).getByRole('alert')).toContainText(he.transfer.problemUnknownColumn)
    await expect(drawer(page).getByRole('button', { name: he.transfer.import, exact: true })).toBeHidden()
  })

  await test.step('a good file is checked first, then imported', async () => {
    await pick(page, 'team.csv', GOOD_CSV)
    await expect(drawer(page).getByText(`${he.transfer.readyCount} 2`)).toBeVisible()
    await expectNoAxeViolations(page)
    await drawer(page).getByRole('button', { name: he.transfer.import, exact: true }).click()
    await expect(drawer(page).getByText(`${he.transfer.importedCount} 2`)).toBeVisible()
    await closeDrawer(page)
    await openModule(page, he.soldiers.open)
    const list = page.getByRole('list', { name: he.soldiers.listLabel })
    await expect(list.getByText('נועה ברק')).toBeVisible()
    await expect(list.getByText('עמית גל')).toBeVisible()
    await closeDrawer(page)
  })

  await test.step('the same file again is refused: its personal numbers are taken', async () => {
    await openTransfer(page)
    await pick(page, 'team.csv', GOOD_CSV)
    await expect(drawer(page).getByRole('list', { name: he.transfer.refusedLabel })).toBeVisible()
  })

  await test.step('the export downloads as a dated JSON file', async () => {
    const download = page.waitForEvent('download')
    await drawer(page).getByRole('button', { name: he.transfer.export }).click()
    expect((await download).suggestedFilename()).toBe(`sagol-export-${NOW.toISOString().slice(0, 10)}.json`)
  })
})
