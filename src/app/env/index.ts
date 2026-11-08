import { parseEnv, type EnvResult } from '@config'

/** The environment of this build. Every problem is returned, nothing throws (D-074). */
export function readEnv(): EnvResult {
  return parseEnv(import.meta.env, { production: import.meta.env.PROD })
}
