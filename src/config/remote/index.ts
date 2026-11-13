// How the remote data adapter reaches the command gateway (D-201, D-204).

export const REMOTE = {
  /** Path of the `commands` server function under the backend URL (Supabase Edge Functions). */
  commandsPath: '/functions/v1/commands',
  /**
   * Query parameter naming the call (`kind.group.method`) on each request, so the server's request logs say which
   * calls a burst made (D-331). The body stays the only input the server reads.
   */
  callParam: 'call',
  /** Path of Supabase Auth under the backend URL (D-207). */
  authPath: '/auth/v1',
  /** A call that has not answered by then fails as `unavailable`. */
  requestTimeoutMs: 20_000,
} as const
