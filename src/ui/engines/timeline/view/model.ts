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
}

export type TimelineRowModel = TimelineGroupRow | TimelineResourceRow
