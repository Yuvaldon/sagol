import { expect, test } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { TYPE, YAEL_NAME, enterAsYael, setUpFighter, signOut } from './support/fighter.ts'
import { requestLeave } from './support/leaves.ts'
import { OWNER, expectNoAxeViolations, openTab, tab } from './support/workspace.ts'

// "איתך היום" (D-478): a soldier whose role holds `presence:view` sees who of their unit is on base today, by name,
// with no leave, no type and no board. On desktop and mobile, RTL, with axe. Sample data, tests only.

const OMER = { first: 'עומר', last: 'גבאי' }
const RON = { first: 'רון', last: 'אשכנזי' }
const OMER_NAME = `${OMER.first} ${OMER.last}`
const RON_NAME = `${RON.first} ${RON.last}`
const REASON = 'סיבה פרטית'

test('a soldier sees who is on base with them today, by name only', async ({ page }) => {
  await test.step('the owner gives the fighter role the presence pair, and sends Ron home today', async () => {
    await setUpFighter(page, { presence: true, unitmates: [OMER, RON] })
    await requestLeave(page, {
      type: TYPE,
      from: ['11', '11', '2026'],
      to: ['12', '11', '2026'],
      reason: REASON,
      approveNow: true,
      soldier: [RON.first, RON_NAME],
    })
    // Who has "לוח" sees the unit's block, not the card (D-466).
    await openTab(page, 'today')
    await expect(page.getByRole('list', { name: he.today.unitDays })).toBeVisible()
    await expect(page.getByRole('region', { name: he.today.withMe })).toHaveCount(0)
  })

  await test.step('Yael sees Omer on base with her, and nothing of Ron\'s leave', async () => {
    await signOut(page)
    await enterAsYael(page)
    const card = page.getByRole('region', { name: he.today.withMe })
    await expect(card.getByRole('listitem')).toHaveText([OMER_NAME])
    await expect(card).toContainText(`1 ${he.today.withMeCount}`)
    // Not herself, not who is home today nor the owner of another unit, and no type, reason or date of a leave.
    for (const text of [YAEL_NAME, RON_NAME, OWNER.name, TYPE, REASON]) await expect(card).not.toContainText(text)
    // The card opens nothing, and she has no board.
    await expect(card.getByRole('button')).toHaveCount(0)
    await expect(tab(page, 'board')).toHaveCount(0)
    await expectNoAxeViolations(page)
  })
})

test('a soldier who reads nothing else still has "היום", with who is on base with them (D-479)', async ({ page }) => {
  await setUpFighter(page, { presence: true, bare: true, unitmates: [OMER] })
  await signOut(page)
  await enterAsYael(page)
  const card = page.getByRole('region', { name: he.today.withMe })
  await expect(card.getByRole('listitem')).toHaveText([OMER_NAME])
  await expect(page.getByRole('heading', { name: he.timeline.noDayTitle })).toHaveCount(0)
  await expectNoAxeViolations(page)
})

