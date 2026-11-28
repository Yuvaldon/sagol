import { expect, test, type Locator, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { closeDrawers, createSoldier, openNewSoldierForm, openSoldierCard, openSoldiers, soldierRow, soldierRows } from './support/soldiers.ts'
import { addUnit, enterAsOwner, expectNoAxeViolations, openModule } from './support/workspace.ts'

// V2's demo, on the new interface (D-482): ranks and soldiers, from a name to a unit history, through "חיילים" and the
// person card, on desktop and mobile, RTL, with axe. Sample data, tests only.

const LONG_LIST = 300

function rankList(page: Page) {
  return page.getByRole('list', { name: he.commandRanks.listLabel })
}

function rankRow(page: Page, title: string): Locator {
  return rankList(page)
    .getByRole('listitem')
    .filter({ has: page.getByText(title, { exact: true }) })
}

async function openRanks(page: Page) {
  // The ranks are their own module of the setup (D-285): whatever drawer is open closes first.
  await closeDrawers(page)
  await openModule(page, he.commandRanks.open)
  await expect(page.getByLabel(he.commandRanks.name).or(page.getByText(he.commandRanks.emptyTitle)).or(rankList(page)).first()).toBeVisible()
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
    await addUnit(page, name)
  }
  await closeDrawers(page)
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

async function archiveRow(row: Locator, page: Page) {
  await row.getByRole('button', { name: he.common.actions }).click()
  await page.getByRole('menuitem', { name: he.common.archive }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: he.common.archive }).click()
}

/** Archiving from the card's "⋯" (D-461): last in the menu, asked by name. */
async function archiveFromCard(page: Page, name: string) {
  const card = await openSoldierCard(page, name)
  await card.getByRole('button', { name: he.common.actions }).click()
  await page.getByRole('menuitem', { name: he.manage.archive.move }).click()
  await expect(page.getByRole('alertdialog')).toContainText(name)
  return card
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

  await createSoldier(page, 'אורי', 'כהן', async () => {
    await choose(page, he.soldiers.rank, 'לוחם')
  })
  await openSoldiers(page)
  await expect(soldierRow(page, 'אורי כהן')).toContainText('לוחם')

  await openRanks(page)
  await archiveRow(rankRow(page, 'לוחם'), page)
  await expect(page.getByRole('alert')).toHaveText(he.issues.rankInUse)
  await expect(rankRow(page, 'לוחם')).toBeVisible()

  await archiveRow(rankRow(page, 'מפקד כיתה'), page)
  await expect(rankRow(page, 'מפקד כיתה')).toHaveCount(0)
})

test('a soldier needs only a name, and the card shows the unit and the private fields', async ({ page }) => {
  await createUnits(page, 'מחלקה א')
  await openSoldiers(page)
  await expect(soldierRow(page, 'דנה לוי')).toBeVisible()
  await expectNoAxeViolations(page)

  await openNewSoldierForm(page)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(page.getByText(he.issues.required).first()).toBeVisible()
  await expectNoAxeViolations(page)
  await page.getByRole('button', { name: he.common.cancel }).click()

  await createSoldier(page, 'נועם', 'בר')
  await createSoldier(page, 'יעל', 'שחר', async () => {
    await choose(page, he.soldiers.unit, 'מחלקה א')
    await page.getByLabel(he.soldiers.personalId).fill('1234567')
    await page.getByLabel(he.soldiers.phone).fill('050-1234567')
  })

  await page.reload()
  const card = await openSoldierCard(page, 'יעל שחר')
  await expect(card).toContainText('מחלקה א')
  await expect(card.getByText('1234567', { exact: true })).toBeVisible()
  await expect(card.getByText('050-1234567', { exact: true })).toBeVisible()
  await card.getByRole('button', { name: he.manage.person.full }).click()
  await expect(card.getByLabel(he.soldiers.personalId)).toHaveValue('1234567')
  await expect(card.getByLabel(he.soldiers.phone, { exact: true })).toHaveValue('050-1234567')
  await expectNoAxeViolations(page)
})

