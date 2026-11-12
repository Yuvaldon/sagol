import { z } from 'zod'
import { AuthMode, DataAdapterMode, DEVELOPMENT_ONLY_AUTH_MODES } from '@contracts'
import { ENV_VARIABLES, type EnvVariable } from './names'

// Environment contract (D-006, D-048). `app` parses `import.meta.env` through `parseEnv`
// at startup and fails fast on any issue. Only `VITE_` variables reach the client bundle;
// server-only secrets (`BOOTSTRAP_OWNER_EMAIL`, D-005) are never listed here.

export { ENV_VARIABLES, type EnvVariable } from './names'

const EnvVariableName = z.enum([
  ENV_VARIABLES.authMode,
  ENV_VARIABLES.dataAdapter,
  ENV_VARIABLES.remoteUrl,
  ENV_VARIABLES.remoteAnonKey,
])

/** A blank value (`VAR=`) counts as not set. */
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    schema.optional(),
  )
}

export const EnvSchema = z.object({
  [ENV_VARIABLES.authMode]: AuthMode,
  [ENV_VARIABLES.dataAdapter]: DataAdapterMode,
  [ENV_VARIABLES.remoteUrl]: optional(z.url()),
  [ENV_VARIABLES.remoteAnonKey]: optional(z.string().trim().min(1)),
})

/** The parsed environment, in the shape the app uses. */
export interface Env {
  readonly authMode: AuthMode
  readonly dataAdapter: DataAdapterMode
  /** Present exactly when the data adapter is `remote`. */
  readonly remote: { readonly url: string; readonly anonKey: string } | null
}

export type EnvIssueCode =
  /** The variable is not set. */
  | 'missing'
  /** The value is not allowed (wrong enum member, malformed URL). */
  | 'invalid'
  /** A production build refuses this auth mode (D-006). */
  | 'development_only'
  /** The remote adapter needs this variable. */
  | 'required_for_remote'
  /** The data adapter does not pair with the auth mode (D-207). */
  | 'unpaired'

export interface EnvIssue {
  readonly variable: EnvVariable
  readonly code: EnvIssueCode
}

export type EnvResult =
  | { readonly ok: true; readonly value: Env }
  | { readonly ok: false; readonly issues: readonly EnvIssue[] }

export interface EnvOptions {
  /** True in a production build. */
  readonly production: boolean
}

export type RawEnv = Readonly<Record<string, unknown>>

/**
 * The one data adapter each auth mode runs with (D-207): local identities write the local
 * database (D-006), and a Google session is what the command gateway verifies (D-204).
 */
export const ADAPTER_OF_AUTH_MODE: Readonly<Record<AuthMode, DataAdapterMode>> = {
  local: 'local',
  google: 'remote',
}

function isDevelopmentOnly(mode: AuthMode): boolean {
  return DEVELOPMENT_ONLY_AUTH_MODES.some((candidate) => candidate === mode)
}

/** Validates a raw environment. Never throws; every problem is returned. */
export function parseEnv(raw: RawEnv, options: EnvOptions): EnvResult {
  const parsed = EnvSchema.safeParse(raw)
  if (!parsed.success) {
    const issues: EnvIssue[] = []
    for (const issue of parsed.error.issues) {
      const variable = EnvVariableName.safeParse(issue.path[0])
      if (!variable.success) continue
      const blank = raw[variable.data] === undefined || raw[variable.data] === ''
      issues.push({ variable: variable.data, code: blank ? 'missing' : 'invalid' })
    }
    return { ok: false, issues }
  }
  const data = parsed.data
  const authMode = data[ENV_VARIABLES.authMode]
  const dataAdapter = data[ENV_VARIABLES.dataAdapter]
  const url = data[ENV_VARIABLES.remoteUrl]
  const anonKey = data[ENV_VARIABLES.remoteAnonKey]
  const issues: EnvIssue[] = []
  if (options.production && isDevelopmentOnly(authMode)) {
    issues.push({ variable: ENV_VARIABLES.authMode, code: 'development_only' })
  }
  if (ADAPTER_OF_AUTH_MODE[authMode] !== dataAdapter) {
    issues.push({ variable: ENV_VARIABLES.dataAdapter, code: 'unpaired' })
  }
  if (dataAdapter === 'remote') {
    if (url === undefined) issues.push({ variable: ENV_VARIABLES.remoteUrl, code: 'required_for_remote' })
    if (anonKey === undefined) {
      issues.push({ variable: ENV_VARIABLES.remoteAnonKey, code: 'required_for_remote' })
    }
  }
  if (issues.length > 0) return { ok: false, issues }
  const remote =
    dataAdapter === 'remote' && url !== undefined && anonKey !== undefined ? { url, anonKey } : null
  return { ok: true, value: { authMode, dataAdapter, remote } }
}
