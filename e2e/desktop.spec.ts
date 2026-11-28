import { expect, test } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { closeDrawer, createType, drawer } from './support/leaves.ts'
import { createSoldier, openSoldiers, soldierList, soldierRow } from './support/soldiers.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations, navigation, openModule, openTab } from './support/workspace.ts'

// The desktop pass (R5·6, D-491 … D-495): the side rail, the side panel that is not modal, "ניהול" beside its page, the
// soldiers' table, the linked accounts, and an archive undone from its module. The side panel's flow runs on a phone as
// a sheet; the archive and the linked accounts run on both. RTL, with axe. Sample data, tests only.

test('the side rail, "ניהול" beside its page, the soldiers\' table and a card in the side panel', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The desktop layout (D-491)')
  await enterAsOwner(page)
  await createSoldier(page, 'נועם', 'בר')

  await test.step('the rail names each destination under its icon, on the inline start', async () => {
    await openTab(page, 'today')
    const rail = navigation(page)
    await expect(rail).toContainText(he.shell.tabToday)
    await expect(rail).toContainText(he.workspace.board)
    const box = await rail.boundingBox()
    const viewport = page.viewportSize()
    // RTL: the inline start is the right edge.
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeGreaterThan((viewport?.width ?? 0) - 4)
    await expectNoAxeViolations(page)
  })

  await test.step('a page of "ניהול" stands beside its rows, the open one marked', async () => {
    await openSoldiers(page)
    const tools = page.getByRole('navigation', { name: he.navigation.tab })
    await expect(tools.getByRole('button', { name: he.soldiers.open, exact: true })).toHaveAttribute('aria-current', 'page')
    await expectNoAxeViolations(page)
  })

  await test.step('"חיילים" is a table of name, rank, unit, tags and the seven days', async () => {
    const table = soldierList(page).getByRole('table', { name: he.manage.people.tableLabel })
    await expect(table.getByRole('columnheader')).toHaveText([
      he.manage.people.columns.name,
      he.manage.people.columns.rank,
      he.manage.people.columns.unit,
      he.manage.people.columns.tags,
      he.manage.people.columns.days,
    ])
    await expect(soldierRow(page, 'נועם בר')).toBeVisible()
  })

  await test.step('a card opens in the side panel, and the table beside it stays in reach: another row replaces it', async () => {
    await soldierRow(page, 'נועם בר').getByRole('button').first().click()
    await expect(page.getByRole('dialog', { name: 'נועם בר' })).toBeVisible()
    await expectNoAxeViolations(page)
    await soldierRow(page, OWNER.name).getByRole('button').first().click()
    await expect(page.getByRole('dialog', { name: OWNER.name })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(1)
    // The panel is not modal: Escape closes it with the keyboard on the page beside it too (D-496).
    await page.getByRole('heading', { level: 1, name: he.manage.pages.soldiers }).focus()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})

test('an archived definition says so in its module, and "ביטול" brings it back (D-494)', async ({ page }) => {
  await enterAsOwner(page)
  await openModule(page, he.leaveTypes.open)
  await createType(page, { name: 'חופשה', color: he.palette.teal })
  const row = drawer(page).getByRole('listitem').filter({ hasText: 'חופשה' })

  await test.step('the archive asks by name, on a button that is not the primary color', async () => {
    await row.getByRole('button', { name: he.common.actions }).click()
    await page.getByRole('menuitem', { name: he.common.archive }).click()
    const question = page.getByRole('alertdialog', { name: he.leaveTypes.archiveTitle })
    await expect(question).toContainText('חופשה')
    await expectNoAxeViolations(page)
    await question.getByRole('button', { name: he.manage.archive.confirm }).click()
    await expect(drawer(page).getByRole('status').filter({ hasText: `חופשה ${he.manage.archive.done}` })).toBeVisible()
    await expect(row).toHaveCount(0)
  })

  await test.step('"ביטול" restores it in place', async () => {
    await drawer(page).getByRole('status').getByRole('button', { name: he.common.cancel, exact: true }).click()
    await expect(drawer(page).getByRole('listitem').filter({ hasText: 'חופשה' })).toBeVisible()
    await expectNoAxeViolations(page)
    await closeDrawer(page)
  })
})

test('the linked accounts: the owner\'s own link, with no "ניתוק" (D-493)', async ({ page }) => {
  await enterAsOwner(page)
  await openTab(page, 'manage')
  await page.getByRole('main').getByRole('button', { name: he.accountLinks.open, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: he.manage.pages.joins })).toBeVisible()
  await page.getByRole('button', { name: he.accountLinks.linkedTitle, exact: true }).click()
  const linked = page.getByRole('dialog', { name: he.accountLinks.linkedTitle })
  await expect(linked.getByRole('list', { name: he.accountLinks.linkedTitle })).toContainText(OWNER.name)
  await expect(linked.getByRole('button', { name: he.accountLinks.unlink })).toHaveCount(0)
  await expectNoAxeViolations(page)
})
