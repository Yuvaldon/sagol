import { useOverlayLayer } from '@logic'
import { useContext } from 'react'
import {
  ModalOverlay as AriaModalOverlay,
  Popover as AriaPopover,
  OverlayTriggerStateContext,
  type ModalOverlayProps,
  type PopoverProps,
} from 'react-aria-components'

// The overlays of the app hold a history entry while they are open, so the back button closes the top one and
// nothing else (D-335). They are the react-aria overlays, unchanged on screen.

/** A menu, a picker or a list that opens from its trigger. */
export function Popover(props: PopoverProps) {
  // A popover outside its trigger's state, such as the copy a collection renders to learn its items, is never shown.
  const state = useContext(OverlayTriggerStateContext)
  useOverlayLayer(props.isOpen ?? state?.isOpen ?? false, () => {
    if (props.onOpenChange === undefined) state?.close()
    else props.onOpenChange(false)
  })
  return <AriaPopover {...props} />
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
