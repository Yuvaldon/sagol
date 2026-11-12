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
  return Math.round(Math.min(UNIT_CHART_ZOOM.max, Math.max(UNIT_CHART_ZOOM.min, zoom)) * 100) / 100
}

/** Where a zoom keeps its point: a spot on the viewport, and the content under it before the zoom. */
interface ZoomAnchor {
  readonly offsetX: number
  readonly offsetY: number
  readonly contentX: number
  readonly contentY: number
  readonly from: number
}

/** The lowest `scrollLeft`: negative when the content overflows toward the inline end, right to left. */
function scrollStart(element: HTMLElement): number {
  return getComputedStyle(element).direction === 'rtl' ? element.clientWidth - element.scrollWidth : 0
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
      data-chart-node
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
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(zoom)
  const anchor = useRef<ZoomAnchor | null>(null)
  const pan = useRef<{ readonly x: number; readonly y: number; readonly left: number; readonly top: number } | null>(
    null,
  )

  /** Zooms to `next`, keeping still what is under the viewport's point (its center when none is given). */
  const zoomTo = useCallback((next: number, clientX?: number, clientY?: number) => {
    const element = viewport.current
    const to = clampZoom(next)
    if (element === null || to === zoomRef.current) return
    const rect = element.getBoundingClientRect()
    const offsetX = clientX === undefined ? element.clientWidth / 2 : clientX - rect.left
    const offsetY = clientY === undefined ? element.clientHeight / 2 : clientY - rect.top
    anchor.current = {
      offsetX,
      offsetY,
      contentX: element.scrollLeft - scrollStart(element) + offsetX,
      contentY: element.scrollTop + offsetY,
      from: zoomRef.current,
    }
    zoomRef.current = to
    setZoom(to)
  }, [])

  /** The zoom that shows the whole chart, never past `fitMax`. */
  const fit = () => {
    const element = viewport.current
    if (element === null) return
    const width = element.scrollWidth / zoomRef.current
    const height = element.scrollHeight / zoomRef.current
    zoomTo(Math.min(UNIT_CHART_ZOOM.fitMax, element.clientWidth / width, element.clientHeight / height))
  }

  // The chart opens fitted, its top in sight and its middle centered.
  useLayoutEffect(() => {
    const element = viewport.current
    if (element === null) return
    const width = element.scrollWidth
    const height = element.scrollHeight
    const fitted = clampZoom(Math.min(UNIT_CHART_ZOOM.fitMax, element.clientWidth / width, element.clientHeight / height))
    zoomRef.current = fitted
    setZoom(fitted)
    anchor.current = null
  }, [])

  useLayoutEffect(() => {
    const element = viewport.current
    const held = anchor.current
    if (element === null) return
    anchor.current = null
    if (held === null) {
      element.scrollLeft = scrollStart(element) + (element.scrollWidth - element.clientWidth) / 2
      element.scrollTop = 0
      return
    }
    const ratio = zoom / held.from
    element.scrollLeft = scrollStart(element) + held.contentX * ratio - held.offsetX
    element.scrollTop = held.contentY * ratio - held.offsetY
  }, [zoom])

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
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return
      event.preventDefault()
      zoomTo(zoomRef.current * (1 - event.deltaY * UNIT_CHART_ZOOM.wheelPerPixel), event.clientX, event.clientY)
    }
    const onTouchStart = (event: TouchEvent) => {
      const distance = distanceOf(event.touches)
      held.pinch = distance === null || distance === 0 ? null : { distance, zoom: zoomRef.current }
    }
    const onTouchMove = (event: TouchEvent) => {
      const distance = distanceOf(event.touches)
      const a = event.touches[0]
      const b = event.touches[1]
      if (held.pinch === null || distance === null || a === undefined || b === undefined) return
      event.preventDefault()
      zoomTo(held.pinch.zoom * (distance / held.pinch.distance), (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2)
    }
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) held.pinch = null
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    element.addEventListener('touchstart', onTouchStart, { passive: true })
    element.addEventListener('touchmove', onTouchMove, { passive: false })
    element.addEventListener('touchend', onTouchEnd)
    element.addEventListener('touchcancel', onTouchEnd)
    return () => {
      element.removeEventListener('wheel', onWheel)
      element.removeEventListener('touchstart', onTouchStart)
      element.removeEventListener('touchmove', onTouchMove)
      element.removeEventListener('touchend', onTouchEnd)
      element.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [zoomTo])

  // A mouse pans by dragging the background; a node keeps its own presses.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const element = viewport.current
    const onNode = event.target instanceof Element && event.target.closest('[data-chart-node]') !== null
    if (element === null || event.pointerType !== 'mouse' || event.button !== 0 || onNode) return
    element.setPointerCapture(event.pointerId)
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
                zoomTo(zoom + UNIT_CHART_ZOOM.step)
              }}
            >
              <ZoomIn aria-hidden size={18} />
            </IconButton>
            <IconButton
              labelKey="units.zoomOut"
              isDisabled={zoom <= UNIT_CHART_ZOOM.min}
              onPress={() => {
                zoomTo(zoom - UNIT_CHART_ZOOM.step)
              }}
            >
              <ZoomOut aria-hidden size={18} />
            </IconButton>
            <IconButton labelKey="units.zoomFit" onPress={fit}>
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
            onPointerMove={onPointerMove}
            onPointerUp={endPan}
            onPointerCancel={endPan}
            className="h-chart cursor-grab touch-pan-x touch-pan-y overflow-auto overscroll-contain rounded-panel border border-line bg-canvas outline-focus data-focus-visible:outline-2 focus-visible:outline-2"
          >
            <div style={{ zoom }} className="mx-auto w-max p-lg">
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
                <ul aria-label={t('units.listLabel')}>
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
