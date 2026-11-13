import { PANEL_IDS, UNIT_CHART_ZOOM } from '@config'
import type { AppError, Unit, UnitLevel } from '@contracts'
import { t } from '@i18n'
import { unitChart, usePanel, type UnitChartFamily, type UnitChartNode } from '@logic'
import { Scan, ZoomIn, ZoomOut } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { ActionMenu, type RowAction } from '../../patterns/ActionMenu'
import { IconButton } from '../../primitives/Button'
import { UnitActionsScope, UnitName, UnitSwatch, type UnitPermissions } from './UnitActions'

// The tree as an org chart (D-319, D-320). The layout comes in cells from logic and becomes lengths here, from the
// theme's chart tokens, placed from the inline start so the chart reads right to left. The canvas scrolls: a finger or
// the wheel pans it, and so does dragging its background with a mouse. Zoom is the buttons, a pinch, or the wheel
// with Ctrl. Each node is the list's row: the name opens the unit's form, and the menu holds the same actions.

const COLUMN = '(var(--spacing-chart-node) + var(--spacing-chart-gap))'
const ROW = '(var(--spacing-chart-node-height) + var(--spacing-chart-row-gap))'
const HALF_NODE = 'var(--spacing-chart-node) / 2'
const HALF_ROW_GAP = 'var(--spacing-chart-row-gap) / 2'
const LINE = 'pointer-events-none absolute bg-line'

const across = (slot: number) => `calc(${COLUMN} * ${String(slot)})`
const centerOf = (slot: number) => `calc(${COLUMN} * ${String(slot)} + ${HALF_NODE})`
const rowTop = (depth: number) => `calc(${ROW} * ${String(depth)})`
const underNode = (depth: number) => `calc(${ROW} * ${String(depth)} + var(--spacing-chart-node-height))`
const barTop = (depth: number) =>
  `calc(${ROW} * ${String(depth)} + var(--spacing-chart-node-height) + ${HALF_ROW_GAP})`

function clampZoom(zoom: number): number {
  return Math.min(UNIT_CHART_ZOOM.max, Math.max(UNIT_CHART_ZOOM.min, zoom))
}

/** A card, and where it stood in the viewport. */
interface Spot {
  readonly id: string
  readonly left: number
  readonly top: number
}

/** Where a zoom keeps its point: a spot on the screen, and where it fell on the content at the zoom shown. */
interface ZoomAnchor {
  readonly clientX: number
  readonly clientY: number
  readonly contentX: number
  readonly contentY: number
  readonly from: number
}

/** The lowest `scrollLeft`: negative when the content overflows toward the inline end, right to left. */
function scrollStart(element: HTMLElement): number {
  return getComputedStyle(element).direction === 'rtl' ? element.clientWidth - element.scrollWidth : 0
}

/** Whether a point falls inside the scrolling area, and not on a scrollbar or the border. */
function inClientArea(element: HTMLElement, clientX: number, clientY: number): boolean {
  const rect = element.getBoundingClientRect()
  const x = clientX - rect.left - element.clientLeft
  const y = clientY - rect.top - element.clientTop
  return x >= 0 && y >= 0 && x <= element.clientWidth && y <= element.clientHeight
}

function Connectors({ family }: { readonly family: UnitChartFamily }) {
  const first = Math.min(...family.childSlots)
  const last = Math.max(...family.childSlots)
  const stem = (slot: number, top: string): CSSProperties => ({
    insetInlineStart: centerOf(slot),
    top,
    height: `calc(${HALF_ROW_GAP})`,
  })
  return (
    <>
      <span className={`${LINE} w-2xs`} style={stem(family.parentSlot, underNode(family.depth))} />
      <span
        className={`${LINE} h-2xs`}
        style={{
          insetInlineStart: centerOf(first),
          top: barTop(family.depth),
          width: `calc(${COLUMN} * ${String(last - first)} + var(--spacing-2xs))`,
        }}
      />
      {family.childSlots.map((slot) => (
        <span key={slot} className={`${LINE} w-2xs`} style={stem(slot, barTop(family.depth))} />
      ))}
    </>
  )
}