test('editing a profile and private fields, with one personal number per person', async ({ page }) => {
  await createSoldier(page, 'נועם', 'בר')
  const card = await openSoldierCard(page, 'נועם בר', { full: true })
  await card.getByLabel(he.soldiers.nickname).fill('נועמי')
  await choose(page, he.soldiers.status, he.soldiers.statusInactive)
  await card.getByRole('button', { name: he.common.save }).first().click()
  await expect(card.getByLabel(he.soldiers.nickname)).toHaveValue('נועמי')
  await card.getByLabel(he.soldiers.personalId).fill('012-345')
  await card.getByRole('button', { name: he.common.save }).last().click()
  await expect(card.getByLabel(he.soldiers.personalId)).toHaveValue('12345')
  await closeDrawers(page)
  // The inactive leave the list until it is asked for them (the handoff's Soldiers).
  await expect(soldierRow(page, 'נועם בר')).toHaveCount(0)
  await page.getByRole('button', { name: he.manage.people.options }).click()
  await page.getByRole('button', { name: new RegExp(`^${he.manage.people.inactive}`) }).click()
  const menu = page.getByRole('dialog', { name: he.manage.people.options })
  await menu.locator('label').filter({ has: page.getByRole('radio', { name: he.manage.people.shown, exact: true }) }).click()
  await page.keyboard.press('Escape')
  await expect(soldierRow(page, 'נועם בר')).toContainText(he.manage.people.inactiveMark)

  await createSoldier(page, 'יעל', 'שחר')
  const other = await openSoldierCard(page, 'יעל שחר', { full: true })
  await other.getByLabel(he.soldiers.personalId).fill('12 345')
  await other.getByRole('button', { name: he.common.save }).last().click()
  await expect(page.getByText(he.issues.alreadyExists)).toBeVisible()
})

test('moving between units keeps history, and a mistake on the first day leaves none', async ({ page }) => {
  await createUnits(page, 'מחלקה א', 'מחלקה ב', 'מחלקה ג')
  await createSoldier(page, 'יעל', 'שחר', async () => {
    await choose(page, he.soldiers.unit, 'מחלקה א')
    await typeDate(page, he.soldiers.placedFrom, '01', '01', '2026')
  })
  const card = await openSoldierCard(page, 'יעל שחר', { full: true })

  const history = card.getByRole('list', { name: he.soldiers.historyLabel }).getByRole('listitem')
  await expect(history).toHaveCount(1)

  // A date before the placement is refused on its field.
  await card.getByRole('button', { name: he.soldiers.moveOpen }).click()
  await expectNoAxeViolations(page)
  await choose(page, he.soldiers.unit, 'מחלקה ב')
  await typeDate(page, he.soldiers.moveDate, '01', '01', '2020')
  await page.getByRole('button', { name: he.soldiers.moveSubmit, exact: true }).click()
  await expect(page.getByText(he.issues.rangeInverted)).toBeVisible()
  await page.getByRole('button', { name: he.common.cancel }).last().click()

  // The default date is today: the old row closes and a new one opens.
  await card.getByRole('button', { name: he.soldiers.moveOpen }).click()
  await choose(page, he.soldiers.unit, 'מחלקה ב')
  await page.getByRole('button', { name: he.soldiers.moveSubmit, exact: true }).click()
  await expect(history).toHaveCount(2)
  await expect(history.first()).toContainText('מחלקה ב')
  await expect(history.last()).toContainText('מחלקה א')
  await expectNoAxeViolations(page)

  // Again today, on the new row's first day: corrected in place.
  await card.getByRole('button', { name: he.soldiers.moveOpen }).click()
  await choose(page, he.soldiers.unit, 'מחלקה ג')
  await page.getByRole('button', { name: he.soldiers.moveSubmit, exact: true }).click()
  await expect(history).toHaveCount(2)
  await expect(history.first()).toContainText('מחלקה ג')

  // Leaving on that first day is refused, and the form asks for a later date.
  await card.getByRole('button', { name: he.soldiers.moveOpen }).click()
  await choose(page, he.soldiers.unit, he.soldiers.noUnit)
  await page.getByRole('button', { name: he.soldiers.moveSubmit, exact: true }).click()
  await expect(page.getByText(he.issues.rangeInverted)).toBeVisible()
  await page.getByRole('button', { name: he.common.cancel }).last().click()

  await closeDrawers(page)
  await expect(await openSoldierCard(page, 'יעל שחר')).toContainText('מחלקה ג')
})

