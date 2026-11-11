import { expect, test, type Locator, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { enterAsOwner, expectNoAxeViolations, openModule } from './support/workspace.ts'

// V2's demo: ranks and soldiers, from a name to a unit history, on desktop and mobile, RTL, with axe.
// Sample data, tests only.

const TOUCH_TARGET_PX = 44
const LONG_LIST = 300

function soldierList(page: Page) {
  return page.getByRole('list', { name: he.soldiers.listLabel })
}

function soldierRow(page: Page, name: string): Locator {
  return soldierList(page)
    .getByRole('listitem')
    .filter({ has: page.getByText(name, { exact: true }) })
}

function rankList(page: Page) {
  return page.getByRole('list', { name: he.commandRanks.listLabel })
}

function rankRow(page: Page, title: string): Locator {
  return rankList(page)
    .getByRole('listitem')
    .filter({ has: page.getByText(title, { exact: true }) })
}

async function openSoldiers(page: Page) {
  await openModule(page, he.soldiers.open)
  await expect(page.getByRole('heading', { name: he.soldiers.title, exact: true })).toBeVisible()
}

async function openRanks(page: Page) {
  await page.getByRole('button', { name: he.soldiers.tabRanks }).click()
  await expect(page.getByLabel(he.commandRanks.name).or(page.getByText(he.commandRanks.emptyTitle)).or(rankList(page)).first()).toBeVisible()
}

async function closeDrawer(page: Page) {
  await page.getByRole('button', { name: he.common.close }).click()
}

async function createRank(page: Page, title: string, seniority?: string) {
  await page.getByRole('button', { name: he.commandRanks.new }).first().click()
  await page.getByLabel(he.commandRanks.name).fill(title)
  if (seniority !== undefined) await page.getByLabel(he.commandRanks.seniority, { exact: true }).fill(seniority)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(rankRow(page, title)).toBeVisible()
}

async function createUnits(page: Page, ...names: string[]) {
  await openModule(page, he.units.open)
  for (const name of names) {
    await page.getByRole('button', { name: he.units.new }).first().click()
    await page.getByLabel(he.units.name).fill(name)
    await page.getByRole('button', { name: he.common.create }).click()
    await expect(page.getByRole('list', { name: he.units.listLabel }).getByText(name, { exact: true })).toBeVisible()
  }
  await closeDrawer(page)
}

/** Picks from a select inside the topmost dialog. What a modal makes inert is still found by role. */
async function choose(page: Page, label: string, option: string) {
  await page.getByRole('dialog').last().getByRole('button', { name: new RegExp(`${label}$`) }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

/** Types a day into a date field: its segments take day, month and year in Hebrew order. */
async function typeDate(page: Page, label: string, day: string, month: string, year: string) {
  const field = page.getByRole('group', { name: label })
  await field.getByRole('spinbutton').first().click()
  await page.keyboard.type(`${day}${month}${year}`)
}

async function startNewSoldier(page: Page, firstName: string, lastName: string) {
  await page.getByRole('button', { name: he.soldiers.new }).first().click()
  await page.getByLabel(he.soldiers.firstName).fill(firstName)
  await page.getByLabel(he.soldiers.lastName).fill(lastName)
}

async function createSoldier(page: Page, firstName: string, lastName: string) {
  await startNewSoldier(page, firstName, lastName)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(soldierRow(page, `${firstName} ${lastName}`)).toBeVisible()
}

async function openSoldier(page: Page, name: string) {
  await soldierRow(page, name).getByRole('button', { name: new RegExp(name) }).click()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
}

async function archiveRow(row: Locator, page: Page) {
  await row.getByRole('button', { name: he.common.actions }).click()
  await page.getByRole('menuitem', { name: he.common.archive }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: he.common.archive }).click()
}

/** Rows written straight into the store, for a state no one types by hand. */
async function seedSoldiers(page: Page, count: number) {
  await page.evaluate(async (total) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('sagol')
      request.onsuccess = () => {
        resolve(request.result)
      }
      request.onerror = () => {
        reject(new Error('no store'))
      }
    })
    const organizations = database.transaction('organizations').objectStore('organizations').getAll()
    const organizationId = await new Promise<string>((resolve) => {
      organizations.onsuccess = () => {
        const rows: { id: string }[] = organizations.result
        resolve(rows[0]?.id ?? '')
      }
    })
    const at = new Date().toISOString()
    const writing = database.transaction('soldiers', 'readwrite')
    for (let index = 0; index < total; index += 1) {
      writing.objectStore('soldiers').put({
        id: crypto.randomUUID(),
        organization_id: organizationId,
        first_name: `חייל${String(index).padStart(3, '0')}`,
        last_name: 'בדיקה',
        nickname: null,
        command_rank_id: null,
        status: 'active',
        properties: {},
        created_at: at,
        created_by: null,
        updated_at: at,
        updated_by: null,
        version: 1,
        archived_at: null,
      })
    }
    await new Promise<void>((resolve) => {
      writing.oncomplete = () => {
        resolve()
      }
    })
    database.close()
  }, count)
}

