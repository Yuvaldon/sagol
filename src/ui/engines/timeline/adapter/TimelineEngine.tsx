import { RulesRowPlacement } from '@contracts'
import { filterUnitOf, useHeatRow, useNavigationPreferences, useRulesDay } from '@logic'
import { useMemo } from 'react'
import { BoardEngine, type BoardFrame } from '../../../board/BoardEngine'
import { TimelineGrid } from '../view/TimelineGrid'
import { useBoardDrag } from './boardDrag'
import { DragOverlay } from './DragOverlay'
import { dayCells, heatCells, timelineRows } from './model'

// The timeline as the viewport shows it. The adapter is the only part that meets the domain (model.ts); the frame
// around it, the window, the filter and the empty states, is every engine's (D-174).

function Timeline({ model, window, filter, colors, openSoldier, openLeave }: BoardFrame) {
  const rulesDay = useRulesDay()
  const unit = filterUnitOf(filter)
  const heat = useHeatRow(window, unit.kind === 'unit' ? unit.unitId : null)
  const { rulesRow, settled } = useNavigationPreferences()
  const soldiers = useMemo(() => model.items.flatMap((item) => (item.kind === 'soldier' ? [item.soldier] : [])), [model.items])
  const drag = useBoardDrag(window, soldiers)
  const { movable, creatable } = drag
  // The rows are rebuilt only when what they show changes, not on every pointer move of a drag (OI-097).
  const rows = useMemo(
    () => timelineRows(model.items, model.days, openSoldier, { leaves: model.leaves, colors, openLeave, movable, creatable }),
    [model, openSoldier, colors, openLeave, movable, creatable],
  )
  const days = useMemo(() => dayCells(model.days, model.today), [model.days, model.today])
  return (
    <>
      <TimelineGrid
        days={days}
        rows={rows}
        // The row waits for the soldier's placement, so it does not appear in one place and move to the other (D-173).
        heat={settled && heat.status === 'ready' && heat.value !== null ? heatCells(heat.value, rulesDay.openOn) : null}
        heatOnTop={rulesRow === RulesRowPlacement.enum.above}
        drag={drag.props}
      />
      <DragOverlay drag={drag} />
    </>
  )
}

/** The timeline engine. */
export function TimelineEngine() {
  return <BoardEngine>{(frame) => <Timeline {...frame} />}</BoardEngine>
}
