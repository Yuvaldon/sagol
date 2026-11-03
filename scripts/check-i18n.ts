// i18n key scan (D-025, ROADMAP session 0.2).
//   unused-key:  a dictionary key no source file outside i18n references.
//   missing-key: a string used where an i18n key is expected that the dictionary lacks.
//   dynamic-key: a template string used where an i18n key is expected (cannot be verified).
// The dictionary is the `I18N.dictionaryExport` export of the i18n entry point; its key
// paths are read from the type checker, so the dictionary's file layout does not matter.
import { join } from 'node:path'
import ts from 'typescript'
import { I18N, SOURCE_ROOT } from './guardrails.config.ts'
import { type Finding, ROOT, findingAt, isUnder, report, toPosix, walk } from './lib/source.ts'

function loadProgram(): ts.Program {
  const parsed = ts.getParsedCommandLineOfConfigFile(join(ROOT, 'tsconfig.app.json'), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
    },
  })
  if (parsed === undefined) throw new Error('tsconfig.app.json could not be read')
  return ts.createProgram(parsed.fileNames, parsed.options)
}

function relativePath(fileName: string): string {
  const posixRoot = `${toPosix(ROOT)}/`
  const posix = toPosix(fileName)
  return posix.startsWith(posixRoot) ? posix.slice(posixRoot.length) : posix
}

/** Every leaf (string-valued) property path of `type`, joined with dots. */
function keyPaths(checker: ts.TypeChecker, type: ts.Type, prefix: string, at: ts.Node): string[] {
  if (type.flags & ts.TypeFlags.StringLike) return prefix === '' ? [] : [prefix]
  const properties = checker.getPropertiesOfType(type)
  if (properties.length === 0) return prefix === '' ? [] : [prefix]
  return properties.flatMap((property) => {
    const path = prefix === '' ? property.name : `${prefix}.${property.name}`
    return keyPaths(checker, checker.getTypeOfSymbolAtLocation(property, at), path, at)
  })
}

function isKeyType(type: ts.Type | undefined): boolean {
  if (type === undefined) return false
  const alias = type.aliasSymbol
  if (alias?.name !== I18N.keyType) return false
  return (alias.declarations ?? []).some((declaration) =>
    isUnder(relativePath(declaration.getSourceFile().fileName), [I18N.folder]),
  )
}

const program = loadProgram()
const checker = program.getTypeChecker()
const entry = program.getSourceFile(join(ROOT, I18N.entry))
if (entry === undefined) throw new Error(`${I18N.entry} is not part of tsconfig.app.json`)
const entrySymbol = checker.getSymbolAtLocation(entry)
const exported = entrySymbol === undefined ? [] : checker.getExportsOfModule(entrySymbol)
const dictionary = exported.find((symbol) => symbol.name === I18N.dictionaryExport)
const keys = new Set(
  dictionary === undefined ? [] : keyPaths(checker, checker.getTypeOfSymbolAtLocation(dictionary, entry), '', entry),
)

const findings: Finding[] = []
const used = new Set<string>()
const sources = program
  .getSourceFiles()
  .filter((source) => {
    const file = relativePath(source.fileName)
    return isUnder(file, [`${SOURCE_ROOT}/`]) && !isUnder(file, [I18N.folder])
  })

for (const source of sources) {
  walk(source, (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (keys.has(node.text)) used.add(node.text)
      else if (ts.isExpression(node) && isKeyType(checker.getContextualType(node))) {
        findings.push(findingAt(source, node, 'missing-key', `"${node.text}" is not in the i18n dictionary`))
      }
    } else if (ts.isTemplateExpression(node) && isKeyType(checker.getContextualType(node))) {
      findings.push(findingAt(source, node, 'dynamic-key', 'i18n keys must be literal so they can be verified'))
    }
  })
}

const definitionSymbol =
  dictionary !== undefined && dictionary.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(dictionary) : dictionary
const definition = definitionSymbol?.declarations?.[0]
for (const key of [...keys].filter((candidate) => !used.has(candidate)).sort()) {
  const file = definition === undefined ? I18N.entry : relativePath(definition.getSourceFile().fileName)
  findings.push({ file, line: 1, column: 1, rule: 'unused-key', message: `"${key}" is never used` })
}

if (dictionary === undefined) {
  console.log(`check-i18n: ${I18N.entry} exports no "${I18N.dictionaryExport}" yet (0 keys).`)
}
report(
  'check-i18n',
  findings.map((finding) => ({ ...finding, file: relativePath(finding.file) })),
  sources.length,
)
