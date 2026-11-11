import type { AccountLinkRequest, AppError } from '@contracts'
import { t } from '@i18n'
import { NEW_LINK_REQUEST_VALUES, linkRequestIssues, useCancelLinkRequest, useRequestLink } from '@logic'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { errorKey } from '../errors/messages'
import { CLEAN_FORM, fieldError, formStateOf, validatorResult } from '../patterns/forms'
import { FailureNotice } from '../patterns/Notices'
import { Button } from '../primitives/Button'
import { TextField } from '../primitives/fields'

// What an identity with no account does next (D-151): it asks to link, or it waits for the answer. Neither says
// whether anything matched (D-005).

const FIELDS: readonly string[] = ['first_name', 'last_name', 'claimed_personal_id']

export function LinkRequestForm() {
  const request = useRequestLink()
  const [state, setState] = useState(CLEAN_FORM)
  const form = useForm({
    defaultValues: NEW_LINK_REQUEST_VALUES,
    validators: { onSubmit: ({ value }) => validatorResult(linkRequestIssues(value)) },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      const result = await request.run(value)
      if (!result.ok) setState(formStateOf(result.error, FIELDS))
    },
  })

  return (
    <form
      noValidate
      className="flex flex-col gap-md"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.Field name="first_name">
        {(field) => (
          <TextField
            labelKey="linkRequest.firstName"
            name={field.name}
            autoComplete="given-name"
            isRequired
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Field name="last_name">
        {(field) => (
          <TextField
            labelKey="linkRequest.lastName"
            name={field.name}
            autoComplete="family-name"
            isRequired
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Field name="claimed_personal_id">
        {(field) => (
          <TextField
            labelKey="linkRequest.personalId"
            name={field.name}
            inputMode="numeric"
            dir="ltr"
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      {state.failure === null ? null : (
        <p role="alert" className="text-label text-status-rejected">
          {t(errorKey(state.failure))}
        </p>
      )}
      <Button type="submit" variant="primary" isDisabled={request.isPending}>
        {t('linkRequest.submit')}
      </Button>
    </form>
  )
}

/** The pending request, and the way to withdraw it. */
export function LinkRequestWaiting({ request }: { readonly request: AccountLinkRequest }) {
  const cancel = useCancelLinkRequest()
  const [failure, setFailure] = useState<AppError | null>(null)
  return (
    <section className="flex flex-col gap-md">
      <h2 className="text-body font-bold">{t('linkRequest.waitingTitle')}</h2>
      <p className="text-name text-text-muted">{t('linkRequest.waitingBody')}</p>
      <p className="text-name">
        <span className="text-text-muted">{t('linkRequest.waitingName')} </span>
        <span className="font-semibold">
          {request.first_name} {request.last_name}
        </span>
      </p>
      {failure === null ? null : <FailureNotice error={failure} />}
      <Button
        isDisabled={cancel.isPending}
        onPress={() => {
          setFailure(null)
          void cancel.run(request).then((result) => {
            if (!result.ok) setFailure(result.error)
          })
        }}
      >
        {t('linkRequest.withdraw')}
      </Button>
    </section>
  )
}
