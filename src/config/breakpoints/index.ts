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

/**
 * The desktop layout also needs this much height. A phone on its side is wide but short (about 900 by 400): it keeps
 * the phone's bars, with the destinations at the bottom, instead of the desktop's single top bar (D-190). The `ui`
 * theme's `md` variant declares the same pair.
 */
export const DESKTOP_MIN_HEIGHT_PX = 512

export const DESKTOP_MEDIA_QUERY = `(min-width: ${BREAKPOINTS_PX[DESKTOP_BREAKPOINT]}px) and (min-height: ${DESKTOP_MIN_HEIGHT_PX}px)`

/**
 * Below the desktop layout, from this width up the phone is on its side (or a small tablet): its top bar has room for
 * the scope, the view and the filters, so the row under it folds into the bar and the board keeps the height (D-190).
 */
export const WIDE_PHONE_MEDIA_QUERY = `(min-width: ${BREAKPOINTS_PX.sm}px)`

/** The device asks for a dark screen; "the device's" appearance follows it (D-181). */
export const DARK_SCHEME_MEDIA_QUERY = '(prefers-color-scheme: dark)'
