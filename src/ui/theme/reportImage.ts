// The day report's image (D-196) is drawn in the light tokens whatever the theme, as it is read on someone else's
// screen. These mirror the light values of tailwind.css; the canvas cannot read CSS variables of a theme not applied.

export const REPORT_IMAGE_TONES = {
  background: '#ffffff',
  text: '#1b1a1f',
  muted: '#5c5a63',
  line: '#d9d6cf',
} as const

export const REPORT_IMAGE_FONT = '"Heebo Variable", system-ui, sans-serif'

/** The font weights of the image's lines: titles and counts bold, names regular. */
export const REPORT_IMAGE_WEIGHTS = { regular: 400, bold: 700 } as const
