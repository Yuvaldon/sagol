// Viewport breakpoints in CSS pixels (D-074). Same values as Tailwind's `sm` ... `xl`; the
// `ui` theme declares them for CSS, and code that must branch on width reads them here.

export const BREAKPOINTS_PX = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const

export type Breakpoint = keyof typeof BREAKPOINTS_PX

/** From this width up the workspace is desktop (top bar, side drawer); below it, mobile. */
export const DESKTOP_BREAKPOINT: Breakpoint = 'md'

export const DESKTOP_MEDIA_QUERY = `(min-width: ${BREAKPOINTS_PX[DESKTOP_BREAKPOINT]}px)`

/** The device asks for a dark screen; "the device's" appearance follows it (D-181). */
export const DARK_SCHEME_MEDIA_QUERY = '(prefers-color-scheme: dark)'
