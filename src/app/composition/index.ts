import type { Env } from '@config'
import { browserIdentityStore, createLocalAuthProvider, createLocalDataAdapter, createRemoteDataAdapter, loadGoogleAuth } from '@data'
import type { LogicPorts } from '@logic'
import { systemTime } from '../time'

/**
 * Builds the pair the env names (D-207). Google's client loads in its own chunk and finishes a
 * returning redirect before this answers, so the router never sees the OAuth code. It rejects only
 * when that chunk cannot load.
 */
export async function composePorts(env: Env, origin: string): Promise<LogicPorts> {
  if (env.authMode === 'local') {
    const auth = createLocalAuthProvider(browserIdentityStore())
    const data = createLocalDataAdapter({ identity: auth, time: systemTime })
    return { auth, data, time: systemTime }
  }
  const { url, anonKey } = env.remote
  const google = await loadGoogleAuth({ url, apiKey: anonKey }, { redirectTo: origin })
  const data = createRemoteDataAdapter({
    url,
    apiKey: anonKey,
    identity: google.provider,
    accessToken: google.accessToken,
    fetch: (input, init) => fetch(input, init),
  })
  return { auth: google.provider, data, time: systemTime }
}
