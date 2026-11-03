// Lint rules oxlint does not provide (ROADMAP session 0.2).
//   jsx-attribute-literal: user-facing JSX attributes (aria-label, title, ...) never hold a
//     string literal; the text comes from i18n. oxlint's react/jsx-no-literals covers
//     children and `{'...'}` expressions.
//   core-no-jsx: engine `core` folders are pure logic, so they contain no `.tsx` file.
import ts from 'typescript'
import { PURE_CORE_FOLDER, SOURCE_ROOT, USER_FACING_ATTRIBUTES } from './guardrails.config.ts'
import { type Finding, findingAt, listFiles, parseTs, readSource, report, walk } from './lib/source.ts'

const userFacing = new Set(USER_FACING_ATTRIBUTES)

function holdsLiteral(initializer: ts.JsxAttributeValue | undefined): boolean {
  if (initializer === undefined) return false
  if (ts.isStringLiteral(initializer)) return true
  if (!ts.isJsxExpression(initializer) || initializer.expression === undefined) return false
  const expression = initializer.expression
  return ts.isStringLiteral(expression) || ts.isTemplateLiteral(expression)
}

function scan(file: string): Finding[] {
  const findings: Finding[] = []
  if (file.endsWith('.tsx') && PURE_CORE_FOLDER.test(file)) {
    findings.push({ file, line: 1, column: 1, rule: 'core-no-jsx', message: 'engine core folders hold pure logic: no .tsx files' })
  }
  if (!file.endsWith('.tsx')) return findings
  const source = parseTs(file, readSource(file))
  walk(source, (node) => {
    if (!ts.isJsxAttribute(node) || !ts.isIdentifier(node.name)) return
    const name = node.name.text
    if (userFacing.has(name) && holdsLiteral(node.initializer)) {
      findings.push(findingAt(source, node, 'jsx-attribute-literal', `"${name}" holds a literal: use an i18n key`))
    }
  })
  return findings
}

const files = listFiles(SOURCE_ROOT, ['.ts', '.tsx'])
report('lint-custom', files.flatMap(scan), files.length)
