import { filterUnitOf, useHeatRow, useRulesDay, useToday } from '@logic'
import { useMemo } from 'react'
import { BoardEngine, type BoardFrame } from '../../../board/BoardEngine'
import { BoardScreen } from '../../../board/BoardScreen'
import { useRangeHead } from '../../../board/rangeHead'
import { useIsDesktop } from '../../../patterns/media'
import { TimelineGrid } from '../view/TimelineGrid'
import { useBoardDrag } from './boardDrag'
import { DragOverlay } from './DragOverlay'
import { dayCells, heatCells, timelineRows } from './model'
import { PhoneTimeline } from './PhoneTimeline'

// The timeline as the viewport shows it. The adapter is the only part that meets the domain (model.ts); the frame
// around it, the window, the filter and the empty states, is every engine's (D-174). A phone draws the person bars of
// the new interface (D-480); a wide screen keeps the grid that drags until its own pass (D-143, D-458, R5·6).

function Timeline({ model, window, filter, colors, openSoldier, openLeave, openDay }: BoardFrame) {
  const rulesDay = useRulesDay()
  const unit = filterUnitOf(filter)
  const heat = useHeatRow(window, unit.kind === 'unit' ? unit.unitId : null)
  const soldiers = useMemo(() => model.items.flatMap((item) => (item.kind === 'soldier' ? [item.soldier] : [])), [model.items])
  const drag = useBoardDrag(window, soldiers)
  const { movable, creatable } = drag
  // The rows are rebuilt only when what they show changes, not on every pointer move of a drag (OI-097).
  const rows = useMemo(
    () => timelineRows(model.items, model.days, openSoldier, { leaves: model.leaves, colors, openLeave, movable, creatable }),
    [model, openSoldier, colors, openLeave, movable, creatable],
  )
  const days = useMemo(() => dayCells(model.days, model.today, openDay), [model.days, model.today, openDay])
  return (
    <>
      <TimelineGrid
        days={days}
        rows={rows}
        heat={heat.status === 'ready' && heat.value !== null ? heatCells(heat.value, rulesDay.openOn) : null}
        drag={drag.props}
      />
      <DragOverlay drag={drag} />
    </>
  )
}

/** The timeline engine. */
export function TimelineEngine() {
  const desktop = useIsDesktop()
  const { head, board } = useRangeHead('timeline', !desktop)
  const today = useToday()
  return (
    <BoardScreen head={head}>
      <BoardEngine window={board.window} today={today}>
        {(frame) => (desktop ? <Timeline {...frame} /> : <PhoneTimeline frame={frame} onStep={board.step} />)}
      </BoardEngine>
    </BoardScreen>
  )
}
