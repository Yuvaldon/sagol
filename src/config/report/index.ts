// The day report (D-193 … D-196): its span, the order of its text copy and the measures of its image.

/** The categories of a day, in the order the report shows them (D-193). Present and absent partition the day. */
export const DAY_REPORT_CATEGORIES = ['present', 'absent', 'leaving', 'returning'] as const
export type DayReportCategory = (typeof DAY_REPORT_CATEGORIES)[number]

export const DAY_REPORT = {
  /** The most days a span holds, the first included (D-193). */
  maxSpanDays: 7,
  /**
   * The text copy (D-195): the parts of each day in order, and the categories whose names it lists. Present names are
   * left out; their count carries them.
   */
  text: {
    sections: ['header', 'counts', 'units'],
    listed: ['absent', 'leaving', 'returning'],
    /** Starts every line, so a line that opens with a digit or a Latin name stays right to left. */
    lineStart: '‏',
    /** WhatsApp's and Telegram's bold. */
    bold: '*',
  },
  /** The image (D-196), in CSS pixels before the device's pixel ratio is applied. */
  image: {
    widthPx: 720,
    paddingPx: 32,
    titlePx: 28,
    headingPx: 20,
    bodyPx: 16,
    lineGapPx: 8,
    sectionGapPx: 24,
    /** A canvas taller than this is drawn smaller, as browsers refuse larger ones. */
    maxHeightPx: 16000,
    pixelRatio: 2,
    fileStem: 'sagol-day-report',
    mimeType: 'image/png',
  },
} as const
