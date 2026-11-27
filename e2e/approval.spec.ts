import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { createSoldier } from './support/soldiers.ts'
import { NOW, choose, closeDrawer, createType, drawer, leavesOf, press, requestLeave, typeDate, openRotationInNewUnit, openNewLeave } from './support/leaves.ts'
import { enterAsOwner, expectNoAxeViolations, openBoardOnTimeline, openModule, OWNER, INBOX, expectWaitingRequests, managePage, openTab, openRequests, requestsList, backToBoard, openClosedRequests } from './support/workspace.ts'

// V5's demo: a bar opens its leave; approve, edit, comment, reject and reopen; the inbox with its pending and closed
// lists; the "approve now" default; and an edit that another tab made stale. Desktop and mobile, RTL, with axe.
// Sample data, tests only.

const TOUCH_TARGET_PX = 44
const PENDING_BAR = `רגילה, ${he.leaves.statusPending}, 9–10 בנוב׳`

function thread(page: Page) {
  return drawer(page).getByRole('list', { name: he.leaves.threadTitle })
}

function action(page: Page, name: string) {
  return drawer(page).getByRole('group', { name: he.leaves.actionsLabel }).getByRole('button', { name, exact: true })
}

/** A picture for the owner, beside the test's other output. */
async function shot(page: Page, project: string, name: string) {
  await page.screenshot({ path: `test-results/v5/${project}-${name}.png` })
}

async function setUp(page: Page) {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)
  await openRotationInNewUnit(page, [OWNER.name])
  await openModule(page, he.leaveTypes.open)
  await createType(page, { name: 'רגילה', color: he.palette.teal, icon: he.icons.home })
  await createType(page, { name: 'מחלה', color: he.palette.red, requiresReason: true })
  await closeDrawer(page)
  // The inbox is for who approves another soldier (D-299), so the unit holds one more.
  await createSoldier(page, 'רון', 'כהן')
  await requestLeave(page, { type: 'רגילה', from: ['09', '11', '2026'], to: ['10', '11', '2026'] })
  await expect(leavesOf(page)).toHaveCount(1)
}

// The steps read the timeline's bars, which a phone opens only when asked (D-290).
test.beforeEach(async ({ page, isMobile }) => {
  await openBoardOnTimeline(page, isMobile)
})

