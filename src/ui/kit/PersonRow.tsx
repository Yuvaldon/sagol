import type { ReactNode } from 'react'
import { Button as AriaButton } from 'react-aria-components'

// A person in a list of the new interface (D-454): the name, a quiet line under it, and what belongs at the row's end.
// Rows are thin and divided by a hairline; a row that opens something is one button.

export interface PersonRowProps {
  readonly name: string
  readonly detail?: string | undefined
  readonly trailing?: ReactNode
  readonly onPress?: () => void
}

const TEXT = 'flex min-w-none flex-1 flex-col text-start'

export function PersonRow({ name, detail, trailing, onPress }: PersonRowProps) {
  const text = (
    <>
      <span className="truncate text-body font-semibold">{name}</span>
      {detail === undefined ? null : <span className="truncate text-small text-text-muted tabular-nums">{detail}</span>}
    </>
  )
  return (
    <div className="flex min-h-touch items-center gap-sm border-b border-divider-strong py-xs last:border-b-0">
      {onPress === undefined ? (
        <span className={TEXT}>{text}</span>
      ) : (
        <AriaButton
          onPress={onPress}
          className={`${TEXT} min-h-touch cursor-pointer justify-center rounded-control outline-focus -outline-offset-2 data-focus-visible:outline-2`}
        >
          {text}
        </AriaButton>
      )}
      {trailing}
    </div>
  )
}
