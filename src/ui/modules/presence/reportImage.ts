import { DAY_REPORT, DAY_REPORT_CATEGORIES } from '@config'
import type { DayReport, ReportCounts, ReportWords } from '@logic'
import { REPORT_IMAGE_FONT, REPORT_IMAGE_TONES, REPORT_IMAGE_WEIGHTS } from '../../theme/reportImage'

// The day report as a PNG (D-196): drawn on a canvas from the report itself, in the light tokens, one tall image for a
// span. The lines follow the text copy's order (D-195), so the two never say different things.

type Style = 'title' | 'heading' | 'body' | 'strong' | 'muted'

interface ImageLine {
  readonly text: string
  readonly style: Style
  /** Room above the line, a rule across the image for a new day. */
  readonly gap: 'none' | 'section' | 'day'
}

const { image } = DAY_REPORT
const EXTENSION = image.mimeType.split('/').at(-1) ?? ''

const SIZE: Record<Style, number> = {
  title: image.titlePx,
  heading: image.headingPx,
  body: image.bodyPx,
  strong: image.bodyPx,
  muted: image.bodyPx,
}
const { regular, bold } = REPORT_IMAGE_WEIGHTS
const WEIGHT: Record<Style, number> = { title: bold, heading: bold, body: regular, strong: bold, muted: regular }
const TONE: Record<Style, string> = {
  title: REPORT_IMAGE_TONES.text,
  heading: REPORT_IMAGE_TONES.text,
  body: REPORT_IMAGE_TONES.text,
  strong: REPORT_IMAGE_TONES.text,
  muted: REPORT_IMAGE_TONES.muted,
}

const fontOf = (style: Style) => `${String(WEIGHT[style])} ${String(SIZE[style])}px ${REPORT_IMAGE_FONT}`

function countsText(counts: ReportCounts, words: ReportWords): string {
  return [words.count('total', counts.total), ...DAY_REPORT_CATEGORIES.map((category) => words.count(category, counts[category]))].join(
    words.separator,
  )
}

/** The lines of the image, in the text copy's order. */
export function imageLines(report: DayReport, words: ReportWords, withReasons: boolean): ImageLine[] {
  const shows = withReasons && report.hasReasons
  return report.days.flatMap((day, index) =>
    DAY_REPORT.text.sections.flatMap((section): ImageLine[] => {
      switch (section) {
        case 'header': {
          const rotations = words.rotations(day.rotations)
          return [
            { text: words.heading(day.date), style: 'title', gap: index === 0 ? 'none' : 'day' },
            ...(rotations === null ? [] : [{ text: rotations, style: 'muted' as const, gap: 'none' as const }]),
          ]
        }
        case 'counts':
          return [{ text: countsText(day.counts, words), style: 'strong', gap: 'none' }]
        case 'units':
          return day.units.flatMap((unit): ImageLine[] => [
            { text: words.unit(unit.label), style: 'heading', gap: 'section' },
            { text: countsText(unit.counts, words), style: 'muted', gap: 'none' },
            ...DAY_REPORT.text.listed.flatMap((category): ImageLine[] => {
              const entries = unit[category]
              if (entries.length === 0) return []
              return [
                { text: words.list(category, entries.length), style: 'strong', gap: 'none' },
                ...entries.map((entry): ImageLine => ({ text: words.entry(entry, shows), style: 'body', gap: 'none' })),
              ]
            }),
          ])
      }
    }),
  )
}

/** Breaks a line into the rows that fit the width, at spaces. */
function wrap(context: CanvasRenderingContext2D, text: string, width: number): string[] {
  const rows: string[] = []
  let row = ''
  for (const word of text.split(' ')) {
    const next = row === '' ? word : `${row} ${word}`
    if (row !== '' && context.measureText(next).width > width) {
      rows.push(row)
      row = word
    } else {
      row = next
    }
  }
  return [...rows, row]
}

interface Placed {
  readonly rows: readonly string[]
  readonly style: Style
  readonly top: number
  readonly rule: number | null
}

function layout(context: CanvasRenderingContext2D, lines: readonly ImageLine[]): { placed: Placed[]; height: number } {
  const width = image.widthPx - 2 * image.paddingPx
  let top = image.paddingPx
  const placed = lines.map((line): Placed => {
    let rule: number | null = null
    if (line.gap === 'section') top += image.sectionGapPx
    if (line.gap === 'day') {
      top += image.sectionGapPx
      rule = top
      top += image.sectionGapPx
    }
    context.font = fontOf(line.style)
    const rows = wrap(context, line.text, width)
    const at = top
    top += rows.length * (SIZE[line.style] + image.lineGapPx)
    return { rows, style: line.style, top: at, rule }
  })
  return { placed, height: top + image.paddingPx - image.lineGapPx }
}

/** Draws the lines and resolves to the PNG. */
export async function reportImage(lines: readonly ImageLine[]): Promise<Blob> {
  // The web font may not be in use yet; the image is drawn in it, not in the fallback.
  await Promise.all([fontOf('body'), fontOf('title')].map((font) => document.fonts.load(font))).catch(() => undefined)
  const canvas = document.createElement('canvas')
  const measure = canvas.getContext('2d')
  if (measure === null) throw new Error('canvas unavailable')
  const { placed, height } = layout(measure, lines)
  // A canvas taller than browsers allow is drawn at a lower ratio, never cut.
  const ratio = Math.min(image.pixelRatio, (image.maxHeightPx * image.pixelRatio) / Math.max(height * image.pixelRatio, 1))
  canvas.width = Math.round(image.widthPx * ratio)
  canvas.height = Math.round(height * ratio)
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('canvas unavailable')
  context.scale(ratio, ratio)
  context.fillStyle = REPORT_IMAGE_TONES.background
  context.fillRect(0, 0, image.widthPx, height)
  context.direction = 'rtl'
  context.textAlign = 'right'
  context.textBaseline = 'top'
  const right = image.widthPx - image.paddingPx
  for (const line of placed) {
    if (line.rule !== null) {
      context.fillStyle = REPORT_IMAGE_TONES.line
      context.fillRect(image.paddingPx, line.rule, image.widthPx - 2 * image.paddingPx, image.ruleWidthPx)
    }
    context.font = fontOf(line.style)
    context.fillStyle = TONE[line.style]
    line.rows.forEach((row, index) => {
      context.fillText(row, right, line.top + index * (SIZE[line.style] + image.lineGapPx))
    })
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) reject(new Error('image not drawn'))
      else resolve(blob)
    }, image.mimeType)
  })
}

/** The file of the image, named by its first day. */
export function reportFile(blob: Blob, firstDay: string): File {
  return new File([blob], `${image.fileStem}-${firstDay}.${EXTENSION}`, { type: image.mimeType })
}

/** Whether the browser can hand a file to the share sheet (D-196). */
export function canShareFiles(): boolean {
  if (typeof navigator.canShare !== 'function') return false
  return navigator.canShare({ files: [new File([], `${image.fileStem}.${EXTENSION}`, { type: image.mimeType })] })
}

/** Saves the file through a link, where the browser cannot share it. */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  // Some browsers follow only a link in the document.
  document.body.append(link)
  link.click()
  link.remove()
  // The download starts from the address; it is freed once the browser has surely read it.
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, image.revokeAfterMs)
}
