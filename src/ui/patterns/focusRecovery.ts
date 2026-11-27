import { useEffect, type RefObject } from 'react'

/**
 * Keeps the keyboard in a drawer. When the control that held focus is removed (a row archived, a button that answered
 * and left), focus falls to the body and the keyboard loses the drawer. The next key brings it back to the drawer,
 * and Escape still closes it. A dialog over the drawer holds focus itself, so this never reaches past it.
 */
export function useFocusRecovery(dialog: RefObject<HTMLElement | null>, onClose: () => void): void {
  useEffect(() => {
    const recover = (event: KeyboardEvent) => {
      if (document.activeElement !== document.body) return
      dialog.current?.focus()
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', recover, true)
    return () => {
      document.removeEventListener('keydown', recover, true)
    }
  }, [dialog, onClose])
}
