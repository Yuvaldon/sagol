// Public entry point of the DATA layer.
// Server-authoritative adapters (D-008) implementing the repository and command
// interfaces from @contracts: IndexedDB through Dexie (D-021), or the command gateway over HTTP (D-204),
// with Google sign-in through Supabase Auth (D-207).
// The adapters are reached only through the loaders below (D-210); a static export would put both
// pairs, Dexie included, in the entry chunk of every build.
export type { LocalAdapterDependencies, LocalDataAdapter } from './local/adapter'
export type { RotationLeaveNames } from './local/database'
export type { IdentityStore } from './local/identity'
// The device store is a few lines with no dependency, so it is static (D-197).
export { browserDeviceStores, deviceStoreOver, type DeviceStore } from './device'
export type { RemoteAdapterDependencies, RemoteDataAdapter } from './remote/adapter'
export type { GoogleAuth, GoogleAuthOptions, SupabaseAuthServerAddress } from './remote/googleAuth'

/** Each pair in its own chunk, so a build downloads only the pair its env names (D-210). */
export const loadLocalData = () => import('./local/browser')
export const loadRemoteData = () => import('./remote/browser')
