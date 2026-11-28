import { expect, test, type Locator, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { createSoldier, openSoldierCard } from './support/soldiers.ts'
import { NOW, board, closeDrawer, createType, drawer, leavesOf, openRotationInNewUnit, press, requestLeave } from './support/leaves.ts'
import { addFilter, builder, chooseValues, clearConditions, closeBuilder, conditions, openBuilder, optionsMenu, pick } from './support/board.ts'
import { enterAsOwner, expectNoAxeViolations, openBoardOnTimeline, openModule, OWNER, openTab, waitForSettledScreen } from './support/workspace.ts'

// V6's demo: tag categories and tags, a soldier's tags, the set conditions under the options' "סינון" (D-480), leave
// conditions, "only who is missing" gone (D-463), and the present and absent lists, on desktop and mobile, RTL, with
// axe. Sample data, tests only.

const TOUCH_TARGET_PX = 44

/** A set condition, under the options' "סינון": named by its condition and values, as a person reads it. */
function chip(page: Page, condition: string, values: string) {
  return optionsMenu(page).getByRole('button', { name: new RegExp(`^${condition}\\s?:\\s?${values}$`) })
}

/** The options' icon says whether a value is not the default (D-480): no condition, no sort or grouping set. */
function plainOptions(page: Page) {
  return page.getByRole('button', { name: he.board.options, exact: true })
}

async function expectCondition(page: Page, condition: string, values: string) {
  await conditions(page)
  await expect(chip(page, condition, values)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(optionsMenu(page)).toBeHidden()
}

/** Opens every unit's section of the day report. */
async function expectUnitsOpen(report: Locator) {
  const closed = report.getByRole('heading').getByRole('button', { expanded: false })
  await expect(closed.first()).toBeVisible()
  while ((await closed.count()) > 0) await closed.first().click()
}

function rowNames(page: Page) {
  return board(page).getByRole('list', { name: he.timeline.names }).getByRole('button', { name: /^[^,]+$/ })
}

/** Tags and their categories are each their own module of the setup (D-285); the step moves to the one it needs. */
async function switchTo(page: Page, open: string, title: string) {
  if (await drawer(page).getByRole('heading', { name: title, exact: true }).isVisible()) return
  await closeDrawer(page)
  await openModule(page, open)
}

async function createCategory(page: Page, name: string, color: string, single = false) {
  await switchTo(page, he.tagCategories.open, he.tagCategories.title)
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
  await switchTo(page, he.tags.open, he.tags.title)
  await drawer(page).getByRole('button', { name: he.tags.new }).first().click()
  await page.getByLabel(he.tags.name).fill(name)
  await drawer(page).getByRole('button', { name: new RegExp(`${he.tags.category}$`) }).click()
  await page.getByRole('option', { name: category, exact: true }).click()
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(drawer(page).getByRole('list', { name: category })).toContainText(name)
}


// The steps read the timeline's bars, which a phone opens only when asked (D-290).
test.beforeEach(async ({ page, isMobile }) => {
  await openBoardOnTimeline(page, isMobile)
})

test('tags, the set conditions, no "only who is missing", and who is present today', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)

  await test.step('categories and tags in their own drawer', async () => {
    await openModule(page, he.tags.open)
    // With no category yet, a tag's form makes one in place, named "כללי", and chooses it (D-285).
    await expect(drawer(page).getByRole('heading', { name: he.tags.emptyTitle })).toBeVisible()
    await drawer(page).getByRole('button', { name: he.tags.new }).first().click()
    await page.getByLabel(he.tags.name).fill('מילואים')
    await drawer(page).getByRole('button', { name: he.tagCategories.new }).click()
    const inPlace = page.getByRole('dialog', { name: he.tagCategories.new })
    await expect(inPlace.getByLabel(he.tagCategories.name)).toHaveValue(he.tags.firstCategoryName)
    await expectNoAxeViolations(page)
    await inPlace.locator('label').filter({ has: page.getByRole('radio', { name: he.palette.orange, exact: true }) }).click()
    await inPlace.getByRole('button', { name: he.common.create }).click()
    await expect(inPlace).toBeHidden()
    await expect(drawer(page).getByRole('button', { name: new RegExp(`${he.tags.category}$`) })).toContainText(he.tags.firstCategoryName)
    await page.getByRole('button', { name: he.common.create }).click()
    await expect(drawer(page).getByRole('list', { name: he.tags.firstCategoryName })).toContainText('מילואים')
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
    await createSoldier(page, 'יעל', 'שחר')
    await createSoldier(page, 'נועם', 'לב')
    await openSoldierCard(page, 'יעל שחר', { full: true })
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
    // A saved profile stays in the card; a refusal would show an alert.
    await expect(page.getByRole('alert')).toHaveCount(0)
    await closeDrawer(page)
  })

  await test.step('a rotation they all serve in, so the board and its filters are there (D-218)', async () => {
    await openRotationInNewUnit(page, [OWNER.name, 'יעל שחר', 'נועם לב'])
  })

  await test.step('a tag chip keeps who holds the tag, in the URL', async () => {
    await expect(rowNames(page)).toHaveCount(3)
    await addFilter(page, 'תפקיד', ['חובש'])
    await expectCondition(page, 'תפקיד', 'חובש')
    await expect(rowNames(page)).toHaveText(['יעל שחר'])
    await expect(page).toHaveURL(/filter=/)
    await expectNoAxeViolations(page)
    await page.reload()
    await expect(rowNames(page)).toHaveText(['יעל שחר'])
    await testInfo.attach('filter-row', { body: await page.screenshot(), contentType: 'image/png' })
    // "ניקוי הסינון" removes every condition, and the options' dot goes with them (D-480).
    await clearConditions(page)
    await expect(rowNames(page)).toHaveCount(3)
    await expect(plainOptions(page)).toBeVisible()
  })

  await test.step('the builder: "none of", a second rule joined by "or", and a chip that opens its rule (D-312)', async () => {
    await addFilter(page, 'תפקיד', ['חובש'], he.filters.operators.noneOf)
    await expectCondition(page, `תפקיד ${he.filters.operators.noneOf}`, 'חובש')
    await expect(rowNames(page)).toHaveText(['נועם לב', OWNER.name])
    await openBuilder(page)
    await builder(page).getByRole('button', { name: he.filters.add, exact: true }).click()
    await pick(page, he.filters.field, 'מצב משפחתי')
    // A rule still without a value lives only in the builder: the board does not change for it.
    await expect(rowNames(page)).toHaveCount(2)
    await chooseValues(page, 'מצב משפחתי', ['נשוי'])
    await expect(rowNames(page)).toHaveCount(0)
    await pick(page, he.filters.match, he.filters.or)
    await expect(rowNames(page)).toHaveCount(3)
    await expectNoAxeViolations(page)
    await testInfo.attach('builder', { body: await page.screenshot(), contentType: 'image/png' })
    await closeBuilder(page)
    // A condition under "סינון" opens its rule in the builder, which still joins the two by "או".
    await conditions(page)
    await chip(page, 'מצב משפחתי', 'נשוי').click()
    await expect(builder(page).getByRole('button', { name: new RegExp(`^${he.filters.values} מצב משפחתי`) })).toBeFocused()
    await expect(builder(page).getByRole('button', { name: new RegExp(he.filters.match) })).toContainText(he.filters.or)
    await closeBuilder(page)
    await clearConditions(page)
    await expect(plainOptions(page)).toBeVisible()
  })

  await test.step('sort rows: a key and its direction, then another to break ties (D-313)', async () => {
    await openBuilder(page)
    await pick(page, he.workspace.sortBy, he.workspace.sortKeys.name)
    await pick(page, he.workspace.sortOrder, he.workspace.sortOrders.desc)
    // A name sorts by the family name, then the first.
    await expect(rowNames(page)).toHaveText(['יעל שחר', OWNER.name, 'נועם לב'])
    await expect(page).toHaveURL(/sorts=/)
    await builder(page).getByRole('button', { name: he.workspace.addSort }).click()
    const moveUp = builder(page).getByRole('button', { name: he.workspace.moveUp })
    await expect(moveUp).toHaveCount(2)
    await expect(moveUp.first()).toBeDisabled()
    await moveUp.last().click()
    // No one holds a rank, so the name, now second, still breaks every tie.
    await expect(builder(page).getByRole('button', { name: new RegExp(he.workspace.sortBy) }).first()).toContainText(he.workspace.sortKeys.rank)
    await expect(rowNames(page)).toHaveText(['יעל שחר', OWNER.name, 'נועם לב'])
    await expectNoAxeViolations(page)
    await builder(page).getByRole('button', { name: he.workspace.removeSort }).first().click()
    await builder(page).getByRole('button', { name: he.workspace.removeSort }).first().click()
    await expect(builder(page).getByRole('button', { name: he.workspace.removeSort })).toHaveCount(0)
    await closeBuilder(page)
  })

  await test.step('leaves, and a leave-status chip keeps who has a pending one', async () => {
    await openModule(page, he.leaveTypes.open)
    await createType(page, { name: 'רגילה', color: he.palette.teal })
    await closeDrawer(page)
    await requestLeave(page, { type: 'רגילה', from: ['10', '11', '2026'], to: ['12', '11', '2026'], approveNow: true })
    await expect(leavesOf(page)).toHaveCount(1)
    await addFilter(page, he.filters.leaveStatus, [he.leaves.statusPending])
    await expect(page.getByRole('heading', { level: 2, name: he.timeline.emptyFilterTitle })).toBeVisible()
    await expectNoAxeViolations(page)
    await clearConditions(page)
    await addFilter(page, he.filters.leaveStatus, [he.leaves.statusApproved])
    await expect(rowNames(page)).toHaveText([OWNER.name])
    await clearConditions(page)
  })

  await test.step('"only who is missing" is gone (D-463): an old link to it opens the whole board', async () => {
    await page.goto('/?tab=board&missing=true')
    await expect(rowNames(page)).toHaveCount(3)
    await expect(plainOptions(page)).toBeVisible()
    await conditions(page)
    await expect(optionsMenu(page).getByRole('button', { name: he.board.clearConditions })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expectNoAxeViolations(page)
  })

  await test.step('who is missing today, and who is present', async () => {
    // Today's report opens from the commander's block of "היום" (D-454).
    await openTab(page, 'today')
    await page.getByRole('button', { name: he.presence.title, exact: true }).click()
    const report = page.getByRole('dialog', { name: he.presence.title })
    await expectUnitsOpen(report)
    await expect(report.getByRole('heading', { name: `${he.presence.absent} 1`, exact: true })).toBeVisible()
    await expect(report.getByRole('heading', { name: `${he.presence.present} 2`, exact: true })).toBeVisible()
    await expect(report).toContainText(OWNER.name)
    // The type stands beside a name only while the reasons show (D-194).
    await expect(report).not.toContainText('רגילה')
    await press(page, 'switch', he.presence.reasons)
    await expect(report).toContainText('רגילה')
    await expectNoAxeViolations(page)
    await testInfo.attach('presence', { body: await page.screenshot(), contentType: 'image/png' })
    // Friday 13 November: the leave ended the day before.
    await report.getByRole('button', { name: he.presence.nextDay }).click()
    await report.getByRole('button', { name: he.presence.nextDay }).click()
    await expect(report.getByText(he.presence.noneAbsent)).toBeVisible()
    await expect(page).toHaveURL(/day=2026-11-13/)
    await report.getByRole('button', { name: he.presence.today, exact: true }).click()
    await expect(page).not.toHaveURL(/day=2026-11-13/)
    await expect(report.getByText(he.presence.noneAbsent)).toBeHidden()
    // Left on another day, the report opens again on today from its destination (D-134, D-252).
    await report.getByRole('button', { name: he.presence.nextDay }).click()
    await expect(page).toHaveURL(/day=/)
    // The ✕ shows its name where the pointer rests on it, and showing it moves nothing: the press still lands on ✕.
    const close = report.getByRole('button', { name: he.common.close })
    // The sheet fits what it holds: it is measured once its height has come to rest as the day's names arrive.
    await waitForSettledScreen(page)
    await expect(async () => {
      const first = await close.boundingBox()
      await page.waitForTimeout(300)
      expect(await close.boundingBox()).toEqual(first)
    }).toPass()
    const closeBox = await close.boundingBox()
    await close.hover()
    await expect(page.getByRole('tooltip')).toHaveText(he.common.close)
    expect(await close.boundingBox()).toEqual(closeBox)
    await close.click()
    await expect(report).toBeHidden()
    await page.getByRole('button', { name: he.presence.title, exact: true }).click()
    await expect(page).not.toHaveURL(/day=/)
    await expect(report.getByText(he.presence.noneAbsent)).toBeHidden()
    // The pointer rests where the button was, now over a control of the report: its tooltip would take the first
    // Escape, as a tooltip does. The pointer moves away and the tooltip goes, so Escape reaches the report.
    await page.mouse.move(0, 0)
    await expect(page.getByRole('tooltip')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(report).toBeHidden()
  })

  await test.step('a filter the builder does not read keeps its leave conditions beside it', async () => {
    const filter = encodeURIComponent(JSON.stringify({
      where: { kind: 'or', nodes: [{ kind: 'soldier_status', statuses: ['active'] }, { kind: 'seniority', min: 0, max: null }] },
    }))
    const leaves = encodeURIComponent(JSON.stringify({ statuses: ['approved'] }))
    await page.goto(`/?filter=${filter}&leaves=${leaves}`)
    await conditions(page)
    await expect(optionsMenu(page).getByRole('button', { name: `${he.filters.remove} ${he.filters.other}` })).toBeVisible()
    await expect(chip(page, he.filters.leaveStatus, he.leaves.statusApproved)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(rowNames(page)).toHaveText([OWNER.name])
    // The kept rule cannot be shown in the builder: the options remove it alone, and the leave condition stays.
    await conditions(page)
    await optionsMenu(page).getByRole('button', { name: `${he.filters.remove} ${he.filters.other}` }).click()
    await expect(optionsMenu(page).getByRole('button', { name: `${he.filters.remove} ${he.filters.other}` })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expectCondition(page, he.filters.leaveStatus, he.leaves.statusApproved)
    await expectNoAxeViolations(page)
    await clearConditions(page)
  })

  if (testInfo.project.name === 'mobile') {
    await test.step('on a phone, every control of the options is a 44 px target', async () => {
      await addFilter(page, 'תפקיד', ['נהג'])
      await conditions(page)
      for (const control of await optionsMenu(page).getByRole('button').all()) {
        const box = await control.boundingBox()
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET_PX)
      }
      await testInfo.attach('mobile-options', { body: await page.screenshot(), contentType: 'image/png' })
    })
  }
})
