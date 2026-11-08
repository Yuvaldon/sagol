// Names of the client environment variables. No imports, so `vite.config.ts` can read them
// for the production-build guard (OI-002) without resolving layer aliases.

/** Name of every client variable, by the key the rest of the code uses. */
export const ENV_VARIABLES = {
  authMode: 'VITE_AUTH_MODE',
  dataAdapter: 'VITE_DATA_ADAPTER',
  remoteUrl: 'VITE_REMOTE_URL',
  remoteAnonKey: 'VITE_REMOTE_ANON_KEY',
} as const

export type EnvVariable = (typeof ENV_VARIABLES)[keyof typeof ENV_VARIABLES]
