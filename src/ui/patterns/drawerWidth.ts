import { createContext, useContext, useLayoutEffect } from 'react'

// A drawer is as wide as a form (D-092). What needs the room, like the units chart (D-318), widens it to the whole
// screen from `md` while it is shown; below `md` the sheet is already as wide as the screen.

export const DrawerWidthContext = createContext<((wide: boolean) => void) | null>(null)

/** Widens the drawer around the caller while `wide` holds. */
export function useWideDrawer(wide: boolean): void {
  const setWide = useContext(DrawerWidthContext)
  useLayoutEffect(() => {
    if (setWide === null || !wide) return undefined
    setWide(true)
    return () => {
      setWide(false)
    }
  }, [setWide, wide])
}
