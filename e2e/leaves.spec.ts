import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { MARK_NAME, NOW, board, closeDrawer, createType, drawer, leavesOf, requestLeave } from './support/leaves.ts'
import { enterAsOwner, expectNoAxeViolations } from './support/workspace.ts'

// V4's demo: leave types and their groups, a new leave from the floating "+", bars, lanes and a marker on the
// board, and the uniform colors, on desktop and mobile, RTL, with axe. Sample data, tests only.

const TOUCH_TARGET_PX = 44

async function createGroup(page: Page, name: string) {
  await drawer(page).getByRole('button', { name: he.leaveTypes.tabGroups }).click()
  await drawer(page).getByRole('button', { name: he.leaveTypeGroups.new }).first().click()
  await page.getByLabel(he.leaveTypeGroups.name).fill(name)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(drawer(page).getByRole('list', { name: he.leaveTypeGroups.listLabel })).toContainText(name)
}

test('leave types, a new leave, and its bar on the board', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)

  await test.step('a new leave needs a type first, and the way to one is right there', async () => {
    await page.getByRole('button', { name: he.leaves.new }).click()
    await expect(drawer(page).getByRole('heading', { name: he.leaves.noTypesTitle })).toBeVisible()
    await expectNoAxeViolations(page)
    await drawer(page).getByRole('button', { name: he.leaves.openTypes }).click()
    await expect(page).toHaveURL(/panel=leave_types/)
    await expect(drawer(page).getByRole('heading', { name: he.leaveTypes.newTitle })).toBeVisible()
    await page.getByRole('button', { name: he.common.cancel }).click()
  })

  await test.step('groups and types, with their colors, icons and effects', async () => {
    await createGroup(page, 'חופשות')
    await createType(page, { name: 'רגילה', group: 'חופשות', color: he.palette.teal, icon: he.icons.home })
    await createType(page, { name: 'מחלה', color: he.palette.red, requiresReason: true })
    await createType(page, { name: 'מבחן', color: he.palette.purple, icon: he.icons.exam, marker: true })
    await expect(drawer(page).getByRole('heading', { name: 'חופשות' })).toBeVisible()
    await expect(drawer(page).getByText(`${he.leaveTypes.marker}`, { exact: true })).toBeVisible()
    await expectNoAxeViolations(page)
    await closeDrawer(page)
  })

  await test.step('a pending leave is on the board at once', async () => {
    await requestLeave(page, { type: 'חופשות · רגילה', from: ['09', '11', '2026'], to: ['10', '11', '2026'] })
    await expect(drawer(page)).toHaveCount(0)
    await expect(leavesOf(page)).toHaveCount(1)
    await expect(leavesOf(page).first()).toHaveAccessibleName(`רגילה, ${he.leaves.statusPending}, 9–10 בנוב׳`)
    await expectNoAxeViolations(page)
  })

  await test.step('a type that asks for a reason gets one, and an overlap takes a second lane', async () => {
    const row = board(page).getByRole('listitem').filter({ has: page.getByRole('button', { name: MARK_NAME }) })
    const before = await row.boundingBox()
    await requestLeave(page, { type: 'מחלה', from: ['10', '11', '2026'], to: ['12', '11', '2026'], approveNow: true })
    await expect(drawer(page).getByText(he.issues.reasonRequired)).toBeVisible()
    await drawer(page).getByRole('textbox', { name: new RegExp(he.leaves.reason) }).fill('שפעת')
    await drawer(page).getByRole('button', { name: he.leaves.submit, exact: true }).click()
    await expect(drawer(page)).toHaveCount(0)
    await expect(leavesOf(page)).toHaveCount(2)
    await expect(leavesOf(page).nth(1)).toHaveAccessibleName(`מחלה, ${he.leaves.statusApproved}, 10–12 בנוב׳`)
    const after = await row.boundingBox()
    if (before === null || after === null) throw new Error('no row')
    expect(after.height).toBeGreaterThan(before.height)
  })

  await test.step('a marker is a badge, and the soldier stays present', async () => {
    await requestLeave(page, { type: 'מבחן', from: ['12', '11', '2026'], to: ['12', '11', '2026'] })
    await expect(leavesOf(page)).toHaveCount(3)
    await expect(leavesOf(page).nth(2)).toHaveAccessibleName(`מבחן, ${he.leaves.marker}, ${he.leaves.statusPending}, 12 בנוב׳`)
    await expectNoAxeViolations(page)
  })

  await test.step('the uniform colors live in the URL and name the type inside the bar', async () => {
    await page.getByRole('button', { name: new RegExp(he.workspace.view) }).click()
    await page.getByRole('menuitemradio', { name: he.workspace.colorsUniform }).click()
    await expect(page).toHaveURL(/colors=uniform/)
    await expect(board(page).getByText('מחלה', { exact: true })).toBeVisible()
    await page.reload()
    await expect(board(page).getByText('מחלה', { exact: true })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  await test.step('on a phone the bar\'s controls and the menu are icons of a touch size, and the "+" too', async () => {
    if (testInfo.project.name !== 'mobile') return
    for (const name of [he.myLeaves.open, he.filters.add, he.navigation.open]) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox()
      if (box === null) throw new Error(`no ${name}`)
      expect(box.height).toBeGreaterThanOrEqual(TOUCH_TARGET_PX)
      expect(box.width).toBeGreaterThanOrEqual(TOUCH_TARGET_PX)
    }
    const plus = await page.getByRole('button', { name: he.leaves.new }).boundingBox()
    if (plus === null) throw new Error('no +')
    expect(plus.height).toBeGreaterThanOrEqual(TOUCH_TARGET_PX)
  })
})

test('a link opens the new-leave form', async ({ page }) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)
  await page.goto('/?panel=leaves&entity=new')
  await expect(drawer(page).getByRole('heading', { name: he.leaves.noTypesTitle })).toBeVisible()
})
