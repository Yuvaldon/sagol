import { t, type I18nKey } from '@i18n'
import { Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Dialog, Modal, ModalOverlay } from 'react-aria-components'
import { Button } from '../primitives/Button'

// No dead ends (D-285): a field whose definition is missing offers it in place. Who may create it gets the module's own
// form over the drawer, the same component and command, and the field takes what was saved. Who may not reads that it
// is missing and who sets it up, so there is never a "create it first" with nothing to press.

const OVERLAY = 'enter-scrim fixed inset-none flex items-center justify-center bg-scrim p-lg'
const SURFACE = 'glass-menu flex max-h-full w-full max-w-sheet flex-col overflow-y-auto rounded-panel p-lg'

export interface CreateInPlaceProps {
  /** The module's own "new" label: the button's text and the dialog's name. */
  readonly labelKey: I18nKey
  readonly canCreate: boolean
  /** Nothing to choose yet: who may not create it reads why. */
  readonly isMissing: boolean
  /** The form, given the way out: it calls it with nothing after saving or leaving. */
  readonly children: (close: () => void) => ReactNode
}

export function CreateInPlace({ labelKey, canCreate, isMissing, children }: CreateInPlaceProps) {
  const [open, setOpen] = useState(false)
  const close = () => {
    setOpen(false)
  }

  if (!canCreate) return isMissing ? <p className="text-name text-text-muted">{t('common.notDefinedYet')}</p> : null
  return (
    <>
      <Button
        onPress={() => {
          setOpen(true)
        }}
      >
        <Plus aria-hidden size={14} />
        {t(labelKey)}
      </Button>
      {open ? (
        <ModalOverlay
          isOpen
          isDismissable
          onOpenChange={(next) => {
            if (!next) close()
          }}
          className={OVERLAY}
        >
          <Modal className={SURFACE}>
            <Dialog aria-label={t(labelKey)} className="outline-none">
              {children(close)}
            </Dialog>
          </Modal>
        </ModalOverlay>
      ) : null}
    </>
  )
}
