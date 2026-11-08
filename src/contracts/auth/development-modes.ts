// No imports, so `vite.config.ts` can read it for the production-build guard (OI-002).

/** Auth modes a production build refuses (D-006). Checked against `AuthMode` in `./index`. */
export const DEVELOPMENT_ONLY_AUTH_MODES = ['local'] as const
