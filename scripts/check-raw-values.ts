// Raw-value scan (ARCHITECTURE iron rule 3, ROADMAP session 0.2).
// Fails on: raw colors outside theme files, arbitrary Tailwind values, physical-direction
// classes/properties (RTL), Tailwind default palette or numeric spacing classes (reset in
// the theme, D-025), the JavaScript `Date` outside the date adapter, and web storage
// outside allowed modules.
import ts from 'typescript'
import {
  RAW_COLOR_ALLOWED_IN,
  RAW_DATE_ALLOWED_IN,
  SOURCE_ROOT,
  WEB_STORAGE_ALLOWED_IN,
} from './guardrails.config.ts'
import {
  type Finding,
  findingAt,
  findingAtOffset,
  isUnder,
  listFiles,
  parseTs,
  readSource,
  report,
  walk,
} from './lib/source.ts'

const HEX_COLOR = /(^|[^\w&])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/
const FUNCTION_COLOR = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/

const ARBITRARY_VALUE = /(?:^|[:-])\[[^\]]*\]|-\(--[^)]*\)/
const PHYSICAL_CLASS =
  /^(?:(?:ml|mr|pl|pr|left|right|scroll-ml|scroll-mr|scroll-pl|scroll-pr)-|(?:border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br)(?:-|$)|(?:text|float|clear)-(?:left|right)$|origin-(?:top-|bottom-)?(?:left|right)$)/
const PALETTE_NAMES =
  'slate|gray|zinc|neutral|stone|mauve|olive|mist|taupe|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const COLOR_UTILITIES =
  'bg|text|border|border-[xytbse]|outline|ring|ring-offset|divide|fill|stroke|from|via|to|accent|caret|decoration|placeholder|shadow|inset-shadow|drop-shadow|text-shadow'
const DEFAULT_PALETTE_CLASS = new RegExp(
  `^(?:${COLOR_UTILITIES})-(?:(?:${PALETTE_NAMES})-\\d{2,3}|black|white)(?:/\\d+)?$`,
)
const SPACING_UTILITIES =
  'p|px|py|ps|pe|pt|pb|m|mx|my|ms|me|mt|mb|gap|gap-x|gap-y|space-x|space-y|w|h|size|min-w|min-h|max-w|max-h|inset|inset-x|inset-y|top|bottom|start|end|translate-x|translate-y|scroll-m|scroll-p|scroll-mx|scroll-my|scroll-ms|scroll-me|basis|indent'
const NUMERIC_SPACING_CLASS = new RegExp(`^(?:${SPACING_UTILITIES})-(?:\\d+(?:\\.\\d+)?|px)$`)

