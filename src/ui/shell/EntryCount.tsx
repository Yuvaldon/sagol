import { t } from '@i18n'
import type { ModuleEntry } from './moduleEntries'

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
