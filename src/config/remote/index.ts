// How the remote data adapter reaches the command gateway (D-201, D-204).

export const REMOTE = {
  /** Path of the `commands` server function under the backend URL (Supabase Edge Functions). */
  commandsPath: '/functions/v1/commands',
  /** Path of Supabase Auth under the backend URL (D-207). */
  authPath: '/auth/v1',
  /** A call that has not answered by then fails as `unavailable`. */
  requestTimeoutMs: 20_000,
} as const
