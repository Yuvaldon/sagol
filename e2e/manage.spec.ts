import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { createRule } from './support/rules.ts'
import { closeDrawers, openSoldierCard, openSoldiers, soldierRow, soldierRows, soldiersHeading } from './support/soldiers.ts'
import { OWNER, addUnit, enterAsOwner, expectNoAxeViolations, openModule, openTab, tab } from './support/workspace.ts'

// "ניהול" of the new interface (D-482): its rows, "חיילים" with the person card and the multi-select, "הוספת חיילים",
// and "כללי נוכחות" with its archive. On desktop and mobile, RTL, with axe. Sample data, tests only.

const PASTED = ['שם פרטי\tשם משפחה\tמספר אישי', 'נועם\tבר\t8000001', 'יעל\tשחר\t8000002'].join('\n')

function main(page: Page) {
  return page.getByRole('main')
}

/** The rows of "הוספת חיילים" that hold a typed name, in order. */
async function addSoldiers(page: Page, rows: readonly (readonly [string, string])[]) {
  await openSoldiers(page)
  await page.getByRole('button', { name: he.manage.pages.addSoldiers, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: he.manage.pages.addSoldiers })).toBeVisible()
  for (const [index, [first, last]] of rows.entries()) {
    await main(page).getByLabel(he.soldiers.firstName).nth(index).fill(first)
    await main(page).getByLabel(he.soldiers.lastName).nth(index).fill(last)
  }
  await page.getByRole('button', { name: `${he.manage.add.submitCount} ${String(rows.length)} ${he.manage.add.submitSoldiers}` }).click()
  await expect(page.getByRole('status').filter({ hasText: `${String(rows.length)} ${he.manage.add.added}` })).toBeVisible()
  await page.getByRole('button', { name: he.common.close, exact: true }).click()
  await expect(soldiersHeading(page)).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await enterAsOwner(page)
})

test('"ניהול" opens "חיילים", where soldiers are added, found, sorted and opened on their card', async ({ page }) => {
  await test.step('the index lists the designed tools first, then what keeps its screens', async () => {
    await openTab(page, 'manage')
    await expect(main(page).getByRole('button', { name: he.soldiers.open, exact: true })).toHaveAccessibleDescription('1')
    await expect(main(page).getByRole('button', { name: he.rules.open, exact: true })).toHaveAccessibleDescription(`0 ${he.manage.rules.active}`)
    await expectNoAxeViolations(page)
  })

  await test.step('"הוספת חיילים": a full screen with no tab bar, rows typed and pasted, each checked as it is typed', async () => {
    await openSoldiers(page)
    await expect(soldierRow(page, OWNER.name)).toBeVisible()
    await page.getByRole('button', { name: he.manage.pages.addSoldiers, exact: true }).click()
    await expect(tab(page, 'manage')).toHaveCount(0)
    await expectNoAxeViolations(page)
    await main(page).getByLabel(he.soldiers.firstName).first().fill('אורי')
    // A row with a first name and no last one is not ready.
    await expect(page.getByRole('button', { name: he.manage.add.submit, exact: true })).toBeDisabled()
    await main(page).getByLabel(he.soldiers.lastName).first().fill('כהן')
    await main(page).getByRole('button', { name: he.manage.add.paste }).click()
    await main(page).getByRole('textbox', { name: he.soldiers.quick.paste }).fill(PASTED)
    await main(page).getByRole('button', { name: he.soldiers.quick.pasteAdd }).click()
    await expect(main(page).getByLabel(he.soldiers.personalId).nth(1)).toHaveValue('8000001')
    await page.getByRole('button', { name: `${he.manage.add.submitCount} 3 ${he.manage.add.submitSoldiers}` }).click()
    await expect(page.getByRole('status').filter({ hasText: `3 ${he.manage.add.added}` })).toBeVisible()
    await page.getByRole('button', { name: he.common.close, exact: true }).click()
    await expect(soldiersHeading(page)).toBeVisible()
    await expect(tab(page, 'manage')).toBeVisible()
  })

  await test.step('the list: rows with their days, the search, and the options as one menu', async () => {
    await expect(soldierRows(page)).toHaveCount(4)
    await expect(main(page).getByText(`4 ${he.manage.people.count}`)).toBeVisible()
    await expectNoAxeViolations(page)
    await page.getByRole('button', { name: he.manage.people.search, exact: true }).click()
    await page.getByLabel(he.manage.people.searchLabel).fill('שחר')
    await expect(soldierRows(page)).toHaveCount(1)
    await page.getByLabel(he.manage.people.searchLabel).fill('אין כזה')
    await expect(page.getByText(he.manage.people.noResults)).toBeVisible()
    await page.getByRole('button', { name: he.manage.people.search, exact: true }).click()
    await expect(soldierRows(page)).toHaveCount(4)

    await page.getByRole('button', { name: he.manage.people.options }).click()
    await page.getByRole('button', { name: new RegExp(`^${he.manage.people.sort}`) }).click()
    // A choice hides its radio inside its label, and a person presses the label.
    const menu = page.getByRole('dialog', { name: he.manage.people.options })
    await menu.locator('label').filter({ has: page.getByRole('radio', { name: he.manage.people.sortName, exact: true }) }).click()
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/people=/)
    // By name: the last name, then the first (D-094).
    const names = await soldierRows(page).allInnerTexts()
    expect(names.map((name) => name.split('\n')[0])).toEqual(['נועם בר', 'אורי כהן', 'דנה לוי', 'יעל שחר'])
  })

  await test.step('the person card: the soldier, their personal number, their days, and the full card', async () => {
    const card = await openSoldierCard(page, 'נועם בר')
    await expect(card.getByText('8000001')).toBeVisible()
    await expect(card.getByRole('list', { name: he.myLeaves.nextDaysTitle }).getByRole('listitem')).toHaveCount(14)
    // Its days are chosen there, each a 44 px target.
    const day = await card.getByRole('list', { name: he.myLeaves.nextDaysTitle }).getByRole('button').first().boundingBox()
    expect(Math.min(day?.width ?? 0, day?.height ?? 0)).toBeGreaterThanOrEqual(44)
    await expectNoAxeViolations(page)
    await card.getByRole('button', { name: he.manage.person.full }).click()
    await expect(card.getByRole('heading', { name: he.soldiers.profileTitle, exact: true })).toBeVisible()
    await expect(card.getByLabel(he.soldiers.personalId)).toHaveValue('8000001')
    await expectNoAxeViolations(page)
  })

  await test.step('archiving sits behind "⋯", asks by name, and the toast takes it back', async () => {
    const card = page.getByRole('dialog', { name: 'נועם בר' })
    await card.getByRole('button', { name: he.common.actions }).click()
    await page.getByRole('menuitem', { name: he.manage.archive.move }).click()
    const asking = page.getByRole('alertdialog')
    await expect(asking).toContainText('נועם בר')
    await expectNoAxeViolations(page)
    await asking.getByRole('button', { name: he.manage.archive.confirm }).click()
    await expect(soldierRow(page, 'נועם בר')).toHaveCount(0)
    await page.getByRole('status').getByRole('button', { name: he.common.cancel }).click()
    await expect(soldierRow(page, 'נועם בר')).toBeVisible()
  })
})

