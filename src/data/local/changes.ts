import { TABLE_SCHEMAS, type ChangeFeed, type DataChange, type TableName, type Unsubscribe } from '@contracts'
import { z } from 'zod'

// One live source of truth across views and tabs. Every committed write goes through a
// BroadcastChannel, which also reaches other listeners in the same tab, so there is one path.

const DataChangesMessage = z.array(
  z.object({
    table: z.string().refine((table) => Object.hasOwn(TABLE_SCHEMAS, table)),
    ids: z.array(z.string()),
  }),
)

export interface LocalChangeFeed extends ChangeFeed {
  publish(changes: readonly DataChange[]): void
}

export function createChangeFeed(channelName: string): LocalChangeFeed {
  const listeners = new Set<(changes: readonly DataChange[]) => void>()
  let channel: BroadcastChannel | null = null

  function deliver(message: unknown): void {
    const parsed = DataChangesMessage.safeParse(message)
    if (!parsed.success) return
    const changes = parsed.data.map((change) => ({ table: change.table as TableName, ids: change.ids }))
    for (const listener of [...listeners]) listener(changes)
  }

  return {
    publish(changes) {
      const sender = new BroadcastChannel(channelName)
      sender.postMessage(changes)
      sender.close()
    },
    subscribe(listener): Unsubscribe {
      listeners.add(listener)
      if (channel === null) {
        channel = new BroadcastChannel(channelName)
        channel.onmessage = (event: MessageEvent<unknown>) => {
          deliver(event.data)
        }
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && channel !== null) {
          channel.close()
          channel = null
        }
      }
    },
  }
}
