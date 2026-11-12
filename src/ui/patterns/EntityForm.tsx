import type { AppError } from '@contracts'
import { t, type I18nKey } from '@i18n'
import type { ReactNode } from 'react'
import { Heading } from 'react-aria-components'
import { Button } from '../primitives/Button'
import { FailureNotice } from './Notices'

// The frame of every form in a drawer (D-024): a title, the fields, the refusal if there is one, and
// the actions. Each form brings its fields, and `forms.ts` connects them to the field codes (D-068).

export interface EntityFormProps {
  readonly titleKey: I18nKey
  readonly submitKey: I18nKey
  readonly isPending: boolean
  readonly failure: AppError | null
  /** Someone else changed the row: offers to continue from their version (D-012). */
  readonly onReload?: (() => void) | undefined
  readonly onSubmit: () => void
  readonly onCancel: () => void
  readonly children: ReactNode
}

export function EntityForm({
  titleKey,
  submitKey,
  isPending,
  failure,
  onReload,
  onSubmit,
  onCancel,
  children,
}: EntityFormProps) {
  return (
    <form
      noValidate
      className="flex flex-col gap-lg"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <Heading level={3} className="text-body font-bold">
        {t(titleKey)}
      </Heading>
      <div className="flex flex-col gap-md">{children}</div>
      {failure === null ? null : (
        <FailureNotice error={failure}>
          {failure.code === 'stale_version' && onReload !== undefined ? (
            <Button onPress={onReload}>{t('common.reloadItem')}</Button>
          ) : null}
        </FailureNotice>
      )}
      <div className="flex flex-wrap justify-end gap-sm">
        <Button onPress={onCancel}>{t('common.cancel')}</Button>
        <Button type="submit" variant="primary" isDisabled={isPending}>
          {t(submitKey)}
        </Button>
      </div>
    </form>
  )
}
