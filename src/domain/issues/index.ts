import { IssueCode, type Issue } from '@contracts'

// Maps schema issues (Zod) to the stable field codes of D-046, so the data adapter and the
// forms (through logic) report the same codes (OI-016, D-068). Domain does not import zod:
// the issue is typed structurally, and Zod 4 issues fit.

/** The parts of a schema issue the mapping reads. */
export interface SchemaIssueLike {
  readonly code: string
  readonly path: readonly PropertyKey[]
  readonly message: string
  readonly expected?: unknown
  readonly origin?: unknown
  readonly minimum?: unknown
  readonly keys?: readonly string[]
}

type IssuePath = Issue['path']

/** Origins whose bounds are lengths (characters or items), not magnitudes. */
const LENGTH_ORIGINS: readonly unknown[] = ['string', 'array', 'set', 'file']

const ISSUE_CODES: readonly string[] = IssueCode.options

function isIssueCode(value: string): value is IssueCode {
  return ISSUE_CODES.includes(value)
}

/** The input value an issue points at; `undefined` when the path does not exist. */
function valueAt(input: unknown, path: readonly PropertyKey[]): unknown {
  let current = input
  for (const key of path) {
    if (typeof current !== 'object' || current === null || !Object.hasOwn(current, key)) {
      return undefined
    }
    current = Reflect.get(current, key)
  }
  return current
}

function isMissing(value: unknown): boolean {
  return value === undefined || value === null
}

function toPath(path: readonly PropertyKey[]): IssuePath {
  return path.map((key) => (typeof key === 'symbol' ? String(key) : key))
}

function codeOf(issue: SchemaIssueLike, value: unknown): IssueCode {
  switch (issue.code) {
    case 'invalid_type':
      if (isMissing(value)) return IssueCode.enum.required
      if (issue.expected === 'int' && typeof value === 'number') return IssueCode.enum.not_integer
      return IssueCode.enum.invalid_type
    case 'invalid_value':
    case 'invalid_union':
      return isMissing(value) ? IssueCode.enum.required : IssueCode.enum.invalid_value
    case 'too_small':
      // A trimmed text that must not be empty: an empty value is a missing value.
      if (issue.origin === 'string' && issue.minimum === 1) return IssueCode.enum.required
      return LENGTH_ORIGINS.includes(issue.origin) ? IssueCode.enum.too_short : IssueCode.enum.too_small
    case 'too_big':
      return LENGTH_ORIGINS.includes(issue.origin) ? IssueCode.enum.too_long : IssueCode.enum.too_big
    case 'invalid_format':
      return IssueCode.enum.invalid_format
    case 'custom':
      // Contract refinements carry an `IssueCode` as their message (SchemaIssue, D-046).
      return isIssueCode(issue.message) ? issue.message : IssueCode.enum.invalid_value
    default:
      return IssueCode.enum.invalid_value
  }
}

/**
 * Field issues of a failed schema parse. `input` is the value that was parsed: a missing
 * or NULL value answers `required`. An unknown key answers `unknown_field` at its own
 * path. Each `(path, code)` appears once.
 */
export function issuesFromSchema(issues: readonly SchemaIssueLike[], input: unknown): Issue[] {
  const mapped: Issue[] = []
  const seen = new Set<string>()
  const add = (issue: Issue) => {
    const key = JSON.stringify([issue.path, issue.code])
    if (seen.has(key)) return
    seen.add(key)
    mapped.push(issue)
  }
  for (const issue of issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys ?? []) {
        add({ path: [...toPath(issue.path), key], code: IssueCode.enum.unknown_field })
      }
      continue
    }
    add({ path: toPath(issue.path), code: codeOf(issue, valueAt(input, issue.path)) })
  }
  return mapped
}

/**
 * Issues of a nested value, addressed from the enclosing input: domain checks report paths
 * relative to the row (`['properties', id]`); an update input nests them under `changes`.
 */
export function withPathPrefix(prefix: IssuePath, issues: readonly Issue[]): Issue[] {
  return issues.map((issue) => ({ path: [...prefix, ...issue.path], code: issue.code }))
}