test.beforeEach(async ({ page }) => {
  await enterAsOwner(page)
})

test('ranks: most senior first, editable, and kept while someone holds them', async ({ page }) => {
  await openSoldiers(page)
  await openRanks(page)
  await expect(page.getByText(he.commandRanks.emptyTitle)).toBeVisible()
  await expectNoAxeViolations(page)

  await createRank(page, 'לוחם')
  await createRank(page, 'מפקד כיתה')
  await createRank(page, 'מפקד מחלקה', '1')
  await expectNoAxeViolations(page)

  const titles = () => rankList(page).getByRole('listitem').evaluateAll((rows) => rows.map((row) => row.querySelector('.font-semibold')?.textContent))
  // A new rank starts one above the most senior, so the second is on top, and the 1 ties with the first.
  await expect.poll(async () => (await titles())[0]).toBe('מפקד כיתה')

  await rankRow(page, 'מפקד מחלקה').getByRole('button', { name: /מפקד מחלקה/ }).click()
  await page.getByLabel(he.commandRanks.seniority, { exact: true }).fill('abc')
  await page.getByRole('button', { name: he.common.save }).click()
  await expect(page.getByText(he.issues.invalidType)).toBeVisible()
  await page.getByLabel(he.commandRanks.seniority, { exact: true }).fill('9')
  await page.getByRole('button', { name: he.common.save }).click()
  await expect.poll(async () => (await titles())[0]).toBe('מפקד מחלקה')

  await page.getByRole('button', { name: he.soldiers.tabList }).click()
  await startNewSoldier(page, 'אורי', 'כהן')
  await choose(page, he.soldiers.rank, 'לוחם')
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(soldierRow(page, 'אורי כהן').getByText('לוחם', { exact: true })).toBeVisible()

  await openRanks(page)
  await archiveRow(rankRow(page, 'לוחם'), page)
  await expect(page.getByRole('alert')).toHaveText(he.issues.rankInUse)
  await expect(rankRow(page, 'לוחם')).toBeVisible()

  await archiveRow(rankRow(page, 'מפקד כיתה'), page)
  await expect(rankRow(page, 'מפקד כיתה')).toHaveCount(0)
})

test('a soldier needs only a name, and a rank and a unit show on the row', async ({ page }) => {
  await createUnits(page, 'מחלקה א')
  await openSoldiers(page)
  await expect(soldierRow(page, 'דנה לוי')).toBeVisible()
  await expectNoAxeViolations(page)

  await page.getByRole('button', { name: he.soldiers.new }).first().click()
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(page.getByText(he.issues.required).first()).toBeVisible()
  await expectNoAxeViolations(page)
  await page.getByRole('button', { name: he.common.cancel }).click()

  await createSoldier(page, 'נועם', 'בר')
  await expect(soldierRow(page, 'נועם בר').getByText(he.soldiers.noUnit, { exact: true })).toBeVisible()

  await startNewSoldier(page, 'יעל', 'שחר')
  await choose(page, he.soldiers.unit, 'מחלקה א')
  await page.getByLabel(he.soldiers.personalId).fill('1234567')
  await page.getByLabel(he.soldiers.phone).fill('050-1234567')
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(soldierRow(page, 'יעל שחר').getByText('מחלקה א', { exact: true })).toBeVisible()

  await page.reload()
  await expect(soldierRow(page, 'יעל שחר').getByText('מחלקה א', { exact: true })).toBeVisible()
  await openSoldier(page, 'יעל שחר')
  await expect(page.getByLabel(he.soldiers.personalId)).toHaveValue('1234567')
  await expect(page.getByLabel(he.soldiers.phone)).toHaveValue('050-1234567')
  await expectNoAxeViolations(page)
})

