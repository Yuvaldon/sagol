// Shared helpers for the Claude Code hooks in this folder. Node only, no dependencies, so the hooks run
// the same on Windows (Git Bash or PowerShell) and in cloud sessions.
import { execFileSync } from 'node:child_process'

export async function readInput() {
  let raw = ''
  for await (const chunk of process.stdin) raw += chunk
  return raw ? JSON.parse(raw) : {}
}

// Exit 2 blocks the action; stderr is the reason Claude sees. Keep it to one or two lines.
export function block(reason) {
  process.stderr.write(`${reason}\n`)
  process.exit(2)
}

export function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

export const PROTECTED_BRANCHES = ['main', 'master']

export function currentBranch(cwd) {
  return git(['branch', '--show-current'], cwd)
}

export function toPosix(path) {
  return String(path ?? '').replaceAll('\\', '/')
}
