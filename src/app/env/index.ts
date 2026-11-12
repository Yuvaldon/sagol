import { isStaging, parseEnv, type EnvResult } from '@config'

/** The environment of this build. Every problem is returned, nothing throws (D-074). */
export function readEnv(): EnvResult {
  return parseEnv(import.meta.env, { production: import.meta.env.PROD })
}

/** This build is the staging deploy, read apart from the env check so even its failure screen is marked (D-300). */
export function readStaging(): boolean {
  return isStaging(import.meta.env)
}
