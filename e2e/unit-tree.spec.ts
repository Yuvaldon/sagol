import { expect, test, type Locator, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { enterAsOwner, expectNoAxeViolations, navigation, openModule } from './support/workspace.ts'

// V1's demo: the units drawer, from levels to archive, on desktop and mobile, RTL, with axe.

const TOUCH_TARGET_PX = 44
const STEPS = 12

function list(page: Page) {
  return page.getByRole('list', { name: he.units.listLabel })
}

function row(page: Page, name: string): Locator {
  return list(page)
    .getByRole('listitem')
    .filter({ has: page.getByText(name, { exact: true }) })
}

async function namesInOrder(page: Page): Promise<string[]> {
  return list(page)
    .getByRole('listitem')
    .evaluateAll((rows) => rows.map((item) => item.querySelector('.font-semibold')?.textContent ?? ''))
}

async function depthOf(page: Page, name: string): Promise<string> {
  return (await row(page, name).locator('.sr-only').first().textContent()) ?? ''
}

async function openUnits(page: Page) {
  await openModule(page, he.units.open)
  await expect(page.getByRole('heading', { name: he.units.title, exact: true })).toBeVisible()
}

async function createUnit(page: Page, name: string) {
  await page.getByRole('button', { name: he.units.new }).click()
  await page.getByLabel(he.units.name).fill(name)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(row(page, name)).toBeVisible()
}

async function rowAction(page: Page, name: string, action: string) {
  await row(page, name).getByRole('button', { name: he.common.actions }).click()
  await page.getByRole('menuitem', { name: action }).click()
}

async function addChild(page: Page, parent: string, name: string) {
  await rowAction(page, parent, he.units.addChild)
  await page.getByLabel(he.units.name).fill(name)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(row(page, name)).toBeVisible()
}

/** Drags a row's handle onto a part of another row: 0 is its top, 0.5 its middle, 1 its bottom. */
async function dragOnto(page: Page, from: string, to: string, part: number) {
  const handle = await row(page, from).getByTestId('drag-handle').boundingBox()
  const target = await row(page, to).boundingBox()
  if (handle === null || target === null) throw new Error('nothing to drag')
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x + target.width / 2, target.y + target.height * part, { steps: STEPS })
  await page.mouse.move(target.x + target.width / 2, target.y + target.height * part, { steps: 2 })
  await page.mouse.up()
}

/** A company with two platoons, and a squad under the first. */
async function buildTree(page: Page) {
  await createUnit(page, 'פלוגה')
  await addChild(page, 'פלוגה', 'מחלקה א')
  await addChild(page, 'פלוגה', 'מחלקה ב')
  await addChild(page, 'מחלקה א', 'כיתה')
}

test('levels: create, rename, reorder and archive', async ({ page }) => {
  await enterAsOwner(page)
  await openUnits(page)
  await page.getByRole('button', { name: he.units.tabLevels }).click()
  await expect(page.getByText(he.unitLevels.emptyTitle)).toBeVisible()
  await expectNoAxeViolations(page)

  await test.step('an empty name is refused, and levels are created', async () => {
    await page.getByRole('button', { name: he.unitLevels.new }).click()
    await page.getByRole('button', { name: he.common.create }).click()
    await expect(page.getByText(he.issues.required)).toBeVisible()
    await expectNoAxeViolations(page)
    await page.getByLabel(he.unitLevels.name).fill('גדוד')
    await page.getByRole('button', { name: he.common.create }).click()
    for (const name of ['מחלקה', 'פלוגה']) {
      await page.getByRole('button', { name: he.unitLevels.new }).click()
      await page.getByLabel(he.unitLevels.name).fill(name)
      await page.getByRole('button', { name: he.common.create }).click()
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
    }
  })

  const levels = page.getByRole('list', { name: he.unitLevels.listLabel }).getByRole('listitem')

  await test.step('the menu moves a level, and dragging moves it too', async () => {
    await expect(levels).toHaveText(['גדוד', 'מחלקה', 'פלוגה'])
    await levels.filter({ hasText: 'פלוגה' }).getByRole('button', { name: he.common.actions }).click()
    await page.getByRole('menuitem', { name: he.common.stepUp }).click()
    await expect(levels).toHaveText(['גדוד', 'פלוגה', 'מחלקה'])

    const handle = await levels.nth(2).getByTestId('drag-handle').boundingBox()
    const target = await levels.nth(0).boundingBox()
    if (handle === null || target === null) throw new Error('nothing to drag')
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await page.mouse.down()
    await page.mouse.move(handle.x + handle.width / 2, target.y + 2, { steps: STEPS })
    await page.mouse.up()
    await expect(levels).toHaveText(['מחלקה', 'גדוד', 'פלוגה'])
  })

  await test.step('a level is renamed, and archived after a warning', async () => {
    await page.getByRole('button', { name: 'מחלקה', exact: true }).click()
    await page.getByLabel(he.unitLevels.name).fill('צוות')
    await page.getByRole('button', { name: he.common.save }).click()
    await expect(levels).toHaveText(['צוות', 'גדוד', 'פלוגה'])

    await levels.filter({ hasText: 'צוות' }).getByRole('button', { name: he.common.actions }).click()
    await page.getByRole('menuitem', { name: he.common.archive }).click()
    await expect(page.getByRole('alertdialog')).toContainText(he.unitLevels.archiveBody)
    await expectNoAxeViolations(page)
    await page.getByRole('alertdialog').getByRole('button', { name: he.common.archive }).click()
    await expect(levels).toHaveText(['גדוד', 'פלוגה'])
  })
})

