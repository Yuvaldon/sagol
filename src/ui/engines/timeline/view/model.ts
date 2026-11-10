import type { LucideIcon } from 'lucide-react'

// The neutral model the timeline view renders: days and rows of text, with no domain entity in sight.
// Only the adapter builds it (ARCHITECTURE "View engines").

export interface TimelineDayCell {
  readonly key: string
  /** The weekday, as short as the locale writes it. */
  readonly weekday: string
  readonly dayNumber: string
  readonly isToday: boolean
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
