// PreToolUse guard for Bash and PowerShell commands. Blocks (exit 2) what must never happen in any mode:
// pushing to or committing on main, force pushes, history rewrites, skipping git hooks, and touching .env files.
// Silent when the command is allowed.
import { block, currentBranch, PROTECTED_BRANCHES, readInput } from './lib.mjs'

const input = await readInput()
const command = String(input.tool_input?.command ?? '')
const cwd = input.cwd ?? process.cwd()

// Quoted text (commit messages, PR bodies) is dropped before looking for flags, so a message that mentions
// "--amend" or ".env" is not mistaken for the flag or the file.
const unquoted = command.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '""')
const segments = unquoted.split(/&&|\|\||[;|\n]/).map((s) => s.trim()).filter(Boolean)
const protectedRef = new RegExp(`(^|[\\s:/])(${PROTECTED_BRANCHES.join('|')})(\\s|$)`)

for (const segment of segments) {
  const git = segment.match(/\bgit(?:\.exe)?\s+(?:-C\s+\S+\s+|-c\s+\S+\s+)*([a-z-]+)(.*)$/)
  if (/\b(LEFTHOOK|LEFTHOOK_EXCLUDE)=|core\.hooksPath/.test(segment)) {
    block('Blocked: git hooks may not be skipped or redirected (lefthook runs the commit checks).')
  }
  if (git) {
    const [, sub, rest] = git
    const args = ` ${rest} `
    if (sub === 'push') {
      if (/\s(--force|--force-with-lease|--force-if-includes|--mirror|--delete|-d)\b|\s-[a-zA-Z]*f[a-zA-Z]*\s|\s\+\S/.test(args)) {
        block('Blocked: no force pushes, mirror pushes or remote deletes. Push a new commit instead.')
      }
      if (protectedRef.test(args)) block('Blocked: never push to main. Push your branch and open a pull request.')
      if (PROTECTED_BRANCHES.includes(currentBranch(cwd))) {
        block('Blocked: you are on main. Create a branch (git switch -c <name>) and push that.')
      }
    }
    if (/\s--no-verify\b/.test(args) || (sub === 'commit' && /\s-[a-zA-Z]*n[a-zA-Z]*\s/.test(args))) {
      block('Blocked: --no-verify skips the commit checks. Fix what the hook reports instead.')
    }
    if (sub === 'commit' && /\s--amend\b/.test(args)) block('Blocked: no history rewrites. Make a new commit.')
    if (['rebase', 'filter-branch', 'filter-repo', 'replace', 'update-ref'].includes(sub)) {
      block(`Blocked: git ${sub} rewrites history. Merge main into your branch instead.`)
    }
    if (sub === 'reset' && /\s--hard\b/.test(args)) block('Blocked: git reset --hard discards work. Use git stash or a new commit.')
    if (sub === 'tag' && /\s(-d|--delete|-f|--force)\b/.test(args)) block('Blocked: tags are not deleted or moved.')
    if (sub === 'branch' && /\s(-D|--delete\s+--force|-f|--force)\b/.test(args) && protectedRef.test(args)) {
      block('Blocked: main is not deleted or moved.')
    }
    if (['commit', 'merge', 'cherry-pick', 'revert'].includes(sub) && PROTECTED_BRANCHES.includes(currentBranch(cwd))) {
      block('Blocked: work never lands on main directly (D-110). Create a branch first: git switch -c <name>.')
    }
  }
  if (/\bgh\s+pr\s+merge\b.*\s--admin\b/.test(segment)) block('Blocked: --admin bypasses branch protection.')
  if (/\bgh\s+api\b.*\/branches\/[^/\s]+\/protection/.test(segment)) block('Blocked: branch protection is changed by the owner only.')
}

// Any command that names a .env file other than the committed example (cat, type, Get-Content, cp, git add...).
// Other quotes are kept (cat ".env" must not slip through), but message text (-m, --body, --title), which may
// span lines and mention .env, is dropped first.
const envFile = /(^|[\s"'=/\\(])\.env(?!\.example\b)(\.[\w.-]+)?(?![\w.-])/
const withoutMessages = command.replace(/(\s(?:-[a-zA-Z]*m|--message|-b|--body|-t|--title)[\s=]*)("(?:[^"\\]|\\.)*"|'[^']*')/g, '$1""')
for (const segment of withoutMessages.split(/&&|\|\||[;\n]/)) {
  if (envFile.test(segment)) block('Blocked: .env files are off limits.')
}
