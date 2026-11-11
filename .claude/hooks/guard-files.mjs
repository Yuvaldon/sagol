// PreToolUse guard for Edit, Write and NotebookEdit. Blocks (exit 2): any edit while on main, .env files,
// the lockfile (npm owns it) and the archive (retired files stay as they were). Silent when allowed.
import { block, currentBranch, PROTECTED_BRANCHES, readInput, toPosix } from './lib.mjs'

const input = await readInput()
const file = toPosix(input.tool_input?.file_path ?? input.tool_input?.notebook_path)
const cwd = input.cwd ?? process.cwd()
const name = file.split('/').pop() ?? ''
const project = toPosix(process.env.CLAUDE_PROJECT_DIR ?? cwd).toLowerCase()
const insideProject = file.toLowerCase().startsWith(project)

if (/^\.env(?!\.example$)/.test(name)) block('Blocked: .env files are off limits.')
if (insideProject && name === 'package-lock.json') block('Blocked: package-lock.json changes only through npm install.')
if (insideProject && file.toLowerCase().includes('/.claude/archive/')) block('Blocked: archived files are kept as they were.')
if (insideProject && PROTECTED_BRANCHES.includes(currentBranch(cwd))) {
  block('Blocked: you are on main. Create a branch first (git switch -c <name>), then edit.')
}