test('a leave from its bar to a decision, and back', async ({ page }, testInfo) => {
  const project = testInfo.project.name
  await setUp(page)

  await test.step('the inbox counts the request, and the bar opens its details', async () => {
    await expectWaitingRequests(page, 1)
    await openTab(page, 'board')
    await leavesOf(page).first().click()
    await expect(page).toHaveURL(/panel=leaves&(tab=\w+&)?entity=[0-9a-f-]{36}/)
    const details = drawer(page).getByRole('region', { name: he.leaves.detailsLabel })
    // The drawer is named by the leave's type; its card holds the days, the type and the badge.
    await expect(drawer(page).getByRole('heading', { name: 'רגילה', exact: true })).toBeVisible()
    await expect(details).toContainText('רגילה')
    await expect(details.getByText(he.leaves.badgePending, { exact: true })).toBeVisible()
    await expect(details.getByText(OWNER.name)).toBeVisible()
    await expect(details.getByText(`2 ${he.leaves.days}`)).toBeVisible()
    await expect(thread(page).getByRole('listitem')).toHaveText([new RegExp(he.leaves.eventCreated)])
    await expectNoAxeViolations(page)
    await shot(page, project, '1-details')
  })

  await test.step('approving shows at once, and only the steps an approved leave allows remain', async () => {
    await action(page, he.leaves.approve).click()
    const details = drawer(page).getByRole('region', { name: he.leaves.detailsLabel })
    await expect(details.getByText(he.leaves.badgeApproved, { exact: true })).toBeVisible()
    await expect(details.getByText(he.leaves.reviewedBy)).toBeVisible()
    await expect(action(page, he.leaves.approve)).toHaveCount(0)
    await expect(action(page, he.leaves.reopen)).toBeVisible()
    await expect(thread(page).getByRole('listitem')).toHaveCount(2)
    await expect(thread(page)).toContainText(he.leaves.eventApproved)
  })

  await test.step('one form edits the days, the type and the reason, as one line in the history (D-123)', async () => {
    await action(page, he.leaves.edit).click()
    await expect(drawer(page).getByRole('heading', { name: he.leaves.editTitle })).toBeVisible()
    await typeDate(page, he.leaves.to, '12', '11', '2026')
    await choose(page, he.leaves.type, 'מחלה')
    await drawer(page).getByRole('button', { name: he.common.save, exact: true }).click()
    await expect(drawer(page).getByText(he.issues.reasonRequired)).toBeVisible()
    await drawer(page).getByRole('textbox', { name: new RegExp(he.leaves.reason) }).fill('שפעת')
    await expectNoAxeViolations(page)
    await drawer(page).getByRole('button', { name: he.common.save, exact: true }).click()
    const details = drawer(page).getByRole('region', { name: he.leaves.detailsLabel })
    await expect(drawer(page).getByRole('heading', { name: 'מחלה', exact: true })).toBeVisible()
    await expect(details.getByText(`4 ${he.leaves.days}`)).toBeVisible()
    await expect(details.getByText('שפעת', { exact: true })).toBeVisible()
    // The owner may approve, so the edited leave stays approved (D-064).
    await expect(details.getByText(he.leaves.badgeApproved, { exact: true })).toBeVisible()
    await expect(thread(page)).toContainText(he.leaves.eventUpdated)
    await expect(thread(page)).not.toContainText(he.leaves.eventRescheduled)
    await expect(thread(page)).toContainText('רגילה ← מחלה')
  })

  await test.step('comments join the thread, an internal one is labelled, and the author edits and deletes', async () => {
    const box = drawer(page).getByRole('textbox', { name: he.leaves.commentLabel })
    await box.fill('לתאם החלפה')
    await drawer(page).getByRole('button', { name: he.leaves.commentAdd }).click()
    await expect(thread(page)).toContainText('לתאם החלפה')
    await expect(box).toHaveValue('')
    await box.fill('רק למפקדים')
    await press(page, 'switch', he.leaves.commentInternal)
    await drawer(page).getByRole('button', { name: he.leaves.commentAdd }).click()
    const internal = thread(page).getByRole('listitem').filter({ hasText: 'רק למפקדים' })
    await expect(internal.getByText(he.leaves.internalTag, { exact: true })).toBeVisible()
    await expectNoAxeViolations(page)
    await shot(page, project, '2-thread')

    await internal.getByRole('button', { name: he.leaves.commentActions }).click()
    await page.getByRole('menuitem', { name: he.leaves.commentEdit }).click()
    await page.getByRole('textbox', { name: he.leaves.commentBody }).fill('רק למפקדים, מעודכן')
    await page.getByRole('button', { name: he.common.save, exact: true }).click()
    const edited = thread(page).getByRole('listitem').filter({ hasText: 'רק למפקדים, מעודכן' })
    await expect(edited.getByText(he.leaves.commentEdited, { exact: true })).toBeVisible()
    await edited.getByRole('button', { name: he.leaves.commentActions }).click()
    await page.getByRole('menuitem', { name: he.leaves.commentDelete }).click()
    await expect(page.getByRole('alertdialog')).toContainText(he.leaves.commentDeleteHint)
    await expectNoAxeViolations(page)
    await page.getByRole('button', { name: he.leaves.commentDeleteConfirm, exact: true }).click()
    await expect(thread(page)).not.toContainText('רק למפקדים')
  })

  await test.step('rejecting asks first, takes a note, and takes the bar off the board', async () => {
    await action(page, he.leaves.reject).click()
    await expect(page.getByRole('heading', { name: he.leaves.rejectTitle })).toBeVisible()
    await page.getByRole('textbox', { name: he.leaves.note }).fill('אין כיסוי')
    await expectNoAxeViolations(page)
    await page.getByRole('button', { name: he.leaves.reject, exact: true }).last().click()
    const details = drawer(page).getByRole('region', { name: he.leaves.detailsLabel })
    await expect(details.getByText(he.leaves.badgeRejected, { exact: true })).toBeVisible()
    await expect(thread(page)).toContainText('אין כיסוי')
    await expect(action(page, he.leaves.edit)).toHaveCount(0)
    await closeDrawer(page)
    await expect(leavesOf(page)).toHaveCount(0)
  })

  await test.step('the closed list is the way back: the leave is reopened from there', async () => {
    await openClosedRequests(page)
    await expect(page.getByRole('heading', { name: he.inbox.emptyPendingTitle })).toBeVisible()
    await expect(page).toHaveURL(/panel=leave_closed/)
    const closed = drawer(page).getByRole('list', { name: he.inbox.closedLabel })
    await expect(closed.getByRole('listitem')).toHaveCount(1)
    await expect(closed).toContainText(he.leaves.badgeRejected)
    await expectNoAxeViolations(page)
    await closed.getByRole('button', { name: new RegExp(OWNER.name) }).click()
    await action(page, he.leaves.reopen).click()
    await expect(drawer(page).getByRole('region', { name: he.leaves.detailsLabel }).getByText(he.leaves.badgePending, { exact: true })).toBeVisible()
    await closeDrawer(page)
    await expect(leavesOf(page).first()).toHaveAccessibleName(`מחלה, ${he.leaves.statusPending}, 9–12 בנוב׳`)
  })

  await test.step('the page of requests approves from the row, and then has nothing waiting', async () => {
    await openRequests(page)
    const pending = requestsList(page)
    await expect(pending.getByRole('listitem')).toHaveCount(1)
    await expectNoAxeViolations(page)
    await shot(page, project, '3-inbox')
    await pending.getByRole('button', { name: `${he.leaves.approve} ${OWNER.name}` }).click()
    await expect(page.getByRole('heading', { name: he.inbox.emptyPendingTitle })).toBeVisible()
    await backToBoard(page)
    await expect(leavesOf(page).first()).toHaveAccessibleName(`מחלה, ${he.leaves.statusApproved}, 9–12 בנוב׳`)
    await shot(page, project, '4-board')
    await expectWaitingRequests(page, 0)
  })

  await test.step('on a phone the requests row is a touch target', async () => {
    if (project !== 'mobile') return
    const box = await managePage(page).getByRole('button', { name: INBOX, exact: true }).boundingBox()
    if (box === null) throw new Error('no inbox button')
    expect(box.height).toBeGreaterThanOrEqual(TOUCH_TARGET_PX)
    expect(box.width).toBeGreaterThanOrEqual(TOUCH_TARGET_PX)
  })
})

