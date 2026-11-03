// Conventional Commits check for the commit-msg hook: `type(scope)!: subject`.
import { readFileSync } from 'node:fs'

const TYPES = ['build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'style', 'test']
const HEADER = new RegExp(String.raw`^(?:${TYPES.join('|')})(?:\([a-z0-9-]+\))?!?: \S.*$`)
const MERGE_OR_REVERT = /^(?:Merge |Revert ")/

const file = process.argv[2]
if (file === undefined) throw new Error('usage: check-commit-msg.ts <commit message file>')
const header = readFileSync(file, 'utf8').split('\n')[0] ?? ''

if (!HEADER.test(header) && !MERGE_OR_REVERT.test(header)) {
  console.error(`✖ commit message is not a Conventional Commit: "${header}"`)
  console.error(`  expected "<type>(<scope>)?: <subject>" with type one of: ${TYPES.join(', ')}`)
  process.exitCode = 1
}
