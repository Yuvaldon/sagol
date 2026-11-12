import { TOOLTIP } from '@config'
import { t } from '@i18n'
import { Button as AriaButton, TooltipTrigger } from 'react-aria-components'
import { NameTooltip } from '../primitives/Button'
import { useDailyEntries, type ModuleEntry } from './moduleEntries'

/** The number waiting on a module, read with its name. */
export function EntryCount({ entry, floating }: { readonly entry: ModuleEntry; readonly floating: boolean }) {
  if (entry.count === null || entry.count.value === 0) return null
  return (
    <span
      className={`${floating ? 'absolute end-none top-xs' : ''} inline-flex min-w-icon items-center justify-center rounded-pill bg-action-solid px-xs text-micro text-on-action tabular-nums`}
    >
      {entry.count.value}
      <span className="sr-only"> {t(entry.count.labelKey)}</span>
    </span>
  )
}

/** A destination in the desktop bar (V20): its icon, its name on hover and read aloud, and the number waiting. */
function ModuleButton({ entry }: { readonly entry: ModuleEntry }) {
  const name = t(entry.labelKey)
  return (
    <TooltipTrigger delay={TOOLTIP.delayMs} closeDelay={TOOLTIP.closeDelayMs}>
      <AriaButton
        onPress={entry.onPress}
        className="relative inline-flex min-h-touch min-w-touch shrink-0 cursor-pointer items-center justify-center rounded-pill text-text-muted outline-focus outline-offset-2 md:min-h-control md:min-w-control data-focus-visible:outline-2 data-hovered:bg-inner"
      >
        <entry.Icon aria-hidden size={16} />
        <span className="sr-only">{name}</span>
        <EntryCount entry={entry} floating />
      </AriaButton>
      <NameTooltip>{name}</NameTooltip>
    </TooltipTrigger>
  )
}

/** The daily modules: the desktop's destinations. Nothing is pinned to the bar (D-254). */
export function ModuleButtons() {
  const daily = useDailyEntries()
  return (
    <>
      {daily.map((entry) => (
        <ModuleButton key={entry.id} entry={entry} />
      ))}
    </>
  )
}
