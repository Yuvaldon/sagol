import { BOARD, type RangeKind } from '@config'
import { useDateWindow, useToday, type DateWindow } from '@logic'
import { useCallback, useMemo } from 'react'
import { BoardEngine, type BoardFrame } from '../../../board/BoardEngine'
import { BoardScreen } from '../../../board/BoardScreen'
import type { PinchDirection } from '../../../board/gestures'
import { useRangeHead } from '../../../board/rangeHead'
import { useIsDesktop } from '../../../patterns/media'
import { useBoardDrag } from './boardDrag'
import { DragOverlay } from './DragOverlay'
import { PersonTimeline } from './PersonTimeline'

// The timeline as the viewport shows it (D-480, D-491): the person bars on every width. The adapter is the only part
// that meets the domain; the frame around it, the window, the filter and the empty states, is every engine's (D-174).
// A wide screen drags its bars (D-143) and says what a drag would do in the drag's card; a phone pinches its range.

/** A wide screen's timeline: the person bars, dragged. */
function WideTimeline({ frame }: { readonly frame: BoardFrame }) {
  const soldiers = useMemo(() => frame.model.items.flatMap((item) => (item.kind === 'soldier' ? [item.soldier] : [])), [frame.model.items])
  const drag = useBoardDrag(frame.window, soldiers)
  return (
    <>
      <PersonTimeline frame={frame} onStep={NO_STEP} onPinch={null} drag={drag} nameColumnPx={BOARD.timeline.wideNameColumnPx} />
      <DragOverlay drag={drag} />
    </>
  )
}

const NO_STEP = () => undefined
const PINCH_RANGES: readonly RangeKind[] = BOARD.timeline.pinchRanges

/**
 * A pinch steps the range (OI-399): fingers apart show fewer days (a rotation, a month, a week), together more. A range
 * the steps do not hold (another range) starts from a month. The rotation is the one the window is on, or the one that
 * holds its first day, or the latest.
 */
function usePinchRange(window: DateWindow | null): ((direction: PinchDirection) => void) | null {
  const { rotations, setRange, showRotation } = useDateWindow()
  return useCallback(
    (direction: PinchDirection) => {
      if (window === null) return
      const at = PINCH_RANGES.indexOf(window.kind === 'rotation' || window.kind === 'week' || window.kind === 'month' ? window.kind : 'month')
      const next = PINCH_RANGES[direction === 'spread' ? at - 1 : at + 1]
      if (next === undefined) return
      if (next !== 'rotation') {
        setRange(next)
        return
      }
      const rotation =
        rotations.find((candidate) => candidate.start_date <= window.from && (candidate.end_date === null || candidate.end_date >= window.from)) ??
        rotations.at(-1)
      if (rotation !== undefined) showRotation(rotation.id)
    },
    [window, rotations, setRange, showRotation],
  )
}

/** The timeline engine. */
export function TimelineEngine() {
  const desktop = useIsDesktop()
  const { head, board } = useRangeHead('timeline', !desktop)
  const today = useToday()
  const onPinch = usePinchRange(board.window)
  // A phone's list that starts at the top: its title gives way to the centered capsule once it is scrolled (§1.5,
  // OI-399). A wide screen keeps its head: its arrows and "היום" are the mouse's only way to step the range (D-496).
  const listHead = useMemo(() => ({ ...head, collapses: !desktop }), [head, desktop])
  return (
    <BoardScreen head={listHead}>
      <BoardEngine window={board.window} today={today}>
        {(frame) =>
          desktop ? (
            <WideTimeline frame={frame} />
          ) : (
            <PersonTimeline frame={frame} onStep={board.step} onPinch={onPinch} drag={null} nameColumnPx={BOARD.timeline.nameColumnPx} />
          )
        }
      </BoardEngine>
    </BoardScreen>
  )
}
