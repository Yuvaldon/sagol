import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { enterAsYael, setUpFighter, signOut } from './support/fighter.ts'
import { NOW, closeDrawer, createType, drawer, openRotation, requestLeave } from './support/leaves.ts'
import { createSoldier, openSoldierCard, openSoldiers, soldierRow } from './support/soldiers.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations, myRequestRow, myRequestsList, openMePage, openModule, openTab, tab } from './support/workspace.ts'

// "אני" of the new interface (D-488, D-489): the profile and its edit in place, "הסבב שלי", "כל הבקשות", "העדפות" and
// the notifications drawer; the person card's pencil and the tray's tags, the same component. On desktop and mobile,
// RTL, with axe. Sample data, tests only.

const COURSE = 'קורס'
const CATEGORY = 'צבאי'
const DRIVER = 'נהג'
const MEDIC = 'חובש'

function main(page: Page) {
  return page.getByRole('main')
}

/** A category with one tag, made in the tags module's form (D-285). */
async function createTag(page: Page) {
  await openModule(page, he.tags.open)
  await drawer(page).getByRole('button', { name: he.tags.new }).first().click()
  await page.getByLabel(he.tags.name).fill(DRIVER)
  await drawer(page).getByRole('button', { name: he.tagCategories.new }).click()
  const inPlace = page.getByRole('dialog', { name: he.tagCategories.new })
  await inPlace.getByLabel(he.tagCategories.name).fill(CATEGORY)
  await inPlace.locator('label').filter({ has: page.getByRole('radio', { name: he.palette.teal, exact: true }) }).click()
  await inPlace.getByRole('button', { name: he.common.create }).click()
  await expect(inPlace).toBeHidden()
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(drawer(page).getByRole('list', { name: CATEGORY })).toContainText(DRIVER)
  await closeDrawer(page)
}

/** Back to the first screen of "אני": a press on its tab (D-465). */
async function meIndex(page: Page) {
  await openTab(page, 'me')
  if (/[?&]page=/.test(page.url())) await tab(page, 'me').click()
  await expect(page.getByRole('heading', { level: 1, name: OWNER.name })).toBeVisible()
}

