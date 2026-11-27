import { expect, test } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { TYPE, YAEL_NAME, enterAsYael, setUpFighter, signOut } from './support/fighter.ts'
import { choose, drawer } from './support/leaves.ts'
import { OWNER, expectNoAxeViolations, openTab, signIn, tab } from './support/workspace.ts'

// "היום" (D-454, D-459, D-467): a soldier marks days in the month and asks for them from the tray; the commander
// answers on the card and on the page of requests, and takes an answer back from the toast; a day column opens the
// unit's drawer. On desktop and mobile, RTL, with axe. Sample data, tests only.

test('a soldier asks for days from the month, and the commander answers on "היום"', async ({ page }) => {
  await setUpFighter(page)
  await signOut(page)
  await enterAsYael(page)
  const strip = page.getByRole('list', { name: he.myLeaves.nextDaysTitle })
  const tray = page.getByRole('group', { name: he.today.selection })

  await test.step('the strip opens into the month, where two taps mark a range and the tray replaces the tab bar', async () => {
    await expect(strip.getByRole('listitem')).toHaveCount(14)
    await page.getByRole('main').getByRole('button', { name: he.today.noOut }).click()
    await expect(strip).toHaveCount(0)
    const days = page.getByRole('gridcell').getByRole('button')
    // A day that has passed takes no request.
    await expect(days.filter({ hasText: '10 בנובמבר' })).toBeDisabled()
    await days.filter({ hasText: '18 בנובמבר' }).click()
    await days.filter({ hasText: '20 בנובמבר' }).click()
    await expect(page.getByRole('gridcell').getByRole('button', { pressed: true })).toHaveCount(3)
    await expect(tray.getByRole('button', { name: `${he.today.requestDays} · 3 ${he.leaves.days}` })).toBeVisible()
    await expect(tab(page, 'today')).toHaveCount(0)
    await expectNoAxeViolations(page)
  })

  await test.step('the tray opens the request with the days filled, and letting go of the days returns the bar', async () => {
    await tray.getByRole('button', { name: he.today.clearSelection }).click()
    await expect(tray).toHaveCount(0)
    await expect(tab(page, 'today')).toBeVisible()
    const days = page.getByRole('gridcell').getByRole('button')
    await days.filter({ hasText: '18 בנובמבר' }).click()
    await days.filter({ hasText: '20 בנובמבר' }).click()
    await tray.getByRole('button', { name: new RegExp(`^${he.today.requestDays}`) }).click()
    await expect(drawer(page).getByRole('heading', { name: he.leaves.newTitle })).toBeVisible()
    await expect(drawer(page).getByRole('combobox', { name: he.leaves.soldier })).toHaveValue(YAEL_NAME)
    await choose(page, he.leaves.type, TYPE)
    await drawer(page).getByRole('button', { name: he.leaves.submit, exact: true }).click()
    await expect(drawer(page)).toBeHidden()
    const mine = page.getByRole('region', { name: he.today.myRequest })
    await expect(mine).toContainText('18–20 בנוב׳')
    await expect(mine.getByText(he.leaves.badgePending, { exact: true })).toBeVisible()
  })

  const waiting = page.getByRole('region', { name: he.today.approvals })
  const toast = page.getByRole('status').filter({ hasText: new RegExp(`${he.today.approved}|${he.today.rejected}`) })

  await test.step('the commander approves on the card, and "ביטול" in the toast takes it back', async () => {
    await signOut(page)
    await signIn(page, OWNER.email)
    await expect(waiting).toContainText(`1 ${he.inbox.pendingCount}`)
    await expectNoAxeViolations(page)
    await waiting.getByRole('button', { name: `${he.leaves.approve} ${YAEL_NAME}` }).click()
    // The card leaves with its last row; the toast stays to say what happened.
    await expect(waiting).toHaveCount(0)
    await expect(toast).toContainText(he.today.approved)
    await expectNoAxeViolations(page)
    await toast.getByRole('button', { name: he.common.cancel }).click()
    await expect(waiting).toContainText(`1 ${he.inbox.pendingCount}`)
    await expect(toast).toHaveCount(0)
  })

  await test.step('the title opens the page of requests, where a rejection asks first', async () => {
    await waiting.getByRole('button', { name: he.today.approvals, exact: true }).click()
    await expect(page).toHaveURL(/page=requests/)
    await expect(page.getByRole('heading', { level: 1, name: he.today.approvals })).toBeVisible()
    await expectNoAxeViolations(page)
    await page.getByRole('button', { name: `${he.leaves.reject} ${YAEL_NAME}` }).click()
    await expect(page.getByRole('heading', { name: he.leaves.rejectTitle })).toBeVisible()
    await page.getByRole('button', { name: he.leaves.reject, exact: true }).click()
    await expect(toast).toContainText(he.today.rejected)
    await expect(page.getByRole('heading', { name: he.inbox.emptyPendingTitle })).toBeVisible()
    await page.getByRole('button', { name: he.shell.back, exact: true }).click()
    await expect(page).not.toHaveURL(/page=/)
    await expect(waiting).toHaveCount(0)
  })

  await test.step('a day column opens the unit\'s drawer, which grows from its handle on a phone', async () => {
    const columns = page.getByRole('list', { name: he.today.unitDays }).getByRole('button')
    await expect(columns).toHaveCount(7)
    await columns.first().click()
    const unit = page.getByRole('dialog')
    await expect(unit.getByRole('heading', { name: new RegExp(`^${he.presence.present}`) })).toBeVisible()
    await expect(unit).toContainText(YAEL_NAME)
    await expectNoAxeViolations(page)
    const grow = unit.getByRole('button', { name: he.kit.drawerGrow })
    if (await grow.isVisible()) {
      await grow.click()
      await expect(unit.getByRole('button', { name: he.kit.drawerShrink })).toHaveAttribute('aria-expanded', 'true')
    }
    await unit.getByRole('button', { name: he.common.close }).click()
    await expect(unit).toHaveCount(0)
  })

  await test.step('the tab in sight returns to the top, and the board keeps its place behind its tab', async () => {
    await openTab(page, 'board')
    await openTab(page, 'today')
    await expect(page.getByRole('list', { name: he.today.unitDays })).toBeVisible()
  })
})
