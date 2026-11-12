import type { BarColorMode } from '@config'
import type { BoardLeave } from '@logic'
import { Button as AriaButton } from 'react-aria-components'
import { TEXT_SEPARATOR, leaveDetails, leaveTone, rangeText, typeName } from './labels'

// A leave as the list and the calendar show it (D-174): its color, a name and, where asked, its days. Every chip opens
// the leave (D-119); a pending one is dashed, as on the timeline (D-111).

export function LeaveChip({
  leave,
  colors,
  onOpen,
  name,
  dates,
}: {
  readonly leave: BoardLeave
  readonly colors: BarColorMode
  readonly onOpen: (leaveId: string) => void
  /** Who the leave is of, where the chip is not in the soldier's own row. */
  readonly name?: string
  readonly dates: boolean
}) {
  const tone = leaveTone(leave, colors)
  const range = rangeText(leave.start_date, leave.end_date)
  // The name is the text itself, so a reader hears what is seen, in leaveText's order (WCAG 2.5.3). The hidden part is
  // laid out apart from its neighbours, so a browser puts a space, not a separator, before it.
  const unseen = [...(name === undefined ? [] : [typeName(leave)]), ...leaveDetails(leave), ...(dates ? [] : [range])]
  return (
    <AriaButton
      data-leave={leave.id}
      onPress={() => {
        onOpen(leave.id)
      }}
      className={`inline-flex min-h-touch max-w-full cursor-pointer items-center gap-xs rounded-pill border bg-surface px-sm text-label outline-focus outline-offset-1 md:min-h-control data-focus-visible:outline-2 data-hovered:bg-inner ${leave.status === 'pending' ? `border-dashed ${tone.edge}` : 'border-line'}`}
    >
      <span aria-hidden className={`size-dot shrink-0 rounded-pill ${tone.fill}`} />
      <span className="min-w-none truncate">
        <span className="font-medium text-text">{name ?? typeName(leave)}</span>
        <span className="sr-only">
          {unseen.join(TEXT_SEPARATOR)}
          {dates ? TEXT_SEPARATOR : null}
        </span>
        {dates ? <span className="ms-xs text-text-muted tabular-nums">{range}</span> : null}
      </span>
    </AriaButton>
  )
}