test('an edit another tab made stale says so, and continues from the stored leave', async ({ page, context }) => {
  await setUp(page)
  await leavesOf(page).first().click()
  await action(page, he.leaves.edit).click()
  await typeDate(page, he.leaves.to, '11', '11', '2026')

  // The same browser, another tab: the same store (D-021).
  const other = await context.newPage()
  await other.clock.setFixedTime(NOW)
  await other.goto(page.url())
  await drawer(other).getByRole('group', { name: he.leaves.actionsLabel }).getByRole('button', { name: he.leaves.approve, exact: true }).click()
  // The status shows before the command answers; its line in the history is read from the store.
  await expect(drawer(other).getByRole('list', { name: he.leaves.threadTitle })).toContainText(he.leaves.eventApproved)
  await other.close()

  await drawer(page).getByRole('button', { name: he.common.save, exact: true }).click()
  await expect(drawer(page).getByRole('alert')).toContainText(he.errors.staleVersion)
  await expectNoAxeViolations(page)
  await drawer(page).getByRole('button', { name: he.common.reloadItem }).click()
  // The form opens again on the stored leave: approved by the other tab, at its stored days.
  await typeDate(page, he.leaves.to, '11', '11', '2026')
  await drawer(page).getByRole('button', { name: he.common.save, exact: true }).click()
  const details = drawer(page).getByRole('region', { name: he.leaves.detailsLabel })
  await expect(details.getByText(`3 ${he.leaves.days}`)).toBeVisible()
  await expect(details.getByText(he.leaves.badgeApproved, { exact: true })).toBeVisible()
})

test('the "approve now" default, and a link to a leave that is not there', async ({ page }) => {
  await setUp(page)
  await expect(leavesOf(page).first()).toHaveAccessibleName(PENDING_BAR)

  await test.step('the page of requests holds the default, and the new-leave form starts from it', async () => {
    await openRequests(page)
    const item = page.getByRole('switch', { name: he.account.approveNowDefault })
    await expect(item).not.toBeChecked()
    await expectNoAxeViolations(page)
    await page.locator('label').filter({ has: item }).click()
    await expect(item).toBeChecked()
    await backToBoard(page)

    await requestLeave(page, { type: 'רגילה', from: ['13', '11', '2026'], to: ['13', '11', '2026'] })
    // The bar shows before the command answers; the drawer closes once it has.
    await expect(drawer(page)).toHaveCount(0)
    await expect(leavesOf(page)).toHaveCount(2)
    await expect(leavesOf(page).nth(1)).toHaveAccessibleName(`רגילה, ${he.leaves.statusApproved}, 13 בנוב׳`)
    await page.reload()
    await openRequests(page)
    await expect(page.getByRole('switch', { name: he.account.approveNowDefault })).toBeChecked()
    await backToBoard(page)
  })

  await test.step('an id that is no leave says "not found"', async () => {
    await page.goto('/?panel=leaves&entity=00000000-0000-4000-8000-000000000000')
    await expect(drawer(page).getByText(he.leaves.notFound)).toBeVisible()
  })
})

