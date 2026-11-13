// How the remote data adapter reaches the command gateway (D-201, D-204), and hears other devices' writes (D-347).

export const REMOTE = {
  /** Path of the `commands` server function under the backend URL (Supabase Edge Functions). */
  commandsPath: '/functions/v1/commands',
  /** Path of Supabase Auth under the backend URL (D-207). */
  authPath: '/auth/v1',
  /** A call that has not answered by then fails as `unavailable`. */
  requestTimeoutMs: 20_000,
  /** Path of Supabase Realtime under the backend URL: the socket that carries live changes (D-347). */
  realtimePath: '/realtime/v1',
  /** The broadcast event a committed write is announced under, on its organization's private topic. */
  liveEvent: 'changes',
  /** Request header carrying the calling adapter's origin id, so it ignores the announcement of its own write. */
  originHeader: 'x-sagol-origin',
} as const
