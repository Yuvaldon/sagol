import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, openRotationInNewUnit } from './support/leaves.ts'
import { openViewSheet, selectView, setOnlyMissing, viewSheet } from './support/board.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations } from './support/workspace.ts'

// Saved views (D-384..D-388): saved from the view sheet, applied by a card, marked current while the board matches,
// renamed, moved and deleted in "ניהול התצוגות", and the start view opens a bare link. Desktop and mobile, RTL, with
// axe. Sample data, tests only.

const views = he.workspace.savedViews

function card(page: Page, name: string) {
  return viewSheet(page).getByRole('radio', { name: new RegExp(`^${name}`) })
}

/** The card itself: the radio is a hidden input inside it. */
function cardLabel(page: Page, name: string) {
  return viewSheet(page).locator('label').filter({ has: page.getByRole('radio', { name: new RegExp(`^${name}`) }) })
}

async function saveCurrent(page: Page, name: string, start = false) {
  await openViewSheet(page)
  await viewSheet(page).getByRole('button', { name: views.save }).click()
  const dialog = page.getByRole('dialog', { name: views.newTitle })
  await expect(dialog.getByRole('textbox', { name: views.name })).not.toHaveValue('')
  await dialog.getByRole('textbox', { name: views.name }).fill(name)
  if (start) await dialog.locator('label').filter({ has: page.getByRole('switch', { name: views.openWith }) }).click()
  await dialog.getByRole('button', { name: he.common.save }).click()
  await expect(dialog).toBeHidden()
  await expect(card(page, name)).toBeChecked()
  await expect(viewSheet(page).getByRole('button', { name: views.save })).toHaveCount(0)
}

function manageList(page: Page) {
  return page.getByRole('list', { name: views.manage })
}

function row(page: Page, name: string) {
  return manageList(page).getByRole('listitem').filter({ hasText: name })
}

/** "Only who is missing" over the list: nobody is missing, so the list shows its empty state, and the table is gone. */
async function expectMissingList(page: Page) {
  await expect(page).toHaveURL(/missing=true/)
  await expect(page.getByRole('heading', { name: he.timeline.emptyMissingTitle })).toBeVisible()
  await expect(page.getByRole('region', { name: he.engines.tableLabel })).toHaveCount(0)
}

test('saved views: save, apply, manage, and the start view', async ({ page }) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)
  await openRotationInNewUnit(page, [OWNER.name])

  await test.step('nothing of saved views shows until one is saved', async () => {
    await openViewSheet(page)
    await expect(viewSheet(page).getByText(views.mine)).toHaveCount(0)
    await expect(viewSheet(page).getByRole('button', { name: views.save })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(viewSheet(page)).toBeHidden()
  })

  await test.step('the list with only who is missing, saved as the start view', async () => {
    await selectView(page, he.workspace.views.list)
    await setOnlyMissing(page)
    await expect(page).toHaveURL(/missing=true/)
    await saveCurrent(page, 'חסרים', true)
    await expect(cardLabel(page, 'חסרים')).toContainText(views.startMark)
    await expect(cardLabel(page, 'חסרים')).toContainText(views.oneCondition)
    await expectNoAxeViolations(page)
    await page.keyboard.press('Escape')
  })

  await test.step('another board matches no card, and a card brings its view back', async () => {
    await selectView(page, he.workspace.views.table)
    await openViewSheet(page)
    await expect(card(page, 'חסרים')).not.toBeChecked()
    await cardLabel(page, 'חסרים').click()
    await expect(viewSheet(page)).toBeHidden()
    await expectMissingList(page)
  })

  await test.step('a second view, then rename, move and delete', async () => {
    await selectView(page, he.workspace.views.table)
    await saveCurrent(page, 'יחידה')
    await viewSheet(page).getByRole('button', { name: views.manage }).click()
    await expect(manageList(page).getByRole('listitem')).toHaveCount(2)
    await expectNoAxeViolations(page)

    await row(page, 'יחידה').getByRole('button', { name: views.rename }).click()
    await manageList(page).getByRole('textbox', { name: views.name }).fill('חסרים')
    await manageList(page).getByRole('button', { name: he.common.save }).click()
    await expect(page.getByText(views.duplicateName)).toBeVisible()
    await manageList(page).getByRole('textbox', { name: views.name }).fill('כל הטבלה')
    await manageList(page).getByRole('button', { name: he.common.save }).click()
    await expect(row(page, 'כל הטבלה')).toBeVisible()

    await row(page, 'כל הטבלה').getByRole('button', { name: he.common.stepUp }).click()
    await expect(manageList(page).getByRole('listitem').first()).toContainText('כל הטבלה')
    await row(page, 'כל הטבלה').getByRole('button', { name: he.common.stepDown }).click()
    await expect(manageList(page).getByRole('listitem').first()).toContainText('חסרים')

    await row(page, 'כל הטבלה').getByRole('button', { name: views.delete }).click()
    const confirm = page.getByRole('alertdialog', { name: views.deleteTitle })
    await confirm.getByRole('button', { name: views.delete }).click()
    await expect(confirm).toBeHidden()
    await expect(manageList(page).getByRole('listitem')).toHaveCount(1)
    await page.getByRole('button', { name: views.manageBack }).click()
    await expect(card(page, 'חסרים')).toBeVisible()
    await page.keyboard.press('Escape')
  })

  await test.step('a bare link opens on the start view, and keeps it after a reload', async () => {
    await page.goto('/')
    await expectMissingList(page)
    await page.reload()
    await expectMissingList(page)
  })
})
