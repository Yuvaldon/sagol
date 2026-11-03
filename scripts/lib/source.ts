// Shared helpers for the guardrail scans: file discovery, parsing, reporting.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'

export const ROOT = process.cwd()

export interface Finding {
  file: string
  line: number
  column: number
  rule: string
  message: string
}

export function toPosix(path: string): string {
  return path.split(sep).join('/')
}

export function isUnder(file: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => file.startsWith(prefix))
}

/** Every file below `root` (POSIX paths relative to the repository root) with one of `extensions`. */
export function listFiles(root: string, extensions: readonly string[]): string[] {
  const entries = readdirSync(join(ROOT, root), { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext)))
    .map((entry) => toPosix(relative(ROOT, join(entry.parentPath, entry.name))))
    .sort()
}

export function readSource(file: string): string {
  return readFileSync(join(ROOT, file), 'utf8')
}

export function parseTs(file: string, text: string): ts.SourceFile {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind)
}

export function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node)
  node.forEachChild((child) => walk(child, visit))
}

export function findingAt(
  source: ts.SourceFile,
  node: ts.Node,
  rule: string,
  message: string,
): Finding {
  const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source))
  return { file: source.fileName, line: line + 1, column: character + 1, rule, message }
}

export function findingAtOffset(
  file: string,
  text: string,
  offset: number,
  rule: string,
  message: string,
): Finding {
  const before = text.slice(0, offset).split('\n')
  const lastLine = before[before.length - 1] ?? ''
  return { file, line: before.length, column: lastLine.length + 1, rule, message }
}

/** Prints findings and sets the exit code. Returns true when the scan is clean. */
export function report(scan: string, findings: readonly Finding[], scanned: number): boolean {
  for (const f of findings) {
    console.error(`${f.file}:${f.line}:${f.column}  ${f.rule}  ${f.message}`)
  }
  if (findings.length > 0) {
    console.error(`\n✖ ${scan}: ${findings.length} problem(s) in ${scanned} file(s)`)
    process.exitCode = 1
    return false
  }
  console.log(`✔ ${scan}: no problems (${scanned} file(s) scanned)`)
  return true
}