test('the tree: create, rename, color, level, reorder, move and archive', async ({ page }, testInfo) => {
  await enterAsOwner(page)

  await test.step('the surface is a side drawer on desktop and a bottom sheet on mobile', async () => {
    await openUnits(page)
    await expect(page).toHaveURL(/panel=units/)
    const box = await page.getByRole('dialog').boundingBox()
    const viewport = page.viewportSize()
    if (box === null || viewport === null) throw new Error('no drawer')
    if (testInfo.project.name === 'desktop') {
      expect(box.x).toBeLessThan(viewport.width / 2)
      expect(box.width).toBeLessThan(viewport.width / 2)
    } else {
      expect(box.width).toBeGreaterThan(viewport.width * 0.9)
      expect(box.y + box.height).toBeGreaterThan(viewport.height - 2)
    }
    await expectNoAxeViolations(page)
  })

  await test.step('a form reports a blank name, and has no axe violations', async () => {
    await page.getByRole('button', { name: he.units.new }).click()
    await expect(page).toHaveURL(/entity=new/)
    await page.getByRole('button', { name: he.common.create }).click()
    await expect(page.getByText(he.issues.required)).toBeVisible()
    await expectNoAxeViolations(page)
    await page.getByRole('button', { name: he.common.cancel }).click()
  })

  await test.step('a tree is built', async () => {
    await buildTree(page)
    expect(await namesInOrder(page)).toEqual(['פלוגה', 'מחלקה א', 'כיתה', 'מחלקה ב'])
    expect(await depthOf(page, 'כיתה')).toBe(`${he.units.depth} 3`)
    await expectNoAxeViolations(page)
  })

  await test.step('a unit is renamed and given a color and a level', async () => {
    await page.getByRole('button', { name: he.units.tabLevels }).click()
    await page.getByRole('button', { name: he.unitLevels.new }).click()
    await page.getByLabel(he.unitLevels.name).fill('דרג מחלקה')
    await page.getByRole('button', { name: he.common.create }).click()
    await expect(page.getByRole('button', { name: 'דרג מחלקה' })).toBeVisible()
    await page.getByRole('button', { name: he.units.tabTree }).click()

    await list(page).getByRole('button', { name: 'מחלקה ב' }).click()
    await page.getByLabel(he.units.name).fill('מחלקה ג')
    await page.getByRole('radio', { name: he.palette.teal }).click({ force: true })
    await page.getByRole('dialog').locator('[aria-haspopup=listbox]').click()
    await page.getByRole('option', { name: 'דרג מחלקה' }).click()
    await expectNoAxeViolations(page)
    await page.getByRole('button', { name: he.common.save }).click()
    await expect(row(page, 'מחלקה ג')).toContainText('דרג מחלקה')
    await expect(row(page, 'מחלקה ג').locator('.bg-palette-teal')).toBeVisible()
  })

  await test.step('the menu reorders among siblings', async () => {
    await rowAction(page, 'מחלקה ג', he.common.stepUp)
    await expect.poll(() => namesInOrder(page)).toEqual(['פלוגה', 'מחלקה ג', 'מחלקה א', 'כיתה'])
  })

  await test.step('dragging onto the edge of a row reorders', async () => {
    await dragOnto(page, 'מחלקה א', 'מחלקה ג', 0.05)
    await expect.poll(() => namesInOrder(page)).toEqual(['פלוגה', 'מחלקה א', 'כיתה', 'מחלקה ג'])
  })

  await test.step('dragging onto the middle of a row moves into it', async () => {
    await dragOnto(page, 'כיתה', 'מחלקה ג', 0.5)
    await expect.poll(() => namesInOrder(page)).toEqual(['פלוגה', 'מחלקה א', 'מחלקה ג', 'כיתה'])
    expect(await depthOf(page, 'כיתה')).toBe(`${he.units.depth} 3`)
  })

  await test.step('a cycle is refused with a clear message, and nothing moves', async () => {
    await dragOnto(page, 'פלוגה', 'כיתה', 0.5)
    await expect(page.getByRole('alert')).toContainText(he.issues.unitCycle)
    expect(await namesInOrder(page)).toEqual(['פלוגה', 'מחלקה א', 'מחלקה ג', 'כיתה'])
    await expectNoAxeViolations(page)
  })

  await test.step('"move to" does the same without a pointer, and never offers a cycle', async () => {
    await rowAction(page, 'מחלקה ג', he.units.moveTo)
    await page
      .getByRole('dialog', { name: he.units.moveTitle })
      .getByRole('button', { name: new RegExp(he.units.parent) })
      .click()
    await expect(page.getByRole('option', { name: 'כיתה' })).toHaveCount(0)
    await expectNoAxeViolations(page)
    await page.getByRole('option', { name: he.units.parentTop }).click()
    await page.getByRole('button', { name: he.units.moveSubmit }).click()
    await expect.poll(() => depthOf(page, 'מחלקה ג')).toBe(`${he.units.depth} 1`)
    expect(await namesInOrder(page)).toEqual(['פלוגה', 'מחלקה א', 'מחלקה ג', 'כיתה'])
  })

  await test.step('a unit with sub-units is not archived, an empty one is, after a warning', async () => {
    await rowAction(page, 'מחלקה ג', he.common.archive)
    await page.getByRole('alertdialog').getByRole('button', { name: he.common.archive }).click()
    await expect(page.getByRole('alert')).toContainText(he.issues.unitNotEmpty)

    await rowAction(page, 'כיתה', he.common.archive)
    await expect(page.getByRole('alertdialog')).toContainText(he.units.archiveBody)
    await page.getByRole('alertdialog').getByRole('button', { name: he.common.archive }).click()
    await expect(row(page, 'כיתה')).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  await test.step('Escape closes the drawer, and the back button reopens it', async () => {
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).not.toHaveURL(/panel=/)
    await page.goBack()
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})

test('a deep link reopens the drawer and the form, also after a reload', async ({ page }) => {
  await enterAsOwner(page)
  await openUnits(page)
  await createUnit(page, 'פלוגה')
  await list(page).getByRole('button', { name: 'פלוגה' }).click()
  await expect(page).toHaveURL(/entity=/)
  const deepLink = page.url()

  await page.reload()
  await expect(page.getByLabel(he.units.name)).toHaveValue('פלוגה')

  await page.goto('/?panel=unit_levels')
  await expect(page.getByText(he.unitLevels.emptyTitle)).toBeVisible()

  await page.goto(deepLink)
  await expect(page.getByLabel(he.units.name)).toHaveValue('פלוגה')

  await test.step('a row that does not exist says so', async () => {
    await page.goto('/?panel=units&entity=00000000-0000-4000-8000-000000000000')
    await expect(page.getByText(he.units.notFound)).toBeVisible()
    await page.getByRole('button', { name: he.common.backToList }).click()
    await expect(row(page, 'פלוגה')).toBeVisible()
  })

  await test.step('a value that means nothing is ignored', async () => {
    await page.goto('/?panel=nothing')
    await expect(navigation(page)).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})

test('two tabs stay in sync, and a stale edit gets a clear message', async ({ page, context }) => {
  await enterAsOwner(page)
  await openUnits(page)
  await createUnit(page, 'פלוגה')

  const other = await context.newPage()
  await other.goto('/?panel=units')
  await expect(row(other, 'פלוגה')).toBeVisible()

  await test.step('a unit created in one tab appears in the other', async () => {
    await createUnit(page, 'גדוד')
    await expect(row(other, 'גדוד')).toBeVisible()
  })

  await test.step('saving over a change from another tab is refused, then continues from it', async () => {
    await list(other).getByRole('button', { name: 'פלוגה' }).click()
    await other.getByLabel(he.units.name).fill('השם של הלשונית השנייה')

    await list(page).getByRole('button', { name: 'פלוגה' }).click()
    await page.getByLabel(he.units.name).fill('השם של הלשונית הראשונה')
    await page.getByRole('button', { name: he.common.save }).click()
    await expect(row(page, 'השם של הלשונית הראשונה')).toBeVisible()

    await other.getByRole('button', { name: he.common.save }).click()
    await expect(other.getByRole('alert')).toContainText(he.errors.staleVersion)
    await expectNoAxeViolations(other)
    await other.getByRole('button', { name: he.common.reloadItem }).click()
    await expect(other.getByLabel(he.units.name)).toHaveValue('השם של הלשונית הראשונה')
  })
})

test('on a phone: 44 px targets, real touch drag, and the sheet closes by its grip', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'A mobile requirement (OI-033).')

  async function expectTouchTargets() {
    const heights = await page
      .getByRole('dialog')
      .locator('button:visible, input:visible:not([type=radio]), label:has(input[type=radio])')
      .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height))
    expect(heights.length).toBeGreaterThan(0)
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(TOUCH_TARGET_PX)
  }

  async function touchDrag(fromX: number, fromY: number, toX: number, toY: number) {
    const cdp = await page.context().newCDPSession(page)
    const point = (x: number, y: number) => ({ touchPoints: [{ x, y }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', ...point(fromX, fromY) })
    for (let step = 1; step <= STEPS; step += 1) {
      const progress = step / STEPS
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        ...point(fromX + (toX - fromX) * progress, fromY + (toY - fromY) * progress),
      })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }

  await enterAsOwner(page)
  await expect(navigation(page).getByRole('button', { name: he.units.open })).toBeVisible()
  await openUnits(page)
  await buildTree(page)
  await expectTouchTargets()

  await test.step('forms are touch sized', async () => {
    await page.getByRole('button', { name: he.units.new }).click()
    await expect(page.getByLabel(he.units.name)).toBeVisible()
    await expectTouchTargets()
    await page.getByRole('button', { name: he.common.cancel }).click()
  })

  await test.step('a finger moves a unit by its handle', async () => {
    const handle = await row(page, 'כיתה').getByTestId('drag-handle').boundingBox()
    const target = await row(page, 'מחלקה ב').boundingBox()
    if (handle === null || target === null) throw new Error('nothing to drag')
    await touchDrag(
      handle.x + handle.width / 2,
      handle.y + handle.height / 2,
      target.x + target.width / 2,
      target.y + target.height / 2,
    )
    await expect.poll(() => namesInOrder(page)).toEqual(['פלוגה', 'מחלקה א', 'מחלקה ב', 'כיתה'])
  })

  await test.step('dragging the grip down closes the sheet', async () => {
    const sheet = await page.getByRole('dialog').boundingBox()
    if (sheet === null) throw new Error('no sheet')
    const x = sheet.x + sheet.width / 2
    await touchDrag(x, sheet.y + 12, x, sheet.y + 300)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).not.toHaveURL(/panel=/)
  })
})

test('a drag still lands right after the list scrolled under it', async ({ page }) => {
  const COUNT = 16
  const nameOf = (index: number) => `U${String(index)}`
  await enterAsOwner(page)
  await openUnits(page)
  for (let index = 1; index <= COUNT; index += 1) await createUnit(page, nameOf(index))

  const handle = await row(page, nameOf(1)).getByTestId('drag-handle').boundingBox()
  if (handle === null) throw new Error('nothing to drag')
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height, { steps: 4 })
  await row(page, nameOf(COUNT)).evaluate((element) => {
    element.scrollIntoView({ block: 'end' })
  })
  // Near the middle of the list on screen, where auto-scroll leaves it still.
  const dialog = await page.getByRole('dialog').boundingBox()
  if (dialog === null) throw new Error('no drawer')
  const middle = dialog.y + dialog.height * 0.6
  const boxes = await Promise.all(
    Array.from({ length: COUNT - 1 }, (_, index) => nameOf(index + 2)).map(async (name) => ({
      name,
      box: await row(page, name).boundingBox(),
    })),
  )
  const chosen = boxes.find(({ box }) => box !== null && box.y <= middle && middle < box.y + box.height)
  const target = chosen?.box ?? null
  if (target === null) throw new Error('nothing to drop on')
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: STEPS })
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2 + 1, { steps: 2 })
  await page.mouse.up()
  await expect.poll(() => depthOf(page, nameOf(1))).toBe(`${he.units.depth} 2`)
  const order = await namesInOrder(page)
  expect(order.indexOf(nameOf(1))).toBe(order.indexOf(chosen?.name ?? '') + 1)
})