test('the leave drawer keeps the keyboard, and the month of a blank request takes one day (D-473, D-476)', async ({ page }) => {
  await setUp(page)

  await test.step('a first tap on the month of a blank request is that day alone', async () => {
    await openNewLeave(page)
    const row = drawer(page).getByRole('group', { name: `${he.leaves.row} 1` })
    await expect(row.getByText(he.leaves.oneDay, { exact: true })).toBeVisible()
    await row.getByRole('button', { name: he.leaves.pickDays, exact: true }).click()
    const days = row.getByRole('grid').getByRole('gridcell')
    await days.filter({ hasText: '30 בנובמבר' }).click()
    await expect(row.getByRole('grid').getByRole('gridcell', { selected: true })).toHaveCount(1)
    await expect(days.filter({ hasText: '30 בנובמבר' })).toHaveAttribute('aria-selected', 'true')
    await expect(row.getByText(he.leaves.oneDay, { exact: true })).toBeVisible()
    // A day reads as its date alone: the month picks days, it does not say where anyone is.
    await expect(days.filter({ hasText: '30 בנובמבר' })).not.toContainText(he.kit.dayBase)
    // The second tap makes the range.
    await days.filter({ hasText: '27 בנובמבר' }).click()
    await expect(row.getByText(`4 ${he.leaves.days}`, { exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(drawer(page)).toHaveCount(0)
    // Escape returns the keyboard to the action circle that opened the drawer.
    await expect(page.getByRole('button', { name: he.leaves.new, exact: true })).toBeFocused()
    await backToBoard(page)
  })

  await test.step('after an answer removes the pressed button, Escape still closes the leave card', async () => {
    await leavesOf(page).first().click()
    await action(page, he.leaves.approve).click()
    await expect(drawer(page).getByRole('region', { name: he.leaves.detailsLabel }).getByText(he.leaves.badgeApproved, { exact: true })).toBeVisible()
    await expect(action(page, he.leaves.approve)).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(drawer(page)).toHaveCount(0)
  })

  await test.step('a form grows the card to its full stop on a phone', async () => {
    await leavesOf(page).first().click()
    const grow = drawer(page).getByRole('button', { name: he.kit.drawerGrow })
    const phone = await grow.isVisible()
    await action(page, he.leaves.edit).click()
    if (phone) await expect(drawer(page).getByRole('button', { name: he.kit.drawerShrink })).toBeVisible()
    await drawer(page).getByRole('button', { name: he.common.cancel, exact: true }).click()
    await closeDrawer(page)
  })
})

test('the dashboard\'s "and more" leads to the page of requests, and Back does not return to the dashboard (D-474)', async ({ page }) => {
  await setUp(page)
  // Twelve more requests in one sheet: a day that repeats every day.
  await openNewLeave(page)
  await drawer(page).getByRole('combobox', { name: he.leaves.soldier }).fill('דנה')
  await page.getByRole('option', { name: OWNER.name, exact: true }).click()
  await choose(page, he.leaves.type, 'רגילה')
  await typeDate(page, he.leaves.from, '12', '11', '2026')
  await typeDate(page, he.leaves.to, '12', '11', '2026')
  await press(page, 'switch', he.leaves.repeats)
  await drawer(page).getByRole('textbox', { name: he.leaves.everyDays }).fill('1')
  await typeDate(page, he.leaves.repeatUntil, '23', '11', '2026')
  await drawer(page).getByRole('button', { name: he.leaves.submit, exact: true }).click()
  await expect(drawer(page)).toHaveCount(0)

  await openModule(page, he.dashboard.open)
  const more = drawer(page).getByRole('button', { name: new RegExp(`^${he.dashboard.more} \\d+$`) })
  await expect(more).toBeVisible()
  await more.click()
  await expect(page.getByRole('heading', { level: 1, name: he.today.approvals })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/page=requests/)
  await expect(page).not.toHaveURL(/panel=/)
  await expect(requestsList(page).getByRole('listitem')).toHaveCount(13)
  // The dashboard's entry is gone with it: Back leaves the app, it does not reopen the drawer.
  await page.goBack()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).not.toHaveURL(/panel=dashboard/)
})

test('a link to the old pending tab opens the page of requests (D-474)', async ({ page }) => {
  await setUp(page)
  await page.goto('/?panel=leave_inbox')
  await expect(page.getByRole('heading', { level: 1, name: he.today.approvals })).toBeVisible()
  await expect(requestsList(page).getByRole('listitem')).toHaveCount(1)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
