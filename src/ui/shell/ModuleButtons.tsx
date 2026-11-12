import { t } from '@i18n'
import { useNavigationPreferences } from '@logic'
import { Button as AriaButton } from 'react-aria-components'
import { useIsDesktop } from '../patterns/media'
import { useDailyEntries, useNavigationEntries, type ModuleEntry } from './moduleEntries'

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

/** Icon and name on desktop, the icon alone on a phone, its name still read aloud, with the number waiting. */
function ModuleButton({ entry, isDesktop }: { readonly entry: ModuleEntry; readonly isDesktop: boolean }) {
  return (
    <AriaButton
      onPress={entry.onPress}
      className="relative inline-flex min-h-touch min-w-touch shrink-0 cursor-pointer items-center justify-center gap-xs rounded-pill px-sm text-control font-semibold whitespace-nowrap text-text outline-focus outline-offset-2 md:min-h-control md:bg-inner md:px-md data-focus-visible:outline-2 data-hovered:bg-line"
    >
      <entry.Icon aria-hidden size={isDesktop ? 14 : 18} className="text-text-muted md:text-text" />
      <span className={isDesktop ? '' : 'sr-only'}>{t(entry.labelKey)}</span>
      <EntryCount entry={entry} floating={!isDesktop} />
    </AriaButton>
  )
}

/** The daily modules, then the soldier's pins in the order they were pinned (D-173). */
export function ModuleButtons() {
  const isDesktop = useIsDesktop()
  const daily = useDailyEntries()
  const navigation = useNavigationEntries()
  const { pinned, editable } = useNavigationPreferences()
  const pins = editable ? pinned.flatMap((module) => navigation.get(module) ?? []) : []
  return (
    <>
      {[...daily, ...pins].map((entry) => (
        <ModuleButton key={entry.id} entry={entry} isDesktop={isDesktop} />
      ))}
    </>
  )
}