test('editing a profile and private fields, with one personal number per person', async ({ page }) => {
  await openSoldiers(page)
  await createSoldier(page, 'נועם', 'בר')
  await openSoldier(page, 'נועם בר')
  await page.getByLabel(he.soldiers.nickname).fill('נועמי')
  await choose(page, he.soldiers.status, he.soldiers.statusInactive)
  await page.getByRole('button', { name: he.common.save }).first().click()
  await expect(soldierRow(page, 'נועם בר').getByText(he.soldiers.statusInactive, { exact: true })).toBeVisible()

  await openSoldier(page, 'נועם בר')
  await page.getByLabel(he.soldiers.personalId).fill('012-345')
  await page.getByRole('button', { name: he.common.save }).last().click()
  await expect(soldierRow(page, 'נועם בר')).toBeVisible()
  await openSoldier(page, 'נועם בר')
  await expect(page.getByLabel(he.soldiers.personalId)).toHaveValue('12345')
  await page.getByRole('button', { name: he.common.backToList }).click()

  await createSoldier(page, 'יעל', 'שחר')
  await openSoldier(page, 'יעל שחר')
  await page.getByLabel(he.soldiers.personalId).fill('12 345')
  await page.getByRole('button', { name: he.common.save }).last().click()
  await expect(page.getByText(he.issues.alreadyExists)).toBeVisible()
})

test('moving between units keeps history, and a mistake on the first day leaves none', async ({ page }) => {
  await createUnits(page, 'מחלקה א', 'מחלקה ב', 'מחלקה ג')
  await openSoldiers(page)

  await startNewSoldier(page, 'יעל', 'שחר')
  await choose(page, he.soldiers.unit, 'מחלקה א')
  await typeDate(page, he.soldiers.placedFrom, '01', '01', '2026')
  await page.getByRole('button', { name: he.common.create }).click()
  await openSoldier(page, 'יעל שחר')

  const history = page.getByRole('list', { name: he.soldiers.historyLabel }).getByRole('listitem')
  await expect(history).toHaveCount(1)

  // A date before the placement is refused on its field.
  await page.getByRole('button', { name: he.soldiers.moveOpen }).click()
  await expectNoAxeViolations(page)
  await choose(page, he.soldiers.unit, 'מחלקה ב')
  await typeDate(page, he.soldiers.moveDate, '01', '01', '2020')
  await page.getByRole('button', { name: he.soldiers.moveSubmit, exact: true }).click()
  await expect(page.getByText(he.issues.rangeInverted)).toBeVisible()
  await page.getByRole('button', { name: he.common.cancel }).last().click()

  // The default date is today: the old row closes and a new one opens.
  await page.getByRole('button', { name: he.soldiers.moveOpen }).click()
  await choose(page, he.soldiers.unit, 'מחלקה ב')
  await page.getByRole('button', { name: he.soldiers.moveSubmit, exact: true }).click()
  await expect(history).toHaveCount(2)
  await expect(history.first()).toContainText('מחלקה ב')
  await expect(history.last()).toContainText('מחלקה א')
  await expectNoAxeViolations(page)

  // Again today, on the new row's first day: corrected in place.
  await page.getByRole('button', { name: he.soldiers.moveOpen }).click()
  await choose(page, he.soldiers.unit, 'מחלקה ג')
  await page.getByRole('button', { name: he.soldiers.moveSubmit, exact: true }).click()
  await expect(history).toHaveCount(2)
  await expect(history.first()).toContainText('מחלקה ג')

  // Leaving on that first day is refused, and the form asks for a later date.
  await page.getByRole('button', { name: he.soldiers.moveOpen }).click()
  await choose(page, he.soldiers.unit, he.soldiers.noUnit)
  await page.getByRole('button', { name: he.soldiers.moveSubmit, exact: true }).click()
  await expect(page.getByText(he.issues.rangeInverted)).toBeVisible()
  await page.getByRole('button', { name: he.common.cancel }).last().click()

  await page.getByRole('button', { name: he.common.backToList }).click()
  await expect(soldierRow(page, 'יעל שחר').getByText('מחלקה ג', { exact: true })).toBeVisible()
})

