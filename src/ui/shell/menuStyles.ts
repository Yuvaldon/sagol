import type { Selection } from 'react-aria-components'

// The looks the bars' menus share (D-108, D-211, D-214), and how they read a single selection.

export const MENU_ITEM =
  'flex min-h-touch cursor-pointer items-center gap-sm rounded-control px-md text-control whitespace-nowrap outline-none md:min-h-control data-focused:bg-inner'
export const MENU_HEADER = 'px-md pt-xs pb-2xs text-label font-semibold text-text-muted'
export const MENU_TRIGGER =
  'inline-flex min-h-touch min-w-touch cursor-pointer items-center justify-center gap-xs rounded-pill bg-inner px-sm text-control font-semibold text-text outline-focus outline-offset-2 md:min-h-control md:min-w-control data-focus-visible:outline-2 data-hovered:bg-line'
export const MENU_POPOVER = 'glass-menu min-w-trigger rounded-panel p-xs'
export const MENU_LIST = 'flex max-w-menu flex-col gap-2xs outline-none'

/** The one key of a single selection, or NULL. */
export function onlyKey(selection: Selection): string | null {
  if (selection === 'all') return null
  const [key] = [...selection]
  return typeof key === 'string' ? key : null
}
