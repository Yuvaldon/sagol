import { REMOTE } from '@config'
import type { Unsubscribe } from '@contracts'

// How the remote adapter hears other devices' writes (D-348): one private Realtime channel per
// tab, on the topic of the organization the session is linked to. Realtime admits the channel
// only while the caller's token names a live account in that organization (the migration's policy).

/**
 * Listens on one topic: `onMessage` gets each announcement's payload, `onResume` runs when the
 * channel joins again after a break, when announcements may have been missed.
 */
export type LiveListener = (topic: string, onMessage: (payload: unknown) => void, onResume: () => void) => Unsubscribe

export interface RealtimeListenerDependencies {
  /** The backend URL, e.g. `https://<ref>.supabase.co`. */
  readonly url: string
  readonly apiKey: string
  readonly accessToken: () => Promise<string | null>
}

/** The Supabase Realtime listener. Its client loads on the first listen, behind a dynamic import (D-210). */
export function realtimeListener({ url, apiKey, accessToken }: RealtimeListenerDependencies): LiveListener {
  const endpoint = new URL(REMOTE.realtimePath, url)
  endpoint.protocol = endpoint.protocol === 'http:' ? 'ws:' : 'wss:'
  let client: Promise<import('@supabase/realtime-js').RealtimeClient> | null = null
  const clientOf = () =>
    (client ??= import('@supabase/realtime-js').then(
      ({ RealtimeClient }) => new RealtimeClient(endpoint.toString(), { params: { apikey: apiKey }, accessToken }),
    ))

  return (topic, onMessage, onResume) => {
    let stopped = false
    let stop: () => void = () => undefined
    void clientOf()
      .then((realtime) => {
        if (stopped) return
        const channel = realtime.channel(topic, { config: { private: true } })
        let joins = 0
        channel
          .on('broadcast', { event: REMOTE.liveEvent }, (message: { payload?: unknown }) => onMessage(message.payload))
          .subscribe((status) => {
            if (status !== 'SUBSCRIBED') return
            joins += 1
            if (joins > 1) onResume()
          })
        stop = () => void realtime.removeChannel(channel)
      })
      // Live changes are a convenience: without them the app still reads what it asks for.
      .catch(() => undefined)
    return () => {
      stopped = true
      stop()
    }
  }
}
