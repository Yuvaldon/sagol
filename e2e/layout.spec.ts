import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { board } from './support/leaves.ts'
import { enterAsOwner, expectNoAxeViolations, navigation, OWNER } from './support/workspace.ts'

// V20's layout checks: the bars fit on one line in every shape of screen, a phone on its side keeps the phone's bars
// and room for the board (D-190), what can be pressed sits inside the safe area while the canvas paints edge to edge
// (D-191), and the board's corner and name column stay one opaque surface while the days scroll under them (D-192).
// Desktop, an upright phone and a phone on its side, RTL, with axe. Sample data, tests only.

/** The insets a phone with a camera cutout reports, upright and on its side. */
const UPRIGHT_INSETS = { top: 47, right: 0, bottom: 34, left: 0 }
const SIDEWAYS_INSETS = { top: 0, right: 47, bottom: 21, left: 47 }

/** Every bar on screen: the landmarks of the workspace, outside any dialog. */
async function barMeasures(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('nav')]
      .filter((bar) => bar.closest('[role=dialog]') === null && bar.getClientRects().length > 0)
      .map((bar) => {
        const lines = [...bar.querySelectorAll<HTMLElement>('*')]
          .flatMap((element) => [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== ''))
          .filter((node) => node.parentElement !== null && node.parentElement.getClientRects().length > 0)
          .map((node) => {
            const range = document.createRange()
            range.selectNodeContents(node)
            const tops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)))
            return { text: (node.textContent ?? '').trim(), lines: tops.size }
          })
        return { name: bar.getAttribute('aria-label'), overflow: bar.scrollWidth - bar.clientWidth, wrapped: lines.filter((line) => line.lines > 1) }
      }),
  )
}

async function overrideSafeArea(page: Page, insets: typeof UPRIGHT_INSETS) {
  const session = await page.context().newCDPSession(page)
  await session.send('Emulation.setSafeAreaInsetsOverride', { insets })
}

test('the bars fit on one line, the page never scrolls sideways, and the board keeps its room', async ({ page }, testInfo) => {
  await enterAsOwner(page)
  await expect(board(page)).toBeVisible()
  await testInfo.attach('bars', { body: await page.screenshot(), contentType: 'image/png' })

  await test.step('no bar overflows, and no label wraps', async () => {
    const bars = await barMeasures(page)
    expect(bars.length).toBeGreaterThan(0)
    for (const bar of bars) {
      expect(bar.overflow, `${bar.name ?? ''} overflows`).toBeLessThanOrEqual(0)
      expect(bar.wrapped, `${bar.name ?? ''} wraps`).toEqual([])
    }
    const page_ = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(page_).toBeLessThanOrEqual(0)
  })

  // The desktop has one row of bars at the top.
  if (testInfo.project.name !== 'desktop') await test.step('a phone keeps its destinations as tabs at the bottom, with room for the board', async () => {
    const viewport = page.viewportSize()
    if (viewport === null) throw new Error('no viewport')
    const tabs = await navigation(page).boundingBox()
    const account = await page.getByRole('button', { name: `${he.account.menu} ${OWNER.name}` }).boundingBox()
    if (tabs === null || account === null) throw new Error('a bar is missing')
    expect(tabs.y + tabs.height).toBeGreaterThan(viewport.height * 0.9)
    const tops = await page.evaluate(() =>
      [...document.querySelectorAll('nav')]
        .filter((bar) => bar.closest('[role=dialog]') === null)
        .map((bar) => bar.getBoundingClientRect())
        .filter((rect) => rect.top < window.innerHeight / 2)
        .map((rect) => rect.bottom),
    )
    expect(tabs.y - Math.max(...tops)).toBeGreaterThanOrEqual(viewport.height * 0.5)
  })

  await expectNoAxeViolations(page)
})

