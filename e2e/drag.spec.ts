import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { NOW, board, choose, closeDrawer, createType, drawer, leavesOf, press, typeDate } from './support/leaves.ts'
import { enterAsOwner, expectNoAxeViolations, openModule, waitForSettledScreen } from './support/workspace.ts'

// V8's demo: drag to create, move and resize leaves on the board, with the card that says what a drop would do and the
// rule it would break; on a phone, the same by holding a finger first. Desktop and mobile, RTL, with axe. Sample data,
// tests only.

const PLATOON = 'מחלקה א'
const SOLDIER = 'יעל שחר'
const NAMES_PX = 124
const HOLD_MS = 650

async function setUp(page: Page) {
  await openModule(page, he.units.open)
  await drawer(page).getByRole('button', { name: he.units.new }).first().click()
  await page.getByLabel(he.units.name).fill(PLATOON)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(drawer(page).getByRole('list', { name: he.units.listLabel }).getByText(PLATOON, { exact: true })).toBeVisible()
  await closeDrawer(page)
  await openModule(page, he.soldiers.open)
  await drawer(page).getByRole('button', { name: he.soldiers.new }).first().click()
  await page.getByLabel(he.soldiers.firstName).fill('יעל')
  await page.getByLabel(he.soldiers.lastName).fill('שחר')
  await choose(page, he.soldiers.unit, PLATOON)
  await typeDate(page, he.soldiers.placedFrom, '01', '01', '2026')
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(drawer(page).getByRole('list', { name: he.soldiers.listLabel }).getByText(SOLDIER)).toBeVisible()
  await closeDrawer(page)
  await openModule(page, he.leaveTypes.open)
  await createType(page, { name: 'בית', color: he.palette.teal })
  await closeDrawer(page)
}

/** Where a day of the soldier's row is on screen: the grid starts at the row's right edge, after the names (RTL). */
async function dayPoint(page: Page, day: number) {
  const row = board(page).getByRole('listitem').filter({ hasText: SOLDIER })
  const box = await row.boundingBox()
  if (box === null) throw new Error('no row')
  const dayPx = (box.width - NAMES_PX) / 7
  return { x: box.x + box.width - NAMES_PX - dayPx * (day + 0.5), y: box.y + box.height / 2, dayPx }
}

function bar(page: Page) {
  return leavesOf(page).first()
}

async function mouseDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, beforeDrop?: () => Promise<void>) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  if (beforeDrop !== undefined) await beforeDrop()
  await page.mouse.up()
}

/** A finger held still, then moved: the touch path (D-144). Chromium's own touch events, so pointers are `touch`. */
async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const cdp = await page.context().newCDPSession(page)
  const point = (x: number, y: number) => [{ x: Math.round(x), y: Math.round(y) }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(from.x, from.y) })
  await page.waitForTimeout(HOLD_MS)
  for (let step = 1; step <= 6; step += 1) {
    const x = from.x + ((to.x - from.x) * step) / 6
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(x, to.y) })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}

async function finishNewLeave(page: Page, from: string, to: string) {
  await expect(drawer(page).getByRole('heading', { name: he.leaves.newTitle })).toBeVisible()
  await expect(page).toHaveURL(/draft=/)
  await expect(drawer(page).getByRole('combobox', { name: he.leaves.soldier })).toHaveValue(SOLDIER)
  await expect(drawer(page).getByRole('group', { name: he.leaves.from })).toContainText(from)
  await expect(drawer(page).getByRole('group', { name: he.leaves.to })).toContainText(to)
  await choose(page, he.leaves.type, 'בית')
  await press(page, 'switch', he.leaves.approveNow)
  await drawer(page).getByRole('button', { name: he.leaves.submit, exact: true }).click()
  await expect(drawer(page)).toHaveCount(0)
}

