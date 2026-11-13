import { t, type I18nKey } from '@i18n'
import type { ReactNode } from 'react'
import { Dialog, Heading, Modal } from 'react-aria-components'
import { ModalOverlay } from '../primitives/overlays'
import { Button } from '../primitives/Button'

// A small dialog over a drawer, always with a way out. A destructive question says what it means in
// its body and uses a named action (D-088).

const OVERLAY = 'enter-scrim fixed inset-screen flex items-center justify-center bg-scrim p-lg'
// The surface is as tall as its content, up to the screen; past it the content scrolls, and the title and the actions
// stay in sight (D-278).
const SURFACE = 'glass-menu flex max-h-full w-full max-w-sheet flex-col overflow-hidden rounded-panel p-lg'
const BODY = 'flex min-h-none flex-col gap-md outline-none'
const CONTENT = 'flex min-h-none flex-col gap-md overflow-y-auto'

export interface SmallDialogProps {
  readonly titleKey: I18nKey
  readonly hintKey?: I18nKey
  readonly confirmKey: I18nKey
  readonly isPending: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
  readonly children?: ReactNode
  readonly role?: 'dialog' | 'alertdialog'
}

export function SmallDialog({
  titleKey,
  hintKey,
  confirmKey,
  isPending,
  onConfirm,
  onCancel,
  children,
  role = 'dialog',
}: SmallDialogProps) {
  return (
    <ModalOverlay
      isOpen
      isDismissable={role === 'dialog'}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
      className={OVERLAY}
    >
      <Modal className={SURFACE}>
        <Dialog role={role} className={BODY}>
          <Heading slot="title" className="text-body font-bold">
            {t(titleKey)}
          </Heading>
          <div className={CONTENT}>
            {hintKey === undefined ? null : <p className="text-name text-text-muted">{t(hintKey)}</p>}
            {children}
          </div>
          <div className="flex flex-wrap justify-end gap-sm">
            <Button onPress={onCancel}>{t('common.cancel')}</Button>
            <Button variant="primary" isDisabled={isPending} onPress={onConfirm}>
              {t(confirmKey)}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}

export interface InfoDialogProps {
  readonly titleKey: I18nKey
  readonly hintKey: I18nKey
  readonly onClose: () => void
}

/** A dialog that only tells something: one way out. */
export function InfoDialog({ titleKey, hintKey, onClose }: InfoDialogProps) {
  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      className={OVERLAY}
    >
      <Modal className={SURFACE}>
        <Dialog className={BODY}>
          <Heading slot="title" className="text-body font-bold">
            {t(titleKey)}
          </Heading>
          <p className={`${CONTENT} text-name text-text-muted`}>{t(hintKey)}</p>
          <div className="flex justify-end">
            <Button variant="primary" onPress={onClose}>
              {t('common.close')}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
