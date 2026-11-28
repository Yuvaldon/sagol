import { useOverlayLayer } from '@logic'
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Dialog } from 'react-aria-components'

// A drawer on a wide screen (D-460, D-491): a side panel on the inline end, the screen's full height, beside what is
// open under it rather than over it. Nothing is dimmed and a press outside does not close it: the board, the list or
// the page stays in reach, and pressing another row puts its own card in the panel. The screen's content gives the
// panel its room while one is open. The panel takes the keyboard when it opens and hands it back when it closes;
// Escape, ✕ and the back button close it.

/** The attribute on the root that tells the layout a panel stands on the inline end (`panel-open:` in the theme). */
const OPEN_ATTRIBUTE = 'data-side-panel'
let openPanels = 0
/** The panels open now, the newest last: Escape belongs to the newest. */
const panels: object[] = []

/** Escape on the document while the panel is the newest open, unless something else took the key first. */
function useEscape(onClose: { readonly current: () => void }): void {
  useEffect(() => {
    const self = {}
    panels.push(self)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || panels.at(-1) !== self) return
      event.preventDefault()
      onClose.current()
    }
    // Bubbling, on the document: whatever handles the key on its way down (a menu, a dialog, a drag) stops it first.
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      panels.splice(panels.indexOf(self), 1)
    }
  }, [onClose])
}

/** Marks the root while at least one panel is open, so the content beside it narrows. */
function usePanelRoom(): void {
  useLayoutEffect(() => {
    openPanels += 1
    document.documentElement.setAttribute(OPEN_ATTRIBUTE, '')
    return () => {
      openPanels -= 1
      if (openPanels === 0) document.documentElement.removeAttribute(OPEN_ATTRIBUTE)
    }
  }, [])
}

/** Gives the keyboard back to what held it before the panel opened, when the panel took it and it is still there. */
function useFocusReturn(panel: { readonly current: HTMLElement | null }): void {
  useLayoutEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const element = panel.current
    return () => {
      const active = document.activeElement
      const inPanel = active === null || active === document.body || (element !== null && element.contains(active))
      if (inPanel && opener !== null && opener.isConnected) opener.focus()
    }
  }, [panel])
}

export interface SidePanelProps {
  readonly onClose: () => void
  /** What is open lives in the URL, whose panel entry the back button already consumes (D-332): the panel adds none. */
  readonly inUrl: boolean
  /** The panel's own width: as wide as a form, or the whole content for what needs the room (D-092). */
  readonly wide?: boolean
  /** The dialog's surface classes beyond its place. */
  readonly className: string
  readonly children: ReactNode
}

export function SidePanel({ onClose, inUrl, wide = false, className, children }: SidePanelProps) {
  const dialog = useRef<HTMLElement>(null)
  const latest = useRef(onClose)
  useEffect(() => {
    latest.current = onClose
  }, [onClose])
  useOverlayLayer(!inUrl, onClose)
  usePanelRoom()
  useFocusReturn(dialog)
  useEscape(latest)
  return createPortal(
    <div
      className={`enter-surface side-panel fixed flex py-sm ${wide ? 'start-sm' : 'w-panel'}`}
    >
      <Dialog ref={dialog} className={`flex min-h-none w-full flex-col overflow-hidden rounded-panel outline-none ${className}`}>
        {children}
      </Dialog>
    </div>,
    document.body,
  )
}
