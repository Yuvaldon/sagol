// The local pair as the browser composes it (D-006, D-021), behind one dynamic import (D-210): a
// build that runs Google with the remote adapter never downloads Dexie.
export { createLocalDataAdapter } from './adapter'
export { browserIdentityStore, createLocalAuthProvider } from './identity'