function ChartNode({
  node,
  levelName,
  canUpdate,
  actions,
}: {
  readonly node: UnitChartNode
  readonly levelName: string | null
  readonly canUpdate: boolean
  readonly actions: readonly RowAction[]
}) {
  const panel = usePanel()
  const { unit, depth, slot } = node
  const name = <UnitName unit={unit} levelName={levelName} />
  const depthLabel = `${t('units.depth')} ${String(depth + 1)}`
  return (
    <li
      data-unit-id={unit.id}
      style={{ insetInlineStart: across(slot), top: rowTop(depth) }}
      className="absolute flex h-chart-node-height w-chart-node items-center gap-2xs rounded-control border border-line bg-surface ps-xs"
    >
      <span className="sr-only">{depthLabel}</span>
      <UnitSwatch colorKey={unit.color_key} />
      {canUpdate ? (
        <AriaButton
          onPress={() => {
            panel.open(PANEL_IDS.units, { entity: unit.id })
          }}
          className="flex min-h-touch min-w-none flex-1 cursor-pointer items-center rounded-control px-xs text-start outline-focus md:min-h-control data-focus-visible:outline-2 data-hovered:bg-inner"
        >
          {name}
        </AriaButton>
      ) : (
        <span className="flex min-w-none flex-1 items-center px-xs">{name}</span>
      )}
      <ActionMenu labelKey="common.actions" actions={actions} />
    </li>
  )
}

