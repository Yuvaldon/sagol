// PostToolUse after Edit/Write: lints the one file that changed with the project's oxlint config (about 0.3 s).
// Silent when clean. On findings it exits 2, so Claude sees the first lines and fixes them in its next edit.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { readInput, toPosix } from './lib.mjs'

const input = await readInput()
const file = toPosix(input.tool_input?.file_path)
const project = toPosix(process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd())
const oxlint = join(project, 'node_modules', 'oxlint', 'bin', 'oxlint')

const lintable = /\.(ts|tsx|js|mjs|cjs)$/.test(file) && file.toLowerCase().startsWith(project.toLowerCase())
if (!lintable || file.includes('/.claude/') || !existsSync(oxlint) || !existsSync(file)) process.exit(0)

try {
  execFileSync(process.execPath, [oxlint, '--deny-warnings', '--format', 'unix', file], {
    cwd: project,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
} catch (error) {
  const lines = String(error.stdout ?? '').split('\n').filter((line) => line.includes(':')).slice(0, 10)
  if (lines.length === 0) process.exit(0) // oxlint itself failed to run; the commit hook and CI still lint
  process.stderr.write(`oxlint: ${lines.map((line) => line.replace(`${project}/`, '')).join('\n')}\n`)
  process.exit(2)
}
