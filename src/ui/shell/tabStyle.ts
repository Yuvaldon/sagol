// The look of a tab in the phone's bottom bar (V20), shared by its destinations and the menu.

/** One tab: a 44 px target, its icon over its name. Its color says whether it is the current one. */
export const TAB =
  'relative inline-flex min-h-touch min-w-touch flex-1 shrink-0 cursor-pointer flex-col items-center justify-center gap-2xs rounded-pill px-xs text-micro font-semibold whitespace-nowrap outline-focus outline-offset-2 data-focus-visible:outline-2 data-hovered:bg-inner'

export const TAB_COLOR = { current: 'text-text', other: 'text-text-muted' } as const
