import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { TYPE, YAEL_NAME, enterAsYael, setUpFighter, signOut } from './support/fighter.ts'
import { choose, closeDrawer, drawer, leavesOf, typeDate } from './support/leaves.ts'
import { OWNER, expectNoAxeViolations, navigation, openModule, signIn } from './support/workspace.ts'

// V25's acceptance: journeys (c), (d) and (e) of docs/Design.md, step by step as written there (D-263), on desktop and
// a phone, RTL, with axe. A step that changes in Design.md changes here in the same commit. Sample data, tests only.

const REASON = 'חתונה'
const INBOX = new RegExp(`^${he.inbox.open}( \\d+ ${he.inbox.pendingCount})?$`)

function report(page: Page) {
  return page.getByRole('dialog', { name: he.presence.title })
}

test('journeys (c), (d) and (e): a soldier requests, a commander approves, the daily report', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await setUpFighter(page)
  await signOut(page)
  await enterAsYael(page)

  await test.step('(c) 1. "בקשה חדשה" is the strip\'s quick action, and Yael is the requester', async () => {
    await navigation(page).getByRole('button', { name: he.leaves.new, exact: true }).click()
    await expect(drawer(page).getByRole('heading', { name: he.leaves.newTitle })).toBeVisible()
    await expect(drawer(page).getByRole('combobox', { name: he.leaves.soldier })).toHaveValue(YAEL_NAME)
    await expectNoAxeViolations(page)
  })

  await test.step('(c) 2–3. type, days and reason; sent, it is pending in "שלי" and on the board', async () => {
    await choose(page, he.leaves.type, TYPE)
    await typeDate(page, he.leaves.from, '11', '11', '2026')
    await typeDate(page, he.leaves.to, '12', '11', '2026')
    await drawer(page).getByRole('textbox', { name: new RegExp(he.leaves.reason) }).fill(REASON)
    await drawer(page).getByRole('button', { name: he.leaves.submit, exact: true }).click()
    await expect(drawer(page)).toBeHidden()
    await expect(leavesOf(page).first()).toHaveAccessibleName(new RegExp(`^${TYPE}, ${he.leaves.statusPending}, `))
    await openModule(page, he.myLeaves.open)
    const row = drawer(page).getByRole('list', { name: he.myLeaves.openTitle }).getByRole('button', { name: new RegExp(TYPE) })
    await expect(row.getByText(he.leaves.statusPending, { exact: true })).toBeVisible()
    await expectNoAxeViolations(page)
    await closeDrawer(page)
  })

  await test.step('(d) 1. the commander lands on the board; "בקשות" carries the count awaiting approval', async () => {
    await signOut(page)
    await signIn(page, OWNER.email)
    await expect(navigation(page).getByRole('button', { name: `${he.inbox.open} 1 ${he.inbox.pendingCount}` })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(leavesOf(page).first()).toBeVisible()
  })

  await test.step('(d) 2 and 4. "ממתינות לאישורי" lists the request; the approve-now switch is in the hub\'s header', async () => {
    await openModule(page, INBOX)
    await expect(drawer(page).getByRole('button', { name: he.inbox.tabPending, exact: true })).toBeVisible()
    await expect(drawer(page).getByRole('switch', { name: he.account.approveNowDefault })).toBeVisible()
    const list = drawer(page).getByRole('list', { name: he.inbox.pendingLabel })
    await expect(list.getByText(YAEL_NAME)).toBeVisible()
    await expect(list).toContainText(TYPE)
    await expectNoAxeViolations(page)
  })

  await test.step('(d) 3. the details open the leave\'s drawer, where it is approved', async () => {
    await drawer(page).getByRole('list', { name: he.inbox.pendingLabel }).getByRole('button', { name: new RegExp(YAEL_NAME) }).click()
    await expect(page).toHaveURL(/panel=leaves&entity=[0-9a-f-]{36}/)
    await drawer(page).getByRole('button', { name: he.leaves.approve, exact: true }).click()
    const details = drawer(page).getByRole('region', { name: he.leaves.detailsLabel })
    await expect(details.getByText(he.leaves.statusApproved, { exact: true })).toBeVisible()
    await closeDrawer(page)
    await expect(navigation(page).getByRole('button', { name: he.inbox.open, exact: true })).toBeVisible()
  })

  await test.step('(e) 1–2. דוח 1 in the bottom strip opens today: the counts, then by unit', async () => {
    await navigation(page).getByRole('button', { name: he.presence.title, exact: true }).click()
    await expect(page).toHaveURL(/panel=presence/)
    await expect(report(page).getByText('יום רביעי, 11 בנובמבר 2026')).toBeVisible()
    await expect(report(page).getByRole('term').first()).toHaveText(he.presence.total)
    await expect(report(page).getByRole('heading', { level: 3, name: new RegExp(`${he.presence.leaving} 1`) }).first()).toBeVisible()
    const closed = report(page).getByRole('heading').getByRole('button', { expanded: false })
    while ((await closed.count()) > 0) await closed.first().click()
    await expect(report(page)).toContainText(YAEL_NAME)
    await expect(report(page)).not.toContainText(REASON)
    await expectNoAxeViolations(page)
  })

  await test.step('(e) 3. "סיבות" adds the reasons; "העתקה" sends it on', async () => {
    await report(page).locator('label').filter({ has: page.getByRole('switch', { name: he.presence.reasons }) }).click()
    await expect(report(page)).toContainText(REASON)
    await report(page).getByRole('button', { name: he.presence.copy }).click()
    await expect(report(page).getByRole('status')).toHaveText(he.presence.copied)
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(REASON)
  })
})