test('a multi-select moves several soldiers to another unit at once', async ({ page, isMobile }) => {
  await openModule(page, he.units.open)
  await addUnit(page, 'מחלקה א')
  await closeDrawers(page)
  await addSoldiers(page, [
    ['אורי', 'כהן'],
    ['יעל', 'שחר'],
  ])
  await page.getByRole('button', { name: he.manage.people.options }).click()
  await page.getByRole('button', { name: he.manage.people.select }).click()
  const tray = page.getByRole('group', { name: he.manage.people.selectionLabel })
  // The row itself is the checkbox: a press anywhere on it chooses it.
  await soldierRow(page, 'אורי כהן').getByText('אורי כהן').click()
  await soldierRow(page, 'יעל שחר').getByText('יעל שחר').click()
  await expect(page.getByRole('checkbox', { name: 'אורי כהן' })).toBeChecked()
  await expect(tray.getByRole('status')).toHaveText(`2 ${he.manage.people.selected}`)
  // The tray stands in the tab bar's place on a phone; a wide screen's rail stays beside it (D-491).
  await expect(tab(page, 'manage')).toHaveCount(isMobile ? 0 : 1)
  await expectNoAxeViolations(page)
  // Choosing is a layer: the back button ends it and leaves the page where it was.
  await page.goBack()
  await expect(tray).toHaveCount(0)
  await expect(soldiersHeading(page)).toBeVisible()
  await page.getByRole('button', { name: he.manage.people.options }).click()
  await page.getByRole('button', { name: he.manage.people.select }).click()
  await soldierRow(page, 'אורי כהן').getByText('אורי כהן').click()
  await soldierRow(page, 'יעל שחר').getByText('יעל שחר').click()
  // What a search hides is not acted on: the tray counts the rows in sight.
  await page.getByRole('button', { name: he.manage.people.search, exact: true }).click()
  await page.getByLabel(he.manage.people.searchLabel).fill('שחר')
  await expect(tray.getByRole('status')).toHaveText(`1 ${he.manage.people.selected}`)
  await page.getByLabel(he.manage.people.searchLabel).fill('')
  await expect(tray.getByRole('status')).toHaveText(`2 ${he.manage.people.selected}`)
  await tray.getByRole('button', { name: he.manage.people.move }).click()
  const dialog = page.getByRole('dialog', { name: he.manage.move.title })
  await dialog.getByRole('button', { name: new RegExp(`${he.soldiers.unit}$`) }).click()
  await page.getByRole('option', { name: 'מחלקה א', exact: true }).click()
  await dialog.getByRole('button', { name: he.manage.move.submit, exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: `2 ${he.manage.move.done}` })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: /מחלקה א/ })).toBeVisible()
})

