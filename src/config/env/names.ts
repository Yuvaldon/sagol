// Names of the client environment variables. No imports, so `vite.config.ts` can read them
// for the production-build guard (OI-002) without resolving layer aliases.

/** Name of every client variable, by the key the rest of the code uses. */
export const ENV_VARIABLES = {
  authMode: 'VITE_AUTH_MODE',
  dataAdapter: 'VITE_DATA_ADAPTER',
  remoteUrl: 'VITE_REMOTE_URL',
  remoteAnonKey: 'VITE_REMOTE_ANON_KEY',
  appStage: 'VITE_APP_ENV',
  pushPublicKey: 'VITE_PUSH_PUBLIC_KEY',
} as const

export type EnvVariable = (typeof ENV_VARIABLES)[keyof typeof ENV_VARIABLES]

/**
 * The deploys that mark themselves (D-300). Unset means production, which looks as built; `staging` shows a band on
 * every screen and installs as a black icon with a suffixed name. The build reads this too, for the icon and manifest.
 */
export const APP_STAGES = { staging: 'staging' } as const
export type AppStageName = (typeof APP_STAGES)[keyof typeof APP_STAGES]
