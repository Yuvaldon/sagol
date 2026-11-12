import type { Env } from '@config'
import { loadLocalData, loadRemoteData } from '@data'
import type { LogicPorts, ShellPort } from '@logic'
import { systemTime } from '../time'

/**
 * Builds the pair the env names (D-207), loading only that pair's chunk (D-210). Google's client
 * finishes a returning redirect before this answers, so the router never sees the OAuth code. It
 * rejects only when a chunk cannot load. The shell (D-183) is built before the env is read, so it is passed in.
 */
export async function composePorts(env: Env, origin: string, shell: ShellPort): Promise<LogicPorts> {
  if (env.authMode === 'local') {
    const { browserIdentityStore, createLocalAuthProvider, createLocalDataAdapter } = await loadLocalData()
    const auth = createLocalAuthProvider(browserIdentityStore())
    const data = createLocalDataAdapter({ identity: auth, time: systemTime })
    return { auth, data, time: systemTime, shell }
  }
  const { url, anonKey } = env.remote
  const { createRemoteDataAdapter, loadGoogleAuth } = await loadRemoteData()
  const google = await loadGoogleAuth({ url, apiKey: anonKey }, { redirectTo: origin })
  const data = createRemoteDataAdapter({
    url,
    apiKey: anonKey,
    identity: google.provider,
    accessToken: google.accessToken,
    fetch: (input, init) => fetch(input, init),
  })
  return { auth: google.provider, data, time: systemTime, shell }
}
