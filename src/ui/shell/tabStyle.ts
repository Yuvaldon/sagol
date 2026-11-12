// The look of a destination in the bottom strip (D-252), shared by the destinations and the menu.

/** One destination: a 44 px target, its icon over its name, as wide as its name. Its color says whether it is the current one. */
export const TAB =
  'relative inline-flex min-h-touch min-w-touch shrink-0 cursor-pointer flex-col items-center justify-center gap-2xs rounded-pill px-sm text-micro font-semibold whitespace-nowrap outline-focus outline-offset-2 data-focus-visible:outline-2 data-hovered:bg-inner'

export const TAB_COLOR = { current: 'text-text', other: 'text-text-muted' } as const