test('what can be pressed sits inside the safe area, and the canvas paints edge to edge', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop', 'a desktop screen has no cutout')
  const insets = testInfo.project.name === 'landscape' ? SIDEWAYS_INSETS : UPRIGHT_INSETS
  await overrideSafeArea(page, insets)
  await enterAsOwner(page)
  await expect(board(page)).toBeVisible()
  await testInfo.attach('safe area', { body: await page.screenshot(), contentType: 'image/png' })
  const viewport = page.viewportSize()
  if (viewport === null) throw new Error('no viewport')

  const boxes = await page.evaluate(() =>
    [...document.querySelectorAll('nav, main')]
      .filter((element) => element.closest('[role=dialog]') === null)
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return { name: element.getAttribute('aria-label') ?? element.tagName, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
      }),
  )
  for (const box of boxes) {
    expect(box.left, box.name).toBeGreaterThanOrEqual(insets.left)
    expect(box.right, box.name).toBeLessThanOrEqual(viewport.width - insets.right)
    expect(box.top, box.name).toBeGreaterThanOrEqual(insets.top)
    expect(box.bottom, box.name).toBeLessThanOrEqual(viewport.height - insets.bottom)
  }

  // The workspace's own canvas reaches every edge, under the cutout too.
  const canvas = await page.locator('main').evaluate((main) => {
    const workspace = main.parentElement?.parentElement
    if (!workspace) return null
    const rect = workspace.getBoundingClientRect()
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, background: getComputedStyle(workspace).backgroundColor }
  })
  expect(canvas).not.toBeNull()
  expect(canvas?.left).toBe(0)
  expect(canvas?.top).toBe(0)
  expect(canvas?.width).toBe(viewport.width)
  expect(canvas?.height).toBe(viewport.height)
  expect(canvas?.background).not.toBe('rgba(0, 0, 0, 0)')
})

test('the board’s corner and name column stay one opaque surface while the days scroll under them', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'an upright phone is where the days scroll sideways')
  await enterAsOwner(page)
  const timeline = board(page)
  await expect(timeline.getByRole('button', { name: OWNER.name })).toBeVisible()
  // RTL: the days start at the inline start, the right, and scroll in from the left.
  await timeline.evaluate((element) => {
    element.scrollLeft = -(element.scrollWidth - element.clientWidth)
  })
  await expect.poll(() => timeline.evaluate((element) => element.scrollLeft)).toBeLessThan(0)
  await testInfo.attach('scrolled', { body: await page.screenshot(), contentType: 'image/png' })

  const geometry = await timeline.evaluate((element, names) => {
    const region = element.getBoundingClientRect()
    const corner = [...element.querySelectorAll<HTMLElement>('div')].find((div) => div.textContent === names)
    const nameCell = element.querySelector('li button')?.parentElement
    if (!corner || !nameCell) return null
    const cornerRect = corner.getBoundingClientRect()
    const cellRect = nameCell.getBoundingClientRect()
    const centre = document.elementFromPoint(cornerRect.left + cornerRect.width / 2, cornerRect.top + cornerRect.height / 2)
    return {
      regionRight: region.right,
      cornerRight: cornerRect.right,
      cornerWidth: cornerRect.width,
      cellRight: cellRect.right,
      cellWidth: cellRect.width,
      cornerBackground: getComputedStyle(corner).backgroundColor,
      cellBackground: getComputedStyle(nameCell).backgroundColor,
      cornerOnTop: centre !== null && corner.contains(centre),
      // The days' strip is flat: no glass, shadow or rounded end shows as a seam where it meets the corner.
      daysStrip: (() => {
        const strip = corner.nextElementSibling
        if (!strip) return null
        const style = getComputedStyle(strip)
        return { blur: style.backdropFilter, shadow: style.boxShadow, radius: style.borderStartEndRadius }
      })(),
    }
  }, he.timeline.names)
  expect(geometry).not.toBeNull()
  if (geometry === null) return
  // Both hold the inline-start edge, at one width, so the column is continuous from the corner down.
  expect(Math.abs(geometry.cornerRight - geometry.regionRight)).toBeLessThanOrEqual(1)
  expect(Math.abs(geometry.cellRight - geometry.regionRight)).toBeLessThanOrEqual(1)
  expect(geometry.cornerWidth).toBe(geometry.cellWidth)
  // One opaque token: nothing behind shows through, and the corner covers what slides under it.
  expect(geometry.cornerBackground).toBe(geometry.cellBackground)
  expect(geometry.cornerBackground).toMatch(/^rgb\(/)
  expect(geometry.cornerOnTop).toBe(true)
  expect(geometry.daysStrip).toEqual({ blur: 'none', shadow: 'none', radius: '0px' })
})