export function UnitChart({
  units,
  levels,
  permissions,
  onFailure,
}: {
  readonly units: readonly Unit[]
  readonly levels: readonly UnitLevel[]
  readonly permissions: UnitPermissions
  readonly onFailure: (error: AppError | null) => void
}) {
  const chart = useMemo(() => unitChart(units), [units])
  const levelNames = useMemo(() => new Map(levels.map((level) => [level.id, level.name])), [levels])
  const viewport = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const nodes = useRef<HTMLUListElement>(null)
  const [zoom, setZoom] = useState(1)
  /** The zoom asked for last, ahead of the render. */
  const zoomRef = useRef(zoom)
  /** The zoom on screen: what the DOM's sizes and scroll are measured in. */
  const shown = useRef(zoom)
  const anchor = useRef<ZoomAnchor | null>(null)
  /** Whether the person zoomed or panned. Until then the chart stays fitted, as the drawer settles or resizes. */
  const moved = useRef(false)
  const pan = useRef<{ readonly x: number; readonly y: number; readonly left: number; readonly top: number } | null>(
    null,
  )
  /**
   * The card in focus or under the last press, where it stood in the viewport, and its parent's card. When the chart
   * changes width, right to left the browser holds the scroll against the start edge and a narrow chart recenters, so
   * the view is held on this card instead; on its parent's when the card itself moved or left (OI-271).
   */
  const kept = useRef<{ readonly card: Spot; readonly parentId: string | null; readonly parent: Spot | null } | null>(null)
  const cardOf = (id: string) => nodes.current?.querySelector(`[data-unit-id="${CSS.escape(id)}"]`) ?? null
  const spotOf = (card: Element | null): Spot | null => {
    const element = viewport.current
    const id = card?.getAttribute('data-unit-id') ?? null
    if (element === null || card === null || id === null) return null
    const at = card.getBoundingClientRect()
    const frame = element.getBoundingClientRect()
    return { id, left: at.left - frame.left, top: at.top - frame.top }
  }
  const keep = (card: Element | null) => {
    const spot = spotOf(card)
    if (spot === null) return
    const parentId = units.find((unit) => unit.id === spot.id)?.parent_id ?? null
    kept.current = { card: spot, parentId, parent: parentId === null ? null : spotOf(cardOf(parentId)) }
  }
  const keepFrom = (target: EventTarget | null) => {
    if (target instanceof Element && nodes.current?.contains(target) === true) keep(target.closest('[data-unit-id]'))
  }

  /** Zooms to `next`, keeping still what is under the screen's point (the viewport's center when none is given). */
  const zoomTo = useCallback((next: number, pointX?: number, pointY?: number) => {
    const element = viewport.current
    const box = content.current
    const to = clampZoom(next)
    if (element === null || box === null || to === zoomRef.current) return
    const rect = element.getBoundingClientRect()
    const clientX = pointX ?? rect.left + element.clientLeft + element.clientWidth / 2
    const clientY = pointY ?? rect.top + element.clientTop + element.clientHeight / 2
    // A zoom that comes before the last one rendered keeps the first point, measured at the zoom on screen.
    if (anchor.current === null) {
      const at = box.getBoundingClientRect()
      anchor.current = { clientX, clientY, contentX: clientX - at.left, contentY: clientY - at.top, from: shown.current }
    }
    zoomRef.current = to
    setZoom(to)
  }, [])

  const center = useCallback(() => {
    const element = viewport.current
    if (element === null) return
    element.scrollLeft = scrollStart(element) + (element.scrollWidth - element.clientWidth) / 2
    element.scrollTop = 0
  }, [])

  /** Shows the whole chart, never past `fitMax`, its top in sight and its middle centered. */
  const fit = useCallback(() => {
    const element = viewport.current
    const box = content.current
    if (element === null || box === null) return
    const at = box.getBoundingClientRect()
    const width = at.width / shown.current
    const height = at.height / shown.current
    const fitted = clampZoom(Math.min(UNIT_CHART_ZOOM.fitMax, element.clientWidth / width, element.clientHeight / height))
    anchor.current = null
    if (fitted === zoomRef.current) {
      center()
      return
    }
    zoomRef.current = fitted
    setZoom(fitted)
  }, [center])

  // The chart opens fitted, and stays fitted while its viewport changes size until the person moves it: the drawer
  // widens for the chart only after the chart has mounted.
  useLayoutEffect(() => {
    const element = viewport.current
    if (element === null) return undefined
    fit()
    const observer = new ResizeObserver(() => {
      if (!moved.current) fit()
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [fit])

  useLayoutEffect(() => {
    const element = viewport.current
    const box = content.current
    const held = anchor.current
    shown.current = zoom
    anchor.current = null
    if (element === null || box === null) return
    if (held === null) {
      center()
      return
    }
    const ratio = zoom / held.from
    const at = box.getBoundingClientRect()
    element.scrollLeft += at.left + held.contentX * ratio - held.clientX
    element.scrollTop += at.top + held.contentY * ratio - held.clientY
  }, [zoom, center])

  // After a unit is added, moved or archived, the kept card goes back to where it stood; a card that moved or left gives
  // way to its parent's, and with neither the view is left as it is.
  const shownChart = useRef(chart)
  useLayoutEffect(() => {
    if (shownChart.current === chart) return
    shownChart.current = chart
    const element = viewport.current
    const held = kept.current
    if (element === null || held === null) return
    const unit = units.find((candidate) => candidate.id === held.card.id)
    const stayed = unit !== undefined && unit.archived_at === null && unit.parent_id === held.parentId
    const spot = stayed ? held.card : held.parent
    const card = spot === null ? null : cardOf(spot.id)
    if (spot === null || card === null) return
    const at = card.getBoundingClientRect()
    const frame = element.getBoundingClientRect()
    element.scrollLeft += at.left - frame.left - spot.left
    element.scrollTop += at.top - frame.top - spot.top
  })

  /** A zoom the person asked for: the chart stops following the viewport's size. */
  const zoomByHand = useCallback(
    (next: number, pointX?: number, pointY?: number) => {
      moved.current = true
      zoomTo(next, pointX, pointY)
    },
    [zoomTo],
  )

  // A pinch on a trackpad arrives as a wheel with Ctrl, and a pinch on a screen as two touches. Both need listeners
  // that may cancel the page's own zoom, which React's are not.
  useEffect(() => {
    const element = viewport.current
    if (element === null) return undefined
    const held: { pinch: { readonly distance: number; readonly zoom: number } | null } = { pinch: null }
    const distanceOf = (touches: TouchList) => {
      const a = touches[0]
      const b = touches[1]
      return a === undefined || b === undefined ? null : Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    }
    // Any scroll or zoom by the person ends the fitting: the wheel, a finger, the keyboard.
    const onMove = () => {
      moved.current = true
    }
    const onWheel = (event: WheelEvent) => {
      onMove()
      if (!event.ctrlKey) return
      event.preventDefault()
      zoomByHand(zoomRef.current * (1 - event.deltaY * UNIT_CHART_ZOOM.wheelPerPixel), event.clientX, event.clientY)
    }
    const onTouchStart = (event: TouchEvent) => {
      onMove()
      const distance = distanceOf(event.touches)
      held.pinch = distance === null || distance === 0 ? null : { distance, zoom: zoomRef.current }
    }
    const onTouchMove = (event: TouchEvent) => {
      const distance = distanceOf(event.touches)
      const a = event.touches[0]
      const b = event.touches[1]
      if (held.pinch === null || distance === null || a === undefined || b === undefined) return
      event.preventDefault()
      zoomByHand(
        held.pinch.zoom * (distance / held.pinch.distance),
        (a.clientX + b.clientX) / 2,
        (a.clientY + b.clientY) / 2,
      )
    }
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) held.pinch = null
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    element.addEventListener('touchstart', onTouchStart, { passive: true })
    element.addEventListener('touchmove', onTouchMove, { passive: false })
    element.addEventListener('touchend', onTouchEnd)
    element.addEventListener('touchcancel', onTouchEnd)
    element.addEventListener('keydown', onMove)
    return () => {
      element.removeEventListener('wheel', onWheel)
      element.removeEventListener('touchstart', onTouchStart)
      element.removeEventListener('touchmove', onTouchMove)
      element.removeEventListener('touchend', onTouchEnd)
      element.removeEventListener('touchcancel', onTouchEnd)
      element.removeEventListener('keydown', onMove)
    }
  }, [zoomByHand])

  // A mouse pans by dragging the background; a node keeps its own presses, and a scrollbar its drag. React bubbles a
  // press inside a portal (a node's menu or dialog) through the tree, so a press outside the canvas's DOM is not a pan.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const element = viewport.current
    const target = event.target
    if (!(target instanceof Node) || !event.currentTarget.contains(target)) return
    keepFrom(target)
    const onNode = nodes.current?.contains(target) === true
    if (element === null || event.pointerType !== 'mouse' || event.button !== 0 || onNode) return
    if (!inClientArea(element, event.clientX, event.clientY)) return
    element.setPointerCapture(event.pointerId)
    moved.current = true
    pan.current = { x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop }
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const element = viewport.current
    const from = pan.current
    if (element === null || from === null) return
    element.scrollLeft = from.left - (event.clientX - from.x)
    element.scrollTop = from.top - (event.clientY - from.y)
  }
  const endPan = () => {
    pan.current = null
  }

  return (
    <UnitActionsScope units={units} permissions={permissions} onFailure={onFailure}>
      {(actionsOf) => (
        <div className="flex flex-col gap-xs">
          <div className="flex items-center gap-2xs">
            <IconButton
              labelKey="units.zoomIn"
              isDisabled={zoom >= UNIT_CHART_ZOOM.max}
              onPress={() => {
                zoomByHand(zoomRef.current + UNIT_CHART_ZOOM.step)
              }}
            >
              <ZoomIn aria-hidden size={18} />
            </IconButton>
            <IconButton
              labelKey="units.zoomOut"
              isDisabled={zoom <= UNIT_CHART_ZOOM.min}
              onPress={() => {
                zoomByHand(zoomRef.current - UNIT_CHART_ZOOM.step)
              }}
            >
              <ZoomOut aria-hidden size={18} />
            </IconButton>
            <IconButton
              labelKey="units.zoomFit"
              onPress={() => {
                moved.current = false
                fit()
              }}
            >
              <Scan aria-hidden size={18} />
            </IconButton>
          </div>
          <div
            ref={viewport}
            role="region"
            aria-label={t('units.chartLabel')}
            // The canvas scrolls by keyboard too.
            tabIndex={0}
            onPointerDown={onPointerDown}
            onFocus={(event) => {
              keepFrom(event.target)
            }}
            onScroll={() => {
              keep(kept.current === null ? null : cardOf(kept.current.card.id))
            }}
            onPointerMove={onPointerMove}
            onPointerUp={endPan}
            onPointerCancel={endPan}
            className="h-chart cursor-grab touch-pan-x touch-pan-y overflow-auto overscroll-contain rounded-panel border border-line bg-canvas outline-focus data-focus-visible:outline-2 focus-visible:outline-2"
          >
            <div ref={content} style={{ zoom }} className="mx-auto w-max p-lg">
              <div
                className="relative"
                style={{
                  width: `calc(${COLUMN} * ${String(chart.slots)} - var(--spacing-chart-gap))`,
                  height: `calc(${ROW} * ${String(chart.depths)} - var(--spacing-chart-row-gap))`,
                }}
              >
                <div aria-hidden>
                  {chart.families.map((family) => (
                    <Connectors key={`${String(family.depth)}-${String(family.parentSlot)}`} family={family} />
                  ))}
                </div>
                <ul ref={nodes} aria-label={t('units.listLabel')}>
                  {chart.nodes.map((node) => (
                    <ChartNode
                      key={node.unit.id}
                      node={node}
                      levelName={
                        node.unit.unit_level_id === null ? null : (levelNames.get(node.unit.unit_level_id) ?? null)
                      }
                      canUpdate={permissions.update(node.unit)}
                      actions={actionsOf(node.unit)}
                    />
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </UnitActionsScope>
  )
}
