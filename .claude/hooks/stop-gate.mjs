// Stop hook: Claude may not end a turn with uncommitted code that fails `npm run check`.
// - Runs only when code paths have uncommitted changes, and only once per distinct change set (a passing
//   fingerprint is remembered in the git dir), so a turn that touched no code costs nothing.
// - Silent on success. On failure it exits 2 with the tail of the output, and Claude keeps working.
// - No loops: when Claude is already continuing because of this hook and the check is still red, the turn
//   ends and the user gets a one-line notice instead of another block.
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { git, readInput } from './lib.mjs'

const CODE_PATHS = [
  'src', 'e2e', 'scripts', 'package.json', 'tsconfig*.json', '*.config.ts', 'vitest.setup.ts',
  '.dependency-cruiser.cjs', '.oxlintrc.json', 'docs/schema.sql',
]

const input = await readInput()
const cwd = input.cwd ?? process.cwd()
const root = git(['rev-parse', '--show-toplevel'], cwd)
if (!root || !existsSync(join(root, 'node_modules'))) process.exit(0)

const diff = git(['diff', 'HEAD', '--', ...CODE_PATHS], root)
const untracked = git(['ls-files', '--others', '--exclude-standard', '--', ...CODE_PATHS], root)
if (!diff && !untracked) process.exit(0)

const untrackedContent = untracked.split('\n').filter(Boolean).map((f) => f + readFileSync(join(root, f), 'utf8')).join('')
const fingerprint = createHash('sha256').update(diff + untrackedContent).digest('hex')
const passFile = resolve(root, git(['rev-parse', '--git-dir'], root), 'claude-check-pass')
if (existsSync(passFile) && readFileSync(passFile, 'utf8') === fingerprint) process.exit(0)

try {
  execSync('npm run check', { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 280_000 })
  writeFileSync(passFile, fingerprint)
} catch (error) {
  const output = `${error.stdout ?? ''}\n${error.stderr ?? ''}`
  const lines = output.split('\n').filter((line) => /error|fail|✖|×|warn/i.test(line)).slice(-15)
  const summary = lines.length > 0 ? lines.join('\n') : output.trim().split('\n').slice(-15).join('\n')
  if (input.stop_hook_active) {
    process.stdout.write(JSON.stringify({ systemMessage: 'npm run check is still red on uncommitted changes.' }))
    process.exit(0)
  }
  process.stderr.write(`npm run check failed on your uncommitted changes. Fix it before you stop:\n${summary}\n`)
  process.exit(2)
}
