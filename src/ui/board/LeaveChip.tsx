import type { BarColorMode } from '@config'
import type { BoardLeave } from '@logic'
import { Button as AriaButton } from 'react-aria-components'
import { TEXT_SEPARATOR, leaveText, leaveTone, rangeText, typeName } from './labels'

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
  const label = name === undefined ? leaveText(leave) : `${name}${TEXT_SEPARATOR}${leaveText(leave)}`
  return (
    <AriaButton
      aria-label={label}
      data-leave={leave.id}
      onPress={() => {
        onOpen(leave.id)
      }}
      className={`inline-flex min-h-touch max-w-full cursor-pointer items-center gap-xs rounded-pill border bg-surface px-sm text-label outline-focus outline-offset-1 md:min-h-control data-focus-visible:outline-2 data-hovered:bg-inner ${leave.status === 'pending' ? `border-dashed ${tone.edge}` : 'border-line'}`}
    >
      <span aria-hidden className={`size-dot shrink-0 rounded-pill ${tone.fill}`} />
      <span aria-hidden className="truncate font-medium text-text">
        {name ?? typeName(leave)}
      </span>
      {dates ? (
        <span aria-hidden className="shrink-0 text-text-muted tabular-nums">
          {rangeText(leave.start_date, leave.end_date)}
        </span>
      ) : null}
    </AriaButton>
  )
}
