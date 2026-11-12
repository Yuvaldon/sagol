import type { LucideIcon } from 'lucide-react'
import type { DayRange, DragKind } from '../core/drag'

// The neutral model the timeline view renders: days and rows of text, with no domain entity in sight.
// Only the adapter builds it (ARCHITECTURE "View engines").

export interface TimelineDayCell {
  readonly key: string
  /** The weekday, as short as the locale writes it. */
  readonly weekday: string
  readonly dayNumber: string
  readonly isToday: boolean
  /** The day read aloud, for the control that opens its report. */
  readonly label: string
  /** Opens the day report on the day (D-193); NULL when there is none to open. */
  readonly onOpen: (() => void) | null
}

export interface TimelineGroupRow {
  readonly kind: 'group'
  readonly key: string
  readonly label: string
  readonly count: number
}

export interface TimelineResourceRow {
  readonly kind: 'resource'
  readonly key: string
  readonly name: string
  /** A second, quieter label beside the name. */
  readonly detail: string | null
  /** One flag per day: true where the row is muted. */
  readonly offDays: readonly boolean[]
  /** What the muted days mean, read aloud. NULL when no day is muted. */
  readonly offText: string | null
  /** Opens the row's details. NULL when the actor may not open them (D-076). */
  readonly onOpen: (() => void) | null
  /** Whether a drag on the row's empty days marks a new item (D-143). */
  readonly creatable: boolean
  /** The row's bars and badges, each in its lane. */
  readonly marks: readonly TimelineMark[]
  /** How many lanes the row needs, at least one. */
  readonly lanes: number
}

export type TimelineRowModel = TimelineGroupRow | TimelineResourceRow

/** How a mark is painted: classes the adapter picks, so the view knows no palette (D-111). */
export interface TimelineTone {
  readonly fill: string
  readonly faint: string
  readonly edge: string
  readonly ink: string
}

/**
 * A bar over a run of days, or a badge on each of them (a marker). Days are indexes in the window; a side
 * the window cuts has no inset.
 */
export interface TimelineMark {
  readonly key: string
  readonly kind: 'bar' | 'badge'
  readonly start: number
  readonly length: number
  readonly cut: { readonly start: boolean; readonly end: boolean }
  /** Every day of the item as offsets from the window's first day, also days the window cuts (D-143). */
  readonly range: DayRange
  /** What a drag may do with it: NULL when it does not move; a badge never resizes (D-143). */
  readonly drag: { readonly resize: boolean } | null
  readonly lane: number
  /** Pending: a dashed edge over a faint fill. Otherwise solid (D-111). */
  readonly dashed: boolean
  readonly tone: TimelineTone
  /** A badge's icon. */
  readonly Icon: LucideIcon | null
  /** The uniform mode's dot of the type's color, and the type's name inside the bar (D-112). */
  readonly dot: string | null
  readonly caption: string | null
  /** The mark's name as a control: what, its status and its days (D-119). */
  readonly label: string
  /** Opens what the mark stands for. */
  readonly onOpen: () => void
}

/**
 * A day of the heat row (D-141): how many rules break that day, and the worst of them by form and color. A day with
 * none is empty and opens nothing.
 */
export interface TimelineHeatCell {
  readonly key: string
  readonly tone: 'hard' | 'soft' | 'none'
  /** The number shown in the cell; NULL when nothing breaks. */
  readonly count: string | null
  /** The day, the count and the worst, read aloud. */
  readonly label: string
  readonly onOpen: (() => void) | null
}

export type { DayRange, DragKind } from '../core/drag'

/** A drag on the board (D-143): which row, which mark (NULL marks days for a new item), what it does, and its days. */
export interface TimelineDrag {
  readonly rowKey: string
  readonly markKey: string | null
  readonly kind: DragKind
  readonly range: DayRange
}

/**
 * The worst a drag would break, as the edge of its ghost says it: nothing, a soft rule or a hard one; `unknown` while
 * the rules are read or cannot be (OI-099).
 */
export type TimelineDragTone = 'ok' | 'soft' | 'hard' | 'unknown'

/** What the view tells about a drag, and what it hears back. */
export interface TimelineDragProps {
  /** Every change of the drag's days, and NULL when it ends without a drop. */
  readonly onChange: (drag: TimelineDrag | null) => void
  readonly onDrop: (drag: TimelineDrag) => void
  readonly tone: TimelineDragTone
  /** A drop that waits for its answer, painted where it was dropped. */
  readonly held: TimelineDrag | null
}
