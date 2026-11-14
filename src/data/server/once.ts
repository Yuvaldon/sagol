/**
 * A value loaded on first use and shared by the calls after it (the catalog, the push sender). A failed
 * load is not kept: the next call loads again, so one lost connection does not refuse every later
 * request until the server instance is replaced (OI-352).
 */
export function onceRetrying<T>(load: () => Promise<T>): () => Promise<T> {
  let value: Promise<T> | undefined
  return () =>
    (value ??= load().catch((error: unknown) => {
      value = undefined
      throw error
    }))
}