test('"כללי נוכחות": the rules by unit, "לא חל" under a higher one, the switch, and the archive', async ({ page }) => {
  await openModule(page, he.units.open)
  await addUnit(page, 'מחלקה א')
  await closeDrawers(page)
  await createRule(page, { name: 'ספר מחלקה', scope: 'מחלקה א', min: '1' })
  await createRule(page, { name: 'שבוע פעילות', scope: 'מחלקה א', min: '2', priority: '5' })
  const lower = page.getByRole('main').getByRole('listitem').filter({ hasText: 'ספר מחלקה' })
  await expect(page.getByRole('main').getByText(`מחלקה א`, { exact: true })).toBeVisible()
  await expect(lower.getByRole('button', { name: `${he.manage.rules.notApplied} · שבוע פעילות` })).toBeVisible()
  await expect(page.getByRole('main').getByText(`2 ${he.manage.rules.active}`)).toBeVisible()
  // The quiet marker and the switch are drawn small, inside 44 px targets.
  for (const target of [
    lower.getByRole('button', { name: `${he.manage.rules.notApplied} · שבוע פעילות` }),
    page.getByRole('switch', { name: `${he.manage.rules.enabled} ספר מחלקה` }).locator('xpath=ancestor::label[1]'),
  ]) {
    const box = await target.boundingBox()
    expect(Math.min(box?.width ?? 0, box?.height ?? 0)).toBeGreaterThanOrEqual(44)
  }
  await expectNoAxeViolations(page)

  await test.step('"לא חל" opens the rule that wins; the higher rule switched off lets the lower one apply', async () => {
    await lower.getByRole('button', { name: `${he.manage.rules.notApplied} · שבוע פעילות` }).click()
    await expect(page.getByRole('dialog', { name: 'שבוע פעילות' })).toBeVisible()
    await expectNoAxeViolations(page)
    await closeDrawers(page)
    await page.getByRole('switch', { name: `${he.manage.rules.enabled} שבוע פעילות` }).click({ force: true })
    await expect(page.getByRole('main').getByText(`1 ${he.manage.rules.active}`)).toBeVisible()
    await expect(lower.getByRole('button', { name: new RegExp(he.manage.rules.notApplied) })).toHaveCount(0)
    await page.getByRole('switch', { name: `${he.manage.rules.enabled} שבוע פעילות` }).click({ force: true })
    await expect(lower.getByRole('button', { name: new RegExp(he.manage.rules.notApplied) })).toBeVisible()
  })

  await test.step('archiving the higher rule from its drawer takes the mark away; the archive brings it back', async () => {
    await page.getByRole('main').getByRole('button', { name: /^שבוע פעילות/ }).click()
    const drawer = page.getByRole('dialog', { name: 'שבוע פעילות' })
    await drawer.getByRole('button', { name: he.common.actions }).click()
    await page.getByRole('menuitem', { name: he.manage.archive.move }).click()
    await expect(page.getByRole('alertdialog')).toContainText('שבוע פעילות')
    await page.getByRole('alertdialog').getByRole('button', { name: he.manage.archive.confirm }).click()
    await expect(drawer).toBeHidden()
    await expect(lower.getByRole('button', { name: new RegExp(he.manage.rules.notApplied) })).toHaveCount(0)

    await page.getByRole('button', { name: he.manage.rules.options }).click()
    await page.getByRole('button', { name: `${he.manage.people.archive} · 1` }).click()
    const archive = page.getByRole('dialog', { name: he.manage.archive.title })
    await expect(archive).toBeVisible()
    await expectNoAxeViolations(page)
    await archive.getByRole('button', { name: /שבוע פעילות/ }).click()
    await archive.getByRole('button', { name: he.manage.archive.restore }).click()
    await closeDrawers(page)
    await expect(lower.getByRole('button', { name: new RegExp(he.manage.rules.notApplied) })).toBeVisible()
  })
})