test('an archived unit keeps its name in history, marked as archived', async ({ page }) => {
  await createUnits(page, 'מחלקה א', 'מחלקה ב')
  await createSoldier(page, 'יעל', 'שחר', async () => {
    await choose(page, he.soldiers.unit, 'מחלקה א')
    await typeDate(page, he.soldiers.placedFrom, '01', '01', '2026')
  })
  const card = await openSoldierCard(page, 'יעל שחר', { full: true })
  await card.getByRole('button', { name: he.soldiers.moveOpen }).click()
  await choose(page, he.soldiers.unit, 'מחלקה ב')
  await page.getByRole('button', { name: he.soldiers.moveSubmit, exact: true }).click()
  const history = page.getByRole('list', { name: he.soldiers.historyLabel }).getByRole('listitem')
  await expect(history).toHaveCount(2)
  await closeDrawers(page)

  await openModule(page, he.units.open)
  const row = page.getByRole('list', { name: he.units.listLabel }).getByRole('listitem').filter({ hasText: 'מחלקה א' })
  await row.getByRole('button', { name: he.common.actions }).click()
  await page.getByRole('menuitem', { name: he.common.archive }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: he.common.archive }).click()
  await expect(row).toHaveCount(0)

  await openSoldierCard(page, 'יעל שחר', { full: true })
  await expect(history.last()).toContainText('מחלקה א')
  await expect(history.last().getByText(he.soldiers.unitArchived)).toBeVisible()
})

test('archiving warns, removes the soldier, comes back from the archive, and is refused for the last access manager', async ({ page }) => {
  await createSoldier(page, 'נועם', 'בר')

  await archiveFromCard(page, 'נועם בר')
  await expect(page.getByRole('alertdialog')).toContainText(he.soldiers.archiveBody)
  await expectNoAxeViolations(page)
  await page.getByRole('alertdialog').getByRole('button', { name: he.manage.archive.confirm }).click()
  await expect(soldierRow(page, 'נועם בר')).toHaveCount(0)

  // The archive is a drawer of its own, from the options (D-461).
  await page.getByRole('button', { name: he.manage.people.options }).click()
  await page.getByRole('button', { name: `${he.manage.people.archive} · 1` }).click()
  const archive = page.getByRole('dialog', { name: he.manage.archive.title })
  await archive.getByRole('button', { name: /נועם בר/ }).click()
  await archive.getByRole('button', { name: he.manage.archive.restore }).click()
  await closeDrawers(page)
  await expect(soldierRow(page, 'נועם בר')).toBeVisible()

  const card = await archiveFromCard(page, 'דנה לוי')
  await page.getByRole('alertdialog').getByRole('button', { name: he.manage.archive.confirm }).click()
  await expect(card.getByRole('alert')).toContainText(he.issues.lastAccessManager)
  await closeDrawers(page)
  await expect(soldierRow(page, 'דנה לוי')).toBeVisible()

  const full = await openSoldierCard(page, 'דנה לוי', { full: true })
  await choose(page, he.soldiers.status, he.soldiers.statusInactive)
  await full.getByRole('button', { name: he.common.save }).first().click()
  await expect(page.getByRole('alert')).toContainText(he.issues.lastAccessManager)
})