test('an archived unit keeps its name in history, marked as archived', async ({ page }) => {
  await createUnits(page, 'מחלקה א', 'מחלקה ב')
  await openSoldiers(page)
  await startNewSoldier(page, 'יעל', 'שחר')
  await choose(page, he.soldiers.unit, 'מחלקה א')
  await typeDate(page, he.soldiers.placedFrom, '01', '01', '2026')
  await page.getByRole('button', { name: he.common.create }).click()
  await openSoldier(page, 'יעל שחר')
  await page.getByRole('button', { name: he.soldiers.moveOpen }).click()
  await choose(page, he.soldiers.unit, 'מחלקה ב')
  await page.getByRole('button', { name: he.soldiers.moveSubmit, exact: true }).click()
  const history = page.getByRole('list', { name: he.soldiers.historyLabel }).getByRole('listitem')
  await expect(history).toHaveCount(2)
  await closeDrawer(page)

  await openModule(page, he.units.open)
  const row = page.getByRole('list', { name: he.units.listLabel }).getByRole('listitem').filter({ hasText: 'מחלקה א' })
  await row.getByRole('button', { name: he.common.actions }).click()
  await page.getByRole('menuitem', { name: he.common.archive }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: he.common.archive }).click()
  await expect(row).toHaveCount(0)
  await closeDrawer(page)

  await openSoldiers(page)
  await openSoldier(page, 'יעל שחר')
  await expect(history.last()).toContainText('מחלקה א')
  await expect(history.last().getByText(he.soldiers.unitArchived)).toBeVisible()
})

test('archiving warns, removes the soldier, and is refused for the last access manager', async ({ page }) => {
  await openSoldiers(page)
  await createSoldier(page, 'נועם', 'בר')

  await soldierRow(page, 'נועם בר').getByRole('button', { name: he.common.actions }).click()
  await page.getByRole('menuitem', { name: he.common.archive }).click()
  await expect(page.getByRole('alertdialog')).toContainText(he.soldiers.archiveBody)
  await expectNoAxeViolations(page)
  await page.getByRole('alertdialog').getByRole('button', { name: he.common.archive }).click()
  await expect(soldierRow(page, 'נועם בר')).toHaveCount(0)

  await archiveRow(soldierRow(page, 'דנה לוי'), page)
  await expect(page.getByRole('alert')).toHaveText(he.issues.lastAccessManager)
  await expect(soldierRow(page, 'דנה לוי')).toBeVisible()

  await openSoldier(page, 'דנה לוי')
  await choose(page, he.soldiers.status, he.soldiers.statusInactive)
  await page.getByRole('button', { name: he.common.save }).first().click()
  await expect(page.getByRole('alert')).toContainText(he.issues.lastAccessManager)
})

test('search finds by any name, ignoring final letters', async ({ page }) => {
  await openSoldiers(page)
  await createSoldier(page, 'יוסף', 'כהן')
  await createSoldier(page, 'נועם', 'בר')

  const search = page.getByLabel(he.soldiers.search)
  await search.fill('יוספ')
  await expect(soldierRow(page, 'יוסף כהן')).toBeVisible()
  await expect(soldierRow(page, 'נועם בר')).toHaveCount(0)
  await search.fill('בר נועם')
  await expect(soldierRow(page, 'נועם בר')).toBeVisible()
  await search.fill('אין כזה')
  await expect(page.getByText(he.soldiers.noResults)).toBeVisible()
  await expectNoAxeViolations(page)
})

