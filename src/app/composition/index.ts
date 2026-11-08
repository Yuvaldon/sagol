import type { Env } from '@config'
import { browserIdentityStore, createLocalAuthProvider, createLocalDataAdapter } from '@data'
import type { LogicPorts } from '@logic'
import { systemTime } from '../time'

/**
 * Builds what the env names. NULL when it names a provider or adapter that does not exist yet:
 * Google arrives in row 8.4 and the remote adapter in row 8.3, and nothing is stubbed (D-076, D-086).
 */
export function composePorts(env: Env): LogicPorts | null {
  if (env.authMode !== 'local' || env.dataAdapter !== 'local') return null
  const auth = createLocalAuthProvider(browserIdentityStore())
  const data = createLocalDataAdapter({ identity: auth, time: systemTime })
  return { auth, data }
}