test('search finds by any name, ignoring final letters', async ({ page }) => {
  await createSoldier(page, 'יוסף', 'כהן')
  await createSoldier(page, 'נועם', 'בר')
  await openSoldiers(page)

  await page.getByRole('button', { name: he.manage.people.search, exact: true }).click()
  const search = page.getByLabel(he.manage.people.searchLabel)
  await search.fill('יוספ')
  await expect(soldierRow(page, 'יוסף כהן')).toBeVisible()
  await expect(soldierRow(page, 'נועם בר')).toHaveCount(0)
  await search.fill('בר נועם')
  await expect(soldierRow(page, 'נועם בר')).toBeVisible()
  await search.fill('אין כזה')
  await expect(page.getByText(he.manage.people.noResults)).toBeVisible()
  await expectNoAxeViolations(page)
})

test('a long list reaches its last row, and the search narrows it to one', async ({ page }) => {
  await seedSoldiers(page, LONG_LIST)
  await page.reload()
  await openSoldiers(page)
  const rows = soldierRows(page)
  await expect(page.getByRole('main').getByText(`${String(LONG_LIST + 1)} ${he.manage.people.count}`)).toBeVisible()
  // Only the rows in sight are in the page (OI-403); the page's scroll brings the last one.
  await expect(rows.first()).toBeVisible()
  expect(await rows.count()).toBeLessThan(LONG_LIST + 1)
  await page.getByRole('main').locator('.overflow-y-auto').first().evaluate((scroller) => {
    scroller.scrollTo({ top: scroller.scrollHeight })
  })
  await expect(soldierRow(page, 'חייל299 בדיקה')).toBeVisible()
  await page.getByRole('button', { name: he.manage.people.search, exact: true }).click()
  await page.getByLabel(he.manage.people.searchLabel).fill('חייל150')
  await expect(rows).toHaveCount(1)
})

test('a deep link reopens the card of a soldier, and a second tab follows', async ({ page, context }) => {
  await createSoldier(page, 'יעל', 'שחר')
  const card = await openSoldierCard(page, 'יעל שחר', { full: true })
  const link = page.url()

  const other = await context.newPage()
  await other.goto(link)
  await expect(other.getByRole('dialog', { name: 'יעל שחר' })).toBeVisible()
  await closeDrawers(other)
  await expect(soldierRow(other, 'יעל שחר')).toBeVisible()

  await card.getByLabel(he.soldiers.firstName).fill('יעלה')
  await card.getByRole('button', { name: he.common.save }).first().click()
  await expect(soldierRow(other, 'יעלה שחר')).toBeVisible()
  await other.close()
})

test('a long timeline gives its month to a capsule once scrolled, and the capsule returns it to the top (OI-399)', async ({ page, isMobile }) => {
  // A wide screen keeps its head while it scrolls: its arrows are the mouse's way to step the range (D-496).
  test.skip(!isMobile, 'A phone\'s timeline only')
  await seedSoldiers(page, 40)
  await page.goto('/?tab=board&view=timeline')
  const region = page.getByRole('region', { name: he.timeline.label })
  await expect(region.getByText('חייל039 בדיקה')).toBeAttached()
  const capsule = page.getByRole('button', { name: new RegExp(`^${he.board.toTop} · `) })
  // The rows settle as the board's reads arrive; the scroll is made again until the capsule answers it.
  await expect(async () => {
    await region.evaluate((scroller) => {
      scroller.scrollTo({ top: scroller.scrollHeight })
    })
    await expect(capsule).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: 10_000 })
  await expectNoAxeViolations(page)
  await capsule.click()
  await expect(capsule).toHaveCount(0)
  await expect(page.getByRole('main').locator('header').getByRole('heading', { level: 2 })).toBeVisible()
})