test('a long list renders what is in sight, and reaches its last row', async ({ page }) => {
  await seedSoldiers(page, LONG_LIST)
  await page.reload()
  await openSoldiers(page)
  const rows = soldierList(page).getByRole('listitem')
  await expect(rows.first()).toBeVisible()
  expect(await rows.count()).toBeLessThan(LONG_LIST / 3)
  await expect(rows.first()).toHaveAttribute('aria-setsize', String(LONG_LIST + 1))
  await expectNoAxeViolations(page)

  await page.getByRole('list', { name: he.soldiers.listLabel }).evaluate((list) => {
    const scroller = list.closest('.overflow-y-auto')
    scroller?.scrollTo({ top: scroller.scrollHeight })
  })
  await expect(soldierRow(page, 'חייל299 בדיקה')).toBeVisible()
  await expect(soldierRow(page, 'חייל000 בדיקה')).toHaveCount(0)

  await page.getByLabel(he.soldiers.search, { exact: true }).evaluate((input) => {
    input.closest('.overflow-y-auto')?.scrollTo({ top: 0 })
  })
  await page.getByLabel(he.soldiers.search).fill('חייל150')
  await expect(rows).toHaveCount(1)
})

test('a deep link reopens a soldier, and a second tab follows', async ({ page, context }) => {
  await openSoldiers(page)
  await createSoldier(page, 'יעל', 'שחר')
  await openSoldier(page, 'יעל שחר')
  const link = page.url()

  const other = await context.newPage()
  await other.goto(link)
  await expect(other.getByRole('heading', { name: 'יעל שחר', exact: true })).toBeVisible()
  await other.getByRole('button', { name: he.common.backToList }).click()
  await expect(soldierRow(other, 'יעל שחר')).toBeVisible()

  await page.getByLabel(he.soldiers.firstName).fill('יעלה')
  await page.getByRole('button', { name: he.common.save }).first().click()
  await expect(soldierRow(other, 'יעלה שחר')).toBeVisible()
  await other.close()
})

test('a stale edit gets a clear message, and can continue from the new version', async ({ page, context }) => {
  await openSoldiers(page)
  await createSoldier(page, 'יעל', 'שחר')
  await openSoldier(page, 'יעל שחר')
  const link = page.url()

  const other = await context.newPage()
  await other.goto(link)
  await other.getByLabel(he.soldiers.nickname).fill('מהטאב השני')
  await other.getByRole('button', { name: he.common.save }).first().click()
  await expect(soldierRow(other, 'יעל שחר')).toBeVisible()
  await other.close()

  // The first tab still holds what it opened, so its save answers `stale_version` and overwrites nothing.
  await expect(page.getByLabel(he.soldiers.nickname)).toHaveValue('')
  await page.getByLabel(he.soldiers.nickname).fill('מהטאב הראשון')
  await page.getByRole('button', { name: he.common.save }).first().click()
  await expect(page.getByRole('alert')).toContainText(he.errors.staleVersion)
  await page.getByRole('button', { name: he.common.reloadItem }).click()
  await expect(page.getByLabel(he.soldiers.nickname)).toHaveValue('מהטאב השני')
})

test('controls on a phone are at least 44 px', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only')
  await createUnits(page, 'מחלקה א')
  await openSoldiers(page)
  await createSoldier(page, 'יעל', 'שחר')
  const measure = async (locator: Locator) => (await locator.boundingBox())?.height ?? 0
  expect(await measure(soldierRow(page, 'יעל שחר').getByRole('button', { name: /יעל שחר/ }))).toBeGreaterThanOrEqual(TOUCH_TARGET_PX)
  expect(await measure(soldierRow(page, 'יעל שחר').getByRole('button', { name: he.common.actions }))).toBeGreaterThanOrEqual(TOUCH_TARGET_PX)
  expect(await measure(page.getByLabel(he.soldiers.search))).toBeGreaterThanOrEqual(TOUCH_TARGET_PX)
  await page.getByRole('button', { name: he.soldiers.new }).first().click()
  await choose(page, he.soldiers.unit, 'מחלקה א')
  const dateGroup = page.getByRole('group', { name: he.soldiers.placedFrom })
  expect(await measure(dateGroup)).toBeGreaterThanOrEqual(TOUCH_TARGET_PX)
  await expectNoAxeViolations(page)
})
