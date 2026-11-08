// Public entry point of the DATA layer.
// Server-authoritative adapters (D-008) implementing the repository and command
// interfaces from @contracts: IndexedDB through Dexie now (D-021), remote later.
export {
  createLocalDataAdapter,
  type LocalAdapterDependencies,
  type LocalDataAdapter,
} from './local/adapter'
export { browserIdentityStore, createLocalAuthProvider, type IdentityStore } from './local/identity'
