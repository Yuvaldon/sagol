import { useOverlayLayer } from '@logic'
import { useCallback, useContext, useState } from 'react'
import {
  ModalOverlay as AriaModalOverlay,
  Popover as AriaPopover,
  OverlayTriggerStateContext,
  type ModalOverlayProps,
  type PopoverProps,
} from 'react-aria-components'

// The overlays of the app hold a history entry while they are open, so the back button closes the top one and
// nothing else (D-336). They are the react-aria overlays, unchanged on screen.

/** A menu, a picker or a list that opens from its trigger. */
export function Popover(props: PopoverProps) {
  const state = useContext(OverlayTriggerStateContext)
  // The copy a collection renders to learn its items shows no popover, and may sit under another overlay's open state:
  // only a popover that is on screen holds an entry.
  const [shown, setShown] = useState(false)
  const onScreen = useCallback((element: HTMLElement | null) => {
    setShown(element !== null)
  }, [])
  useOverlayLayer(shown && (props.isOpen ?? state?.isOpen ?? false), () => {
    if (props.onOpenChange === undefined) state?.close()
    else props.onOpenChange(false)
  })
  return <AriaPopover {...props} ref={onScreen} />
}

export interface ModalProps extends ModalOverlayProps {
  /**
   * What is open lives in the URL, whose panel entry the back button already consumes (D-332): the overlay adds none.
   */
  readonly inUrl?: boolean
}

/** A dialog, a sheet or a drawer over the screen. */
export function ModalOverlay({ inUrl = false, ...props }: ModalProps) {
  const state = useContext(OverlayTriggerStateContext)
  useOverlayLayer(!inUrl && (props.isOpen ?? state?.isOpen ?? false), () => {
    if (props.onOpenChange === undefined) state?.close()
    else props.onOpenChange(false)
  })
  return <AriaModalOverlay {...props} />
}
