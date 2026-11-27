import { SHEET_DISMISS, STOP_DRAWER } from '@config'
import { t } from '@i18n'
import { X } from 'lucide-react'
import { motion, useDragControls } from 'motion/react'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Button as AriaButton, Dialog, Heading, Modal } from 'react-aria-components'
import { useFocusRecovery } from '../patterns/focusRecovery'
import { IconButton } from '../primitives/Button'
import { ModalOverlay } from '../primitives/overlays'
import { DrawerStopContext } from './drawerStop'

// The drawer of the new interface (D-454): glass over a dimmed screen, rising from the bottom to a stop. It opens at
// its half stop and grows to the full one; the handle is a real button, so the stop also changes by a tap or a key
// (D-458). Dragging the handle up grows it, down shrinks it and then closes it. Escape, the dim layer and ✕ close it.
// From `md` it is a panel on the inline end, as the modules' drawer is, with no stops.

const MotionModal = motion.create(Modal)
const CLOSE_ICON = 18

export type Stop = 'half' | 'full'

const STOPS: Readonly<Record<Stop, string>> = {
  half: 'max-h-stop-half',
  full: 'max-h-sheet-height',
}

export interface StopDrawerProps {
  /** The drawer's title, already in words: a day, a unit, a person. */
  readonly title: string
  /** Under the title: one quiet line. */
  readonly detail?: string | undefined
  readonly onClose: () => void
  /** The stop it opens at: half its height, or full for what is read at length. */
  readonly opensAt?: Stop
  /** What is open lives in the URL, as a module panel's does, so the panel's entry is the drawer's (D-332, D-337). */
  readonly inUrl?: boolean
  readonly children: ReactNode
}

export function StopDrawer({ title, detail, onClose, opensAt = 'half', inUrl = false, children }: StopDrawerProps) {
  const dragControls = useDragControls()
  const [stop, setStop] = useState<Stop>(opensAt)
  const dialog = useRef<HTMLElement>(null)
  // The keyboard stays in the drawer when the button that held it answered and left (approve, reopen, edit).
  useFocusRecovery(dialog, onClose)
  const grow = useCallback(() => {
    setStop('full')
  }, [])
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
        dragElastic={{ top: STOP_DRAWER.elasticUp, bottom: STOP_DRAWER.elasticDown }}
        onDragEnd={(_event, info) => {
          const far = Math.abs(info.offset.y) > SHEET_DISMISS.offsetPx
          const fast = Math.abs(info.velocity.y) > SHEET_DISMISS.velocityPxPerSecond
          if (!far && !fast) return
          if (info.offset.y < 0) setStop('full')
          else if (stop === 'full') setStop('half')
          else onClose()
        }}
        className={`enter-surface glass-drawer flex w-full max-w-drawer flex-col overflow-hidden rounded-t-sheet md:max-h-full md:rounded-panel ${STOPS[stop]}`}
      >
        <Dialog ref={dialog} className="flex min-h-none flex-col outline-none">
          <div
            onPointerDown={(event) => {
              dragControls.start(event)
            }}
            className="flex shrink-0 touch-none justify-center md:hidden"
          >
            <AriaButton
              aria-label={t(stop === 'half' ? 'kit.drawerGrow' : 'kit.drawerShrink')}
              aria-expanded={stop === 'full'}
              onPress={() => {
                setStop(stop === 'half' ? 'full' : 'half')
              }}
              className="flex h-touch w-action cursor-grab items-center justify-center rounded-full outline-focus -outline-offset-2 data-focus-visible:outline-2"
            >
              <span aria-hidden className="h-xs w-grip rounded-full bg-line" />
            </AriaButton>
          </div>
          <header className="flex shrink-0 items-center justify-between gap-sm px-lg pb-md md:pt-lg">
            <div className="flex min-w-none flex-col">
              <Heading slot="title" level={2} className="truncate text-heading font-bold">
                {title}
              </Heading>
              {detail === undefined ? null : <p className="text-small text-text-muted tabular-nums">{detail}</p>}
            </div>
            {/* ✕ on its own white circle, as the package draws it. */}
            <IconButton labelKey="common.close" variant="circle" onPress={onClose}>
              <X aria-hidden size={CLOSE_ICON} />
            </IconButton>
          </header>
          <div className="min-h-none overflow-y-auto px-lg pb-xl">
            <DrawerStopContext value={grow}>{children}</DrawerStopContext>
          </div>
        </Dialog>
      </MotionModal>
    </ModalOverlay>
  )
}
