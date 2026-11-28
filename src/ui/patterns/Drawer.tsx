import { SHEET_DISMISS } from '@config'
import { t, type I18nKey } from '@i18n'
import { X } from 'lucide-react'
import { motion, useDragControls } from 'motion/react'
import { useRef, useState, type ReactNode } from 'react'
import { Dialog, Heading, Modal } from 'react-aria-components'
import { ModalOverlay } from '../primitives/overlays'
import { IconButton } from '../primitives/Button'
import { DrawerScrollContext } from './drawerScroll'
import { DrawerWidthContext } from './drawerWidth'
import { useFocusRecovery } from './focusRecovery'
import { useIsDesktop } from './media'
import { SidePanel } from './SidePanel'

// The floating surface every management module opens in (D-023, D-092): the side panel on a wide screen (D-460,
// D-491), and below it a bottom sheet that also closes by dragging its grip down. Escape and the close button close
// both, and the sheet's scrim too. What is open lives in the URL, so the caller decides.

const MotionModal = motion.create(Modal)

export interface DrawerProps {
  readonly titleKey: I18nKey
  readonly onClose: () => void
  /** Under the title, outside the scrolling body. */
  readonly header?: ReactNode
  readonly children: ReactNode
  /** What is open lives in the URL, as a module panel's does, so the panel's entry is the drawer's (D-332, D-337). */
  readonly inUrl?: boolean
}

export function Drawer(props: DrawerProps) {
  const desktop = useIsDesktop()
  const [wide, setWide] = useState(false)
  if (desktop) {
    return (
      <SidePanel onClose={props.onClose} inUrl={props.inUrl ?? false} wide={wide} className="glass-drawer">
        <Contents {...props} onWide={setWide} />
      </SidePanel>
    )
  }
  return <Sheet {...props} />
}

/** The title, the header and the scrolling body, the same in the sheet and in the side panel. */
function Contents({ titleKey, onClose, header, children, onWide }: DrawerProps & { readonly onWide: (wide: boolean) => void }) {
  const [body, setBody] = useState<HTMLElement | null>(null)
  return (
    <>
      <header className="flex shrink-0 flex-col gap-sm px-lg pb-md md:pt-lg">
        <div className="flex items-center justify-between gap-sm">
          <Heading slot="title" className="text-title font-bold tracking-tight">
            {t(titleKey)}
          </Heading>
          <IconButton labelKey="common.close" onPress={onClose}>
            <X aria-hidden size={18} />
          </IconButton>
        </div>
        {header}
      </header>
      <div ref={setBody} className="min-h-none overflow-y-auto px-lg pb-xl">
        <DrawerScrollContext.Provider value={body}>
          <DrawerWidthContext.Provider value={onWide}>{children}</DrawerWidthContext.Provider>
        </DrawerScrollContext.Provider>
      </div>
    </>
  )
}

/** The phone's sheet from the bottom, as wide as the screen. */
function Sheet(props: DrawerProps) {
  const { onClose, inUrl = false } = props
  const dragControls = useDragControls()
  const dialog = useRef<HTMLElement>(null)

  useFocusRecovery(dialog, onClose)

  return (
    <ModalOverlay
      inUrl={inUrl}
      isOpen
      isDismissable
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      className="enter-scrim fixed inset-screen flex items-end justify-center bg-scrim px-safe"
    >
      <MotionModal
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 1 }}
        onDragEnd={(_event, info) => {
          const far = info.offset.y > SHEET_DISMISS.offsetPx
          const fast = info.velocity.y > SHEET_DISMISS.velocityPxPerSecond
          if (far || fast) onClose()
        }}
        className="enter-surface glass-drawer flex max-h-sheet-height w-full max-w-drawer flex-col overflow-hidden rounded-t-sheet"
      >
        <Dialog ref={dialog} className="flex min-h-none flex-col outline-none">
          <div
            aria-hidden
            onPointerDown={(event) => {
              dragControls.start(event)
            }}
            className="flex h-xl shrink-0 cursor-grab touch-none items-center justify-center"
          >
            <span className="h-xs w-grip rounded-pill bg-line" />
          </div>
          <Contents {...props} onWide={NO_WIDE} />
        </Dialog>
      </MotionModal>
    </ModalOverlay>
  )
}

/** Below a wide screen the sheet is already as wide as the screen. */
const NO_WIDE = () => undefined
