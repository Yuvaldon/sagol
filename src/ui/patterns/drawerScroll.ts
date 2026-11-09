import { createContext, useContext } from 'react'

// The element a drawer's body scrolls in, for what needs to follow that scroll (a virtualized list).

export const DrawerScrollContext = createContext<HTMLElement | null>(null)

export function useDrawerScroll(): HTMLElement | null {
  return useContext(DrawerScrollContext)
}
