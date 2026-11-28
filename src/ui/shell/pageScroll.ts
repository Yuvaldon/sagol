import { createContext, useContext } from 'react'

// What a page of the shell scrolls (D-455): a long list in it shows only the rows in sight (OI-403). NULL outside a page.

export const PageScrollContext = createContext<HTMLElement | null>(null)

export function usePageScroll(): HTMLElement | null {
  return useContext(PageScrollContext)
}
