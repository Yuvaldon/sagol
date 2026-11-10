import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, board, closeDrawer, createType, drawer, leavesOf, press, requestLeave } from './support/leaves.ts'
import { OWNER, enterAsOwner, expectNoAxeViolations, navigation } from './support/workspace.ts'

// V6's demo: tag categories and tags, a soldier's tags, filter chips, leave conditions, "only who is missing" and
// the present and absent lists, on desktop and mobile, RTL, with axe. Sample data, tests only.

const TOUCH_TARGET_PX = 44

function filterBar(page: Page) {
  return page.getByRole('search', { name: he.filters.bar })
}

/** A chip is named by its condition and values, as a person reads it. */
function chip(page: Page, condition: string, values: string) {
  return filterBar(page).getByRole('button', { name: new RegExp(`^${condition}\\s?:\\s?${values}$`) })
}

function rowNames(page: Page) {
  return board(page).getByRole('list', { name: he.timeline.names }).getByRole('button', { name: /^[^,]+$/ })
}

async function createCategory(page: Page, name: string, color: string, single = false) {
  await drawer(page).getByRole('button', { name: he.tags.tabCategories }).click()
  await drawer(page).getByRole('button', { name: he.tagCategories.new }).first().click()
  await page.getByLabel(he.tagCategories.name).fill(name)
  if (single) {
    await drawer(page).getByRole('button', { name: new RegExp(`${he.tagCategories.selectionMode}$`) }).click()
    await page.getByRole('option', { name: he.tagCategories.selectionSingle, exact: true }).click()
  }
  await press(page, 'radio', color)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(drawer(page).getByRole('list', { name: he.tagCategories.listLabel })).toContainText(name)
}

async function createTag(page: Page, name: string, category: string) {
  await drawer(page).getByRole('button', { name: he.tags.tabTags }).click()
  await drawer(page).getByRole('button', { name: he.tags.new }).first().click()
  await page.getByLabel(he.tags.name).fill(name)
  await drawer(page).getByRole('button', { name: new RegExp(`${he.tags.category}$`) }).click()
  await page.getByRole('option', { name: category, exact: true }).click()
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(drawer(page).getByRole('list', { name: category })).toContainText(name)
}

async function createSoldier(page: Page, firstName: string, lastName: string) {
  await drawer(page).getByRole('button', { name: he.soldiers.new }).first().click()
  await page.getByLabel(he.soldiers.firstName).fill(firstName)
  await page.getByLabel(he.soldiers.lastName).fill(lastName)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(drawer(page).getByRole('list', { name: he.soldiers.listLabel }).getByText(`${firstName} ${lastName}`)).toBeVisible()
}

/** Opens a filter chip's choices from "+", by the condition's name, and checks one value. */
async function addCondition(page: Page, condition: string, value: string) {
  await filterBar(page).getByRole('button', { name: he.filters.add }).click()
  await page.getByRole('dialog', { name: he.filters.add }).getByRole('button', { name: condition, exact: true }).click()
  await page.getByRole('dialog', { name: he.filters.add }).locator('label').filter({ hasText: value }).click()
  await page.keyboard.press('Escape')
}

