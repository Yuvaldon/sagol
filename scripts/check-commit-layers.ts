// One commit = one layer (D-075). Rejects a commit whose staged `src/` files cross layers.
// `i18n` with `ui` is the one allowed pair (D-025). Files outside `src/` are not a layer, and
// `src/main.tsx` counts as `app`. A merge commit is skipped: each merged commit passed on its own. Runs from the pre-commit hook (lefthook.yml).
import { execFileSync } from 'node:child_process'
import { ALLOWED_LAYER_PAIRS, ENTRY_POINT_LAYER, SOURCE_ROOT } from './guardrails.config.ts'

function layerOf(file: string): string | null {
  const [root, second, third] = file.split('/')
  if (root !== SOURCE_ROOT || second === undefined) return null
  return third === undefined ? ENTRY_POINT_LAYER : second
}

/** A merge brings in commits that each passed this check already; its own diff spans their layers. */
function mergeInProgress(): boolean {
  try {
    execFileSync('git', ['rev-parse', '-q', '--verify', 'MERGE_HEAD'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

if (mergeInProgress()) {
  console.log('✔ check-commit-layers: a merge commit, its commits were checked one by one')
  process.exit(0)
}

const staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=d'], { encoding: 'utf8' })
  .split('\n')
  .filter((line) => line !== '')

const filesByLayer = new Map<string, string[]>()
for (const file of staged) {
  const layer = layerOf(file)
  if (layer === null) continue
  filesByLayer.set(layer, [...(filesByLayer.get(layer) ?? []), file])
}

const layers = [...filesByLayer.keys()].sort()
const allowed =
  layers.length <= 1 ||
  ALLOWED_LAYER_PAIRS.some((pair) => pair.length === layers.length && pair.every((layer) => layers.includes(layer)))

if (allowed) {
  console.log(`✔ check-commit-layers: ${layers.length === 0 ? 'no src layer' : layers.join(' + ')}`)
} else {
  console.error(`✖ check-commit-layers: this commit crosses layers (D-075): ${layers.join(', ')}`)
  for (const layer of layers) console.error(`  ${layer}: ${filesByLayer.get(layer)?.join(', ')}`)
  process.exitCode = 1
}