test('"אני": the profile edited in place, "הסבב שלי", "כל הבקשות", "העדפות" and the bell', async ({ page }) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)
  await createTag(page)
  await openModule(page, he.leaveTypes.open)
  await createType(page, { name: COURSE, color: he.palette.teal })
  await closeDrawer(page)
  await openRotation(page, [OWNER.name])
  await requestLeave(page, { type: COURSE, from: ['14', '11', '2026'], to: ['16', '11', '2026'] })

  await test.step('the profile, the rotation card with the waiting request named on the strip, and the requests card', async () => {
    await meIndex(page)
    const strip = main(page).getByRole('list', { name: he.myLeaves.nextDaysTitle })
    await expect(strip.getByRole('listitem')).toHaveCount(14)
    await expect(strip.getByRole('listitem').filter({ hasText: `${he.kit.dayPending} ${COURSE}` })).toHaveCount(3)
    const requests = main(page).getByRole('region', { name: he.me.myRequests })
    await expect(requests.getByRole('button', { name: new RegExp(COURSE) })).toBeVisible()
    await expect(requests.getByText(he.leaves.badgePending, { exact: true })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  await test.step('the chevron shows the details', async () => {
    await main(page).getByRole('button', { name: he.profile.expand }).click()
    await expect(main(page).getByRole('heading', { name: he.profile.details })).toBeVisible()
    await expect(main(page).getByText(he.profile.placedSince)).toBeVisible()
    await main(page).getByRole('button', { name: he.profile.collapse }).click()
  })

  await test.step('the pencil edits in place: a nickname, a phone and a tag, saved with ✓ and taken back from the toast', async () => {
    await main(page).getByRole('button', { name: he.profile.edit }).click()
    await main(page).getByLabel(he.soldiers.nickname).fill('דנוש')
    await main(page).getByLabel(he.soldiers.phone).fill('0501234567')
    await main(page).getByRole('button', { name: he.profile.tagAdd }).click()
    const picker = page.getByRole('dialog', { name: he.profile.tagAdd })
    await picker.getByRole('button', { name: DRIVER, exact: true }).click()
    await expect(picker.getByRole('button', { name: DRIVER, exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expectNoAxeViolations(page)
    await page.keyboard.press('Escape')
    await expect(picker).toBeHidden()
    await expect(main(page).getByRole('list', { name: he.soldiers.tagsTitle })).toContainText(DRIVER)
    await expectNoAxeViolations(page)
    await main(page).getByRole('button', { name: he.profile.save }).click()
    const toast = page.getByRole('status').filter({ hasText: he.profile.saved })
    await expect(toast).toBeVisible()
    await expect(main(page).getByText('0501234567')).toBeVisible()
    await main(page).getByRole('button', { name: he.profile.expand }).click()
    await expect(main(page).getByText('דנוש')).toBeVisible()
    await toast.getByRole('button', { name: he.profile.undo }).click()
    await expect(main(page).getByText('דנוש')).toHaveCount(0)
    await expect(main(page).getByText('0501234567')).toHaveCount(0)
    await main(page).getByRole('button', { name: he.profile.collapse }).click()
  })

  await test.step('"הוסף: X" makes a tag in place; ✓ saves it, and "ביטול" takes it off again (D-490)', async () => {
    await main(page).getByRole('button', { name: he.profile.edit }).click()
    await main(page).getByRole('button', { name: he.profile.tagAdd }).click()
    const picker = page.getByRole('dialog', { name: he.profile.tagAdd })
    await picker.getByLabel(he.profile.tagSearch).fill(MEDIC)
    await picker.getByRole('button', { name: `${he.profile.tagCreate} ${MEDIC}` }).click()
    // "הוסף: X" leaves with the keyboard; the picker keeps it, so Escape still closes it (D-496).
    await page.keyboard.press('Escape')
    await expect(picker).toBeHidden()
    // Each chip's ✕ names its tag.
    await expect(main(page).getByRole('button', { name: `${he.profile.tagRemove} ${MEDIC}` })).toBeVisible()
    await main(page).getByRole('button', { name: he.profile.save }).click()
    const toast = page.getByRole('status').filter({ hasText: he.profile.saved })
    await expect(main(page).getByRole('list', { name: he.soldiers.tagsTitle })).toContainText(MEDIC)
    await toast.getByRole('button', { name: he.profile.undo }).click()
    await expect(main(page).getByRole('list', { name: he.soldiers.tagsTitle })).toHaveCount(0)
  })

  await test.step('"הסבב שלי": the summary, the month back to past months, and days chosen become a request', async () => {
    await openMePage(page, 'rotation')
    const summary = main(page).getByRole('definition').first()
    await expect(summary).toBeVisible()
    await expect(main(page)).toContainText(he.me.approvedRequests)
    await expectNoAxeViolations(page)
    await main(page).getByRole('gridcell', { name: /, 20 בנובמבר/ }).first().click()
    await main(page).getByRole('gridcell', { name: /, 21 בנובמבר/ }).first().click()
    const tray = page.getByRole('group', { name: he.today.selection })
    await tray.getByRole('button', { name: new RegExp(he.today.requestDays) }).click()
    await expect(drawer(page).getByRole('heading', { name: he.leaves.newTitle })).toBeVisible()
    // Closed where it opened: the page stays under it.
    await drawer(page).getByRole('button', { name: he.common.close }).first().click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await main(page).getByRole('button', { name: he.today.previousMonth }).click()
    await expect(main(page)).toContainText('אוקטובר')
  })

  await test.step('"כל הבקשות": the open ones, and the history', async () => {
    await openMePage(page, 'requests')
    await expect(myRequestRow(page, COURSE).getByText(he.leaves.badgePending, { exact: true })).toBeVisible()
    await expectNoAxeViolations(page)
    await main(page).getByRole('radio', { name: he.me.historyTab }).click()
    await expect(myRequestsList(page, 'history')).toContainText(he.me.emptyHistory)
  })

  await test.step('"העדפות": the appearance, "עבודה" for who approves their own, the account and sign-out', async () => {
    await openMePage(page, 'preferences')
    await expect(main(page).getByRole('radiogroup', { name: he.account.appearance })).toBeVisible()
    await expect(main(page).getByRole('region', { name: he.me.work })).toBeVisible()
    await expect(main(page).getByText(OWNER.email)).toBeVisible()
    await expect(main(page).getByRole('button', { name: he.account.signOut, exact: true })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  await test.step('the bell opens the notifications drawer', async () => {
    await meIndex(page)
    await main(page).getByRole('button', { name: new RegExp(`^${he.me.notificationsTitle}`) }).click()
    await expect(page.getByRole('dialog', { name: he.me.notificationsTitle })).toContainText(he.me.notificationsEmpty)
    await expectNoAxeViolations(page)
    await closeDrawer(page)
  })

  await test.step('a link to the old drawer "שלי" opens "כל הבקשות"', async () => {
    await page.goto('/?panel=my_leaves')
    await expect(page.getByRole('heading', { level: 1, name: he.me.myRequests })).toBeVisible()
  })
})

test('a fighter has no pencil and no "עבודה", and keeps the bell', async ({ page }) => {
  await setUpFighter(page)
  await signOut(page)
  await enterAsYael(page)
  await openTab(page, 'me')
  await expect(main(page).getByRole('button', { name: he.profile.edit })).toHaveCount(0)
  await expect(main(page).getByRole('button', { name: new RegExp(`^${he.me.notificationsTitle}`) })).toBeVisible()
  await expectNoAxeViolations(page)
  await openMePage(page, 'preferences')
  await expect(main(page).getByRole('region', { name: he.me.work })).toHaveCount(0)
})

test('the person card edits in place, and the tray tags several soldiers', async ({ page }) => {
  await enterAsOwner(page)
  await createTag(page)
  await createSoldier(page, 'אורי', 'כהן')
  await createSoldier(page, 'יעל', 'שחר')

  await test.step('the card\'s pencil, beside "⋯"', async () => {
    const card = await openSoldierCard(page, 'אורי כהן')
    await card.getByRole('button', { name: he.profile.edit }).click()
    await card.getByLabel(he.soldiers.nickname).fill('אורק')
    await expectNoAxeViolations(page)
    await card.getByRole('button', { name: he.profile.save }).click()
    await expect(page.getByRole('status').filter({ hasText: he.profile.saved })).toBeVisible()
    await expect(card.getByRole('button', { name: he.profile.edit })).toBeVisible()
    await closeDrawer(page)
  })

  await test.step('"תגיות" in the tray sets a tag on every chosen soldier', async () => {
    await openSoldiers(page)
    await page.getByRole('button', { name: he.manage.people.options }).click()
    await page.getByRole('button', { name: he.manage.people.select }).click()
    await soldierRow(page, 'אורי כהן').getByText('אורי כהן').click()
    await soldierRow(page, 'יעל שחר').getByText('יעל שחר').click()
    const tray = page.getByRole('group', { name: he.manage.people.selectionLabel })
    await tray.getByRole('button', { name: he.manage.people.tags }).click()
    const dialog = page.getByRole('dialog', { name: he.profile.tagsFor })
    await dialog.getByRole('button', { name: DRIVER, exact: true }).click()
    await expectNoAxeViolations(page)
    await dialog.getByRole('button', { name: he.common.save, exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: `${he.profile.tagsDone} 2 ${he.profile.soldiersWord}` })).toBeVisible()
    await expect(soldierRow(page, 'יעל שחר')).toContainText(DRIVER)
    await expect(soldierRow(page, 'אורי כהן')).toContainText(DRIVER)
  })
})