test('tags, filter chips, only who is missing, and who is present today', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)

  await test.step('categories and tags in their own drawer', async () => {
    await navigation(page).getByRole('button', { name: he.tags.open }).click()
    await expect(drawer(page).getByRole('heading', { name: he.tags.needsCategoryTitle })).toBeVisible()
    await createCategory(page, 'תפקיד', he.palette.teal)
    await createCategory(page, 'מצב משפחתי', he.palette.pink, true)
    await createTag(page, 'חובש', 'תפקיד')
    await createTag(page, 'נהג', 'תפקיד')
    await createTag(page, 'רווק', 'מצב משפחתי')
    await createTag(page, 'נשוי', 'מצב משפחתי')
    await expectNoAxeViolations(page)
    await closeDrawer(page)
  })

  await test.step("a soldier's tags, one of a single category", async () => {
    await navigation(page).getByRole('button', { name: he.soldiers.open }).click()
    await createSoldier(page, 'יעל', 'שחר')
    await createSoldier(page, 'נועם', 'לב')
    await drawer(page).getByRole('list', { name: he.soldiers.listLabel }).getByRole('button', { name: /יעל שחר/ }).click()
    await page.getByRole('button', { name: he.soldiers.tagsEdit }).click()
    await press(page, 'checkbox', 'חובש')
    await press(page, 'radio', 'רווק')
    await press(page, 'radio', 'נשוי')
    await expectNoAxeViolations(page)
    await drawer(page).getByRole('button', { name: he.common.save, exact: true }).click()
    const section = drawer(page).locator('section').filter({ has: page.getByRole('heading', { name: he.soldiers.tagsTitle }) })
    await expect(section).toContainText('חובש')
    await expect(section).toContainText('נשוי')
    await expect(section).not.toContainText('רווק')
    // The profile opens again on the soldier's new version, so saving it still works (D-130).
    await page.getByLabel(he.soldiers.nickname).fill('יעלי')
    await drawer(page).getByRole('button', { name: he.common.save, exact: true }).first().click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await closeDrawer(page)
  })

  await test.step('a tag chip keeps who holds the tag, in the URL', async () => {
    await expect(rowNames(page)).toHaveCount(3)
    await addCondition(page, 'תפקיד', 'חובש')
    await expect(chip(page, 'תפקיד', 'חובש')).toBeVisible()
    await expect(rowNames(page)).toHaveText(['יעל שחר'])
    await expect(page).toHaveURL(/filter=/)
    await expectNoAxeViolations(page)
    await page.reload()
    await expect(rowNames(page)).toHaveText(['יעל שחר'])
    await filterBar(page).getByRole('button', { name: `${he.filters.remove} תפקיד` }).click()
    await expect(rowNames(page)).toHaveCount(3)
  })

  await test.step('leaves, and a leave-status chip keeps who has a pending one', async () => {
    await navigation(page).getByRole('button', { name: he.leaveTypes.open }).click()
    await createType(page, { name: 'רגילה', color: he.palette.teal })
    await closeDrawer(page)
    await requestLeave(page, { type: 'רגילה', from: ['10', '11', '2026'], to: ['12', '11', '2026'], approveNow: true })
    await expect(leavesOf(page)).toHaveCount(1)
    await addCondition(page, he.filters.leaveStatus, he.leaves.statusPending)
    await expect(page.getByRole('heading', { level: 2, name: he.timeline.emptyFilterTitle })).toBeVisible()
    await expectNoAxeViolations(page)
    await filterBar(page).getByRole('button', { name: `${he.filters.remove} ${he.filters.leaveStatus}` }).click()
    await addCondition(page, he.filters.leaveStatus, he.leaves.statusApproved)
    await expect(rowNames(page)).toHaveText([OWNER.name])
    await filterBar(page).getByRole('button', { name: `${he.filters.remove} ${he.filters.leaveStatus}` }).click()
  })

  await test.step('only who is missing: the owner, with the days present muted', async () => {
    await filterBar(page).getByRole('switch', { name: he.filters.onlyMissing }).click({ force: true })
    await expect(page).toHaveURL(/missing=true/)
    await expect(rowNames(page)).toHaveText([OWNER.name])
    await expect(board(page).getByText(new RegExp(`${he.timeline.present}: `))).toHaveCount(1)
    await expectNoAxeViolations(page)
    await testInfo.attach('only-missing', { body: await page.screenshot(), contentType: 'image/png' })
    await filterBar(page).getByRole('switch', { name: he.filters.onlyMissing }).click({ force: true })
    await expect(rowNames(page)).toHaveCount(3)
  })

  await test.step('who is missing today, and who is present', async () => {
    const button = filterBar(page).getByRole('button', { name: new RegExp(he.presence.missingToday) })
    await expect(button).toContainText('1')
    await button.click()
    const absent = drawer(page).getByRole('list', { name: new RegExp(he.presence.absent) })
    const present = drawer(page).getByRole('list', { name: new RegExp(he.presence.present) })
    await expect(absent.getByRole('listitem')).toHaveCount(1)
    await expect(absent).toContainText(OWNER.name)
    await expect(absent).toContainText('רגילה')
    await expect(present.getByRole('listitem')).toHaveCount(2)
    await expectNoAxeViolations(page)
    await testInfo.attach('presence', { body: await page.screenshot(), contentType: 'image/png' })
    // Friday 13 November: the leave ended the day before.
    await drawer(page).getByRole('button', { name: he.presence.nextDay }).click()
    await drawer(page).getByRole('button', { name: he.presence.nextDay }).click()
    await expect(drawer(page).getByText(he.presence.noneAbsent)).toBeVisible()
    await expect(page).toHaveURL(/day=2026-11-13/)
    await drawer(page).getByRole('button', { name: he.presence.today, exact: true }).click()
    await expect(absent.getByRole('listitem')).toHaveCount(1)
    // Left on another day, the lists open again on today from the pill (D-134).
    await drawer(page).getByRole('button', { name: he.presence.nextDay }).click()
    await expect(page).toHaveURL(/day=/)
    await closeDrawer(page)
    await button.click()
    await expect(page).not.toHaveURL(/day=/)
    await expect(absent.getByRole('listitem')).toHaveCount(1)
    await closeDrawer(page)
  })

  await test.step('a filter the bar does not read keeps its leave chips beside it', async () => {
    const filter = encodeURIComponent(JSON.stringify({ where: { kind: 'or', nodes: [{ kind: 'soldier_status', statuses: ['active'] }] } }))
    const leaves = encodeURIComponent(JSON.stringify({ statuses: ['approved'] }))
    await page.goto(`/?filter=${filter}&leaves=${leaves}`)
    await expect(filterBar(page).getByText(he.filters.other)).toBeVisible()
    await expect(chip(page, he.filters.leaveStatus, he.leaves.statusApproved)).toBeVisible()
    await expect(rowNames(page)).toHaveText([OWNER.name])
    await filterBar(page).getByRole('button', { name: `${he.filters.remove} ${he.filters.other}` }).click()
    await expect(chip(page, he.filters.leaveStatus, he.leaves.statusApproved)).toBeVisible()
    await expectNoAxeViolations(page)
    await filterBar(page).getByRole('button', { name: `${he.filters.remove} ${he.filters.leaveStatus}` }).click()
  })

  if (testInfo.project.name === 'mobile') {
    await test.step('on a phone, every control of the bar is a 44 px target', async () => {
      await addCondition(page, 'תפקיד', 'נהג')
      for (const control of await filterBar(page).getByRole('button').all()) {
        const box = await control.boundingBox()
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET_PX)
      }
      await testInfo.attach('mobile-bar', { body: await page.screenshot(), contentType: 'image/png' })
    })
  }
})