const PHYSICAL_CSS = [
  /\b(?:margin|padding|border|scroll-margin|scroll-padding|inset)-(?:left|right)\b/,
  /\bborder-(?:top|bottom)-(?:left|right)-radius\b/,
  /(?:^|[;{\s])(?:left|right)\s*:/,
  /\b(?:text-align|float|clear)\s*:\s*(?:left|right)\b/,
]

const WEB_STORAGE = new Set(['localStorage', 'sessionStorage'])

/** Utility part of a class token: variants (`md:`, `hover:`), `!` and `-` removed. */
function utilityOf(token: string): string {
  const base = token.slice(token.lastIndexOf(':') + 1)
  return base.replace(/^!/, '').replace(/!$/, '').replace(/^-/, '')
}

function classProblems(text: string): string[] {
  const problems: string[] = []
  for (const token of text.split(/\s+/).filter(Boolean)) {
    if (ARBITRARY_VALUE.test(token)) {
      problems.push(`arbitrary Tailwind value "${token}": use a theme token`)
      continue
    }
    const utility = utilityOf(token)
    if (PHYSICAL_CLASS.test(utility)) {
      problems.push(`physical direction class "${token}": use start/end (ms-, pe-, text-start, ...)`)
    } else if (DEFAULT_PALETTE_CLASS.test(utility)) {
      problems.push(`default palette class "${token}": the palette is reset, use a semantic color token`)
    } else if (NUMERIC_SPACING_CLASS.test(utility)) {
      problems.push(`numeric spacing class "${token}": the spacing scale is reset, use a spacing token`)
    }
  }
  return problems
}

function colorProblems(text: string): string[] {
  const problems: string[] = []
  if (HEX_COLOR.test(text)) problems.push('raw hex color: use a theme token')
  if (FUNCTION_COLOR.test(text)) problems.push('raw color function: use a theme token')
  return problems
}

function isStringLike(node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | ts.TemplateLiteralLikeNode {
  return (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node)
  )
}

/** True when `node` is the name in `x.Date`, `{ Date: ... }` or a declaration name. */
function isPropertyName(node: ts.Identifier): boolean {
  const parent = node.parent
  return (
    (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    (ts.isPropertyAssignment(parent) && parent.name === node) ||
    (ts.isPropertySignature(parent) && parent.name === node) ||
    (ts.isPropertyDeclaration(parent) && parent.name === node) ||
    (ts.isMethodDeclaration(parent) && parent.name === node)
  )
}

function scanTs(file: string): Finding[] {
  const source = parseTs(file, readSource(file))
  const findings: Finding[] = []
  const colorsAllowed = isUnder(file, RAW_COLOR_ALLOWED_IN)
  const dateAllowed = isUnder(file, RAW_DATE_ALLOWED_IN)
  const storageAllowed = isUnder(file, WEB_STORAGE_ALLOWED_IN)

  walk(source, (node) => {
    if (isStringLike(node)) {
      const problems = [...classProblems(node.text), ...(colorsAllowed ? [] : colorProblems(node.text))]
      for (const message of problems) findings.push(findingAt(source, node, 'raw-value', message))
      return
    }
    if (ts.isJsxText(node)) {
      for (const message of colorsAllowed ? [] : colorProblems(node.text)) {
        findings.push(findingAt(source, node, 'raw-value', message))
      }
      return
    }
    if (!ts.isIdentifier(node) || isPropertyName(node)) return
    if (node.text === 'Date' && !dateAllowed) {
      findings.push(
        findingAt(source, node, 'raw-date', 'JavaScript Date outside the date adapter: use @internationalized/date'),
      )
    }
    if (WEB_STORAGE.has(node.text) && !storageAllowed) {
      findings.push(
        findingAt(source, node, 'web-storage', `${node.text} outside allowed modules: data lives in IndexedDB (D-021)`),
      )
    }
  })
  return findings
}

function scanCss(file: string): Finding[] {
  const text = readSource(file)
  // Blank out comments, keeping offsets so line numbers stay right.
  const code = text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
  const findings: Finding[] = []
  const colorsAllowed = isUnder(file, RAW_COLOR_ALLOWED_IN)
  let offset = 0
  for (const line of code.split('\n')) {
    const problems: string[] = []
    if (!colorsAllowed) problems.push(...colorProblems(line))
    if (PHYSICAL_CSS.some((pattern) => pattern.test(line))) {
      problems.push('physical direction property: use logical properties (margin-inline-start, inset-inline-end, ...)')
    }
    const apply = /@apply\s+([^;]+)/.exec(line)
    if (apply?.[1] !== undefined) problems.push(...classProblems(apply[1]))
    for (const message of problems) findings.push(findingAtOffset(file, text, offset, 'raw-value', message))
    offset += line.length + 1
  }
  return findings
}

const tsFiles = listFiles(SOURCE_ROOT, ['.ts', '.tsx'])
const cssFiles = listFiles(SOURCE_ROOT, ['.css'])
const findings = [...tsFiles.flatMap(scanTs), ...cssFiles.flatMap(scanCss)]
report('check-raw-values', findings, tsFiles.length + cssFiles.length)
