// Public entry point of the DATA layer.
// Server-authoritative adapters (D-008) implementing the repository and command
// interfaces from @contracts: IndexedDB through Dexie (D-021), or the command gateway over HTTP (D-204),
// with Google sign-in through Supabase Auth (D-207).
export {
  createLocalDataAdapter,
  type LocalAdapterDependencies,
  type LocalDataAdapter,
} from './local/adapter'
export { browserIdentityStore, createLocalAuthProvider, type IdentityStore } from './local/identity'
export { createRemoteDataAdapter, type RemoteAdapterDependencies, type RemoteDataAdapter } from './remote/adapter'
export { loadGoogleAuth, type GoogleAuth, type GoogleAuthOptions, type SupabaseAuthServerAddress } from './remote/googleAuth'
