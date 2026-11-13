import { SHEET_DISMISS } from '@config'
import { t, type I18nKey } from '@i18n'
import { X } from 'lucide-react'
import { motion, useDragControls } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Dialog, Heading, Modal } from 'react-aria-components'
import { ModalOverlay } from '../primitives/overlays'
import { IconButton } from '../primitives/Button'
import { DrawerScrollContext } from './drawerScroll'
import { DrawerWidthContext } from './drawerWidth'

// The floating surface every management module opens in (D-023, D-092): a modal drawer on the inline
// end from `md`, and below it a bottom sheet that also closes by dragging its grip down. Escape, the
// scrim and the close button close both. What is open lives in the URL, so the caller decides.

const MotionModal = motion.create(Modal)

export interface DrawerProps {
  readonly titleKey: I18nKey
  readonly onClose: () => void
  /** Under the title, outside the scrolling body. */
  readonly header?: ReactNode
  readonly children: ReactNode
  /** What is open lives in the URL, as a module panel's does, so the panel's entry is the drawer's (D-332, D-335). */
  readonly inUrl?: boolean
}

export function Drawer({ titleKey, onClose, header, children, inUrl = false }: DrawerProps) {
  const dragControls = useDragControls()
  const dialog = useRef<HTMLElement>(null)
  const [body, setBody] = useState<HTMLElement | null>(null)
  const [wide, setWide] = useState(false)

  // When the row that held focus is removed (archived), focus falls to the body and the keyboard loses
  // the drawer. The next key brings it back, and Escape still closes. A dialog over the drawer holds
  // focus itself, so this never reaches past it.
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
  }, [onClose])

  return (
    <ModalOverlay
      inUrl={inUrl}
      isOpen
      isDismissable
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      className="enter-scrim fixed inset-screen flex items-end justify-center bg-scrim px-safe md:items-start md:justify-end md:p-sm"
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
        className={`enter-surface glass-drawer flex max-h-sheet-height w-full flex-col overflow-hidden rounded-t-sheet md:max-h-full md:rounded-panel ${wide ? 'max-w-full' : 'max-w-drawer'}`}
      >
        <Dialog ref={dialog} className="flex min-h-none flex-col outline-none">
          <div
            aria-hidden
            onPointerDown={(event) => {
              dragControls.start(event)
            }}
            className="flex h-xl shrink-0 cursor-grab touch-none items-center justify-center md:hidden"
          >
            <span className="h-xs w-grip rounded-pill bg-line" />
          </div>
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
              <DrawerWidthContext.Provider value={setWide}>{children}</DrawerWidthContext.Provider>
            </DrawerScrollContext.Provider>
          </div>
        </Dialog>
      </MotionModal>
    </ModalOverlay>
  )
}
