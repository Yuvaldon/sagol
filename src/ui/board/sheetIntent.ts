import { createContext, useContext, useMemo, useRef } from 'react'

// What the board opens to when another screen sends the actor there (the handoff's board spec, §1.13): a day column of
// the commander's block opens the board on its day with the day's drawer at its middle stop. Held for the next board
// that mounts, which takes it once.

export type SheetStop = 'middle'

export interface SheetIntent {
  readonly ask: (stop: SheetStop) => void
  /** The stop asked for, once; NULL when none was. */
  readonly take: () => SheetStop | null
}

const NONE: SheetIntent = { ask: () => undefined, take: () => null }

export const SheetIntentContext = createContext<SheetIntent>(NONE)

export function useSheetIntent(): SheetIntent {
  return useContext(SheetIntentContext)
}

/** The workspace's intent, kept across the destinations. */
export function useSheetIntentScope(): SheetIntent {
  const asked = useRef<SheetStop | null>(null)
  return useMemo(
    () => ({
      ask: (stop) => {
        asked.current = stop
      },
      take: () => {
        const stop = asked.current
        asked.current = null
        return stop
      },
    }),
    [],
  )
}