test('drag to create, move and resize, with what a drop would break', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The phone has its own demo below')
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)
  await setUp(page)

  await test.step('a drag across two empty days opens the new-leave form with the soldier and the days', async () => {
    await mouseDrag(page, await dayPoint(page, 1), await dayPoint(page, 2))
    await finishNewLeave(page, '9', '10')
    await expect(bar(page)).toHaveAccessibleName(/9–10 בנוב׳/)
    await expectNoAxeViolations(page)
  })

  await test.step('dragging the bar moves it, and the card says the new days while it moves', async () => {
    const box = await bar(page).boundingBox()
    if (box === null) throw new Error('no bar')
    const { dayPx } = await dayPoint(page, 0)
    const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    await mouseDrag(page, from, { x: from.x - 2 * dayPx, y: from.y }, async () => {
      await expect(page.getByRole('status').filter({ hasText: he.timeline.dragMove })).toContainText('11–12 בנוב׳')
    })
    await expect(bar(page)).toHaveAccessibleName(/11–12 בנוב׳/)
  })

  await test.step('the end of a bar moves its last day, and Escape puts a drag back', async () => {
    const box = await bar(page).boundingBox()
    if (box === null) throw new Error('no bar')
    const { dayPx } = await dayPoint(page, 0)
    // In RTL the last day is on the left.
    const end = { x: box.x + 2, y: box.y + box.height / 2 }
    await mouseDrag(page, end, { x: end.x - dayPx, y: end.y })
    await expect(bar(page)).toHaveAccessibleName(/11–13 בנוב׳/)
    const middle = { x: box.x + box.width / 2, y: end.y }
    await page.mouse.move(middle.x, middle.y)
    await page.mouse.down()
    await page.mouse.move(middle.x - 2 * dayPx, middle.y, { steps: 6 })
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await expect(bar(page)).toHaveAccessibleName(/11–13 בנוב׳/)
    await expect(drawer(page)).toHaveCount(0)
  })

  await test.step('a press without a drag still opens the leave', async () => {
    await bar(page).click()
    await expect(drawer(page).getByRole('heading', { name: he.leaves.threadTitle })).toBeVisible()
    await closeDrawer(page)
  })

  await test.step('a soft rule shows on the card while dragging, and the drop asks before it is saved', async () => {
    await openModule(page, he.rules.open)
    await drawer(page).getByRole('button', { name: he.rules.new }).first().click()
    await page.getByLabel(he.rules.name).fill('לפחות אחד')
    await page.getByLabel(he.rules.min, { exact: true }).fill('1')
    await page.getByRole('button', { name: he.common.create }).click()
    await expect(drawer(page).getByRole('list', { name: he.rules.listLabel }).getByText('לפחות אחד', { exact: true })).toBeVisible()
    await closeDrawer(page)

    const box = await bar(page).boundingBox()
    if (box === null) throw new Error('no bar')
    const { dayPx } = await dayPoint(page, 0)
    const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    await mouseDrag(page, from, { x: from.x - dayPx, y: from.y }, async () => {
      const card = page.getByRole('status').filter({ hasText: he.timeline.dragMove })
      await expect(card).toContainText('12–14 בנוב׳')
      await expect(card.getByRole('list', { name: he.rules.violationsLabel })).toContainText('לפחות אחד')
      await expect(card).toContainText(he.rules.soft)
      await waitForSettledScreen(page)
      await expectNoAxeViolations(page)
    })
    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByRole('heading', { name: he.rules.ackTitle })).toBeVisible()
    await dialog.getByRole('button', { name: he.rules.ackConfirm }).click()
    await expect(bar(page)).toHaveAccessibleName(/12–14 בנוב׳/)
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
  })
})

test('on a phone, a held finger creates and moves, and a bar is a 44 px target', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The touch path of a phone (D-144)')
  await page.clock.setFixedTime(NOW)
  await enterAsOwner(page)
  await setUp(page)

  await test.step('holding an empty day opens the new-leave form for that day', async () => {
    await touchDrag(page, await dayPoint(page, 1), await dayPoint(page, 1))
    await finishNewLeave(page, '9', '9')
    await expect(bar(page)).toHaveAccessibleName(/9 בנוב׳/)
  })

  await test.step('lanes are taller on a phone, so a bar and the gap around it make a 44 px target (OI-067)', async () => {
    const box = await bar(page).boundingBox()
    expect(box?.height).toBe(28)
    await expectNoAxeViolations(page)
  })

  await test.step('holding a bar picks it up, and the finger moves it', async () => {
    const box = await bar(page).boundingBox()
    if (box === null) throw new Error('no bar')
    const { dayPx } = await dayPoint(page, 0)
    const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    await touchDrag(page, from, { x: from.x - dayPx, y: from.y })
    await expect(bar(page)).toHaveAccessibleName(/10 בנוב׳/)
    await expect(drawer(page)).toHaveCount(0)
  })

  await test.step('a tap still opens the leave', async () => {
    await bar(page).tap()
    await expect(drawer(page).getByRole('heading', { name: he.leaves.threadTitle })).toBeVisible()
    await closeDrawer(page)
  })
})
