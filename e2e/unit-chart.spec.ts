import { expect, test, type Locator, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { choose } from './support/leaves.ts'
import { ORGANIZATION, enterAsOwner, expectNoAxeViolations, openModule } from './support/workspace.ts'

// V21's demo: the unit tree as a chart, its zoom, editing on it, and the choice remembered, with axe.

function chart(page: Page) {
  return page.getByRole('region', { name: he.units.chartLabel })
}

function node(page: Page, name: string): Locator {
  return chart(page)
    .getByRole('listitem')
    .filter({ has: page.getByText(name, { exact: true }) })
}

async function nodeAction(page: Page, name: string, action: string) {
  await node(page, name).getByRole('button', { name: he.common.actions }).click()
  await page.getByRole('menuitem', { name: action }).click()
}

async function addChild(page: Page, parent: string, name: string) {
  await nodeAction(page, parent, he.units.addChild)
  await page.getByLabel(he.units.name).fill(name)
  await page.getByRole('button', { name: he.common.create }).click()
  await expect(node(page, name)).toBeVisible()
}

async function widthOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('not on screen')
  return box.width
}

test('the chart: switch, layout, zoom, edit on it, and the choice remembered', async ({ page }, testInfo) => {
  await enterAsOwner(page)
  await openModule(page, he.units.open)
  await expect(page.getByRole('radio', { name: he.units.viewList })).toBeChecked()

  await page.getByRole('radio', { name: he.units.viewChart }).click()
  await expect(chart(page)).toBeVisible()
  await expect(node(page, ORGANIZATION)).toBeVisible()

  await test.step('a unit is added from a node, and lands under it', async () => {
    await addChild(page, ORGANIZATION, 'מחלקה א')
    await addChild(page, ORGANIZATION, 'מחלקה ב')
    const root = await node(page, ORGANIZATION).boundingBox()
    const first = await node(page, 'מחלקה א').boundingBox()
    const second = await node(page, 'מחלקה ב').boundingBox()
    if (root === null || first === null || second === null) throw new Error('not on screen')
    expect(first.y).toBeGreaterThan(root.y + root.height)
    expect(second.y).toBe(first.y)
    // Right to left: the first child stands to the right of the second.
    expect(first.x).toBeGreaterThan(second.x)
    await expect(node(page, 'מחלקה א').locator('.sr-only').first()).toHaveText(`${he.units.depth} 2`)
  })

  await test.step('the zoom buttons change the size of a node', async () => {
    const before = await widthOf(node(page, ORGANIZATION))
    await page.getByRole('button', { name: he.units.zoomOut }).click()
    await expect.poll(() => widthOf(node(page, ORGANIZATION))).toBeLessThan(before)
    await page.getByRole('button', { name: he.units.zoomIn }).click()
    await page.getByRole('button', { name: he.units.zoomIn }).click()
    await expect.poll(() => widthOf(node(page, ORGANIZATION))).toBeGreaterThan(before)
    await page.getByRole('button', { name: he.units.zoomFit }).click()
    await expect.poll(() => widthOf(node(page, ORGANIZATION))).toBeCloseTo(before, 0)
  })

  // A narrow screen, where the chart is wider than its viewport: right to left the browser would hold the scroll against
  // the start edge as the chart widens, and the cards in view would jump.
  if (testInfo.project.name.includes('mobile')) {
    await test.step('a unit moved away holds the view on the unit it left (OI-271)', async () => {
      for (const name of ['כיתה 1', 'כיתה 2']) await addChild(page, 'מחלקה א', name)
      await addChild(page, 'מחלקה ב', 'כיתה 3')
      for (let step = 0; step < 6; step += 1) await page.getByRole('button', { name: he.units.zoomIn }).click()
      await node(page, 'כיתה 3').scrollIntoViewIfNeeded()
      const before = await node(page, 'מחלקה ב').boundingBox()
      await nodeAction(page, 'כיתה 3', he.units.moveTo)
      await choose(page, he.units.parent, 'מחלקה א')
      await page.getByRole('button', { name: he.units.moveSubmit, exact: true }).click()
      await expect(page.getByRole('dialog', { name: he.units.moveTitle })).toBeHidden()
      await expect(node(page, 'כיתה 3').locator('.sr-only').first()).toHaveText(`${he.units.depth} 3`)
      const after = await node(page, 'מחלקה ב').boundingBox()
      if (before === null || after === null) throw new Error('not on screen')
      expect(Math.abs(after.x - before.x)).toBeLessThan(2)
      expect(Math.abs(after.y - before.y)).toBeLessThan(2)
      await page.getByRole('button', { name: he.units.zoomFit }).click()
    })
  }

  if (!testInfo.project.name.includes('mobile')) {
    await test.step('on a wide screen the chart takes the whole width', async () => {
      const dialog = await page.getByRole('dialog').boundingBox()
      const viewport = page.viewportSize()
      if (dialog === null || viewport === null) throw new Error('not on screen')
      expect(dialog.width).toBeGreaterThan(viewport.width * 0.9)
    })
  }

  await expectNoAxeViolations(page)

  await test.step('the name opens the form, and the drawer is a form again', async () => {
    await node(page, 'מחלקה ב').getByRole('button', { name: 'מחלקה ב' }).click()
    await expect(page.getByLabel(he.units.name)).toHaveValue('מחלקה ב')
    await page.getByRole('button', { name: he.common.cancel, exact: true }).click()
    await expect(chart(page)).toBeVisible()
  })

  await test.step('the device remembers the chart', async () => {
    await page.reload()
    await expect(page.getByRole('radio', { name: he.units.viewChart })).toBeChecked()
    await expect(node(page, 'מחלקה ב')).toBeVisible()
    await page.getByRole('radio', { name: he.units.viewList }).click()
    await expect(chart(page)).toBeHidden()
    await expect(page.getByRole('list', { name: he.units.listLabel })).toBeVisible()
  })
})
