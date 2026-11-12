// The day report (D-193 … D-196): its span, the order of its text copy and the measures of its image.

/** The categories of a day, in the order the report shows them (D-193). Present and absent partition the day. */
export const DAY_REPORT_CATEGORIES = ['present', 'absent', 'leaving', 'returning'] as const
export type DayReportCategory = (typeof DAY_REPORT_CATEGORIES)[number]

export const DAY_REPORT = {
  /** The most days a span holds, the first included (D-193). */
  maxSpanDays: 7,
  /** How long a notice of the copy or the image stays on screen. */
  noticeMs: 2400,
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
    /** Joins the parts of a line: the title, the scope and the date, or the counts. */
    separator: ' · ',
    /** Opens a soldier's line. */
    bullet: '• ',
    /** Sets the absence's type and reason apart from the name. */
    details: ' – ',
  },
  /** The image (D-196): its measures in logical pixels, drawn at `pixelRatio` times as many device pixels. */
  image: {
    widthPx: 720,
    paddingPx: 32,
    titlePx: 28,
    headingPx: 20,
    bodyPx: 16,
    lineGapPx: 8,
    sectionGapPx: 24,
    /** The rule drawn between the days of a span. */
    ruleWidthPx: 1,
    /** A canvas taller than this is drawn smaller, as browsers refuse larger ones. */
    maxHeightPx: 16000,
    pixelRatio: 2,
    fileStem: 'sagol-day-report',
    mimeType: 'image/png',
    /** How long a downloaded image's address stays alive, so the browser has started the download first. */
    revokeAfterMs: 60000,
  },
} as const
