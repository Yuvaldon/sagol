import { createContext, useCallback, useContext } from 'react'

// A drawer with stops opens small where a glance is enough (D-454). What needs the room, a form or the field of a
// comment, asks for the full stop when it shows, as a wide chart asks the modules' drawer for its width (D-092).

export const DrawerStopContext = createContext<(() => void) | null>(null)

/** Asks the drawer around the caller for its full stop; outside such a drawer it does nothing. */
export function useFullStop(): () => void {
  const grow = useContext(DrawerStopContext)
  return useCallback(() => {
    grow?.()
  }, [grow])
}
