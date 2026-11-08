import { LocalIdentityRequest, type AppError, type Issue } from '@contracts'
import { t } from '@i18n'
import { formIssues, useSignIn } from '@logic'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { errorKey } from '../errors/messages'
import { CenteredSheet } from '../patterns/Sheet'
import { fieldError, validatorResult } from '../patterns/forms'
import { Button } from '../primitives/Button'
import { TextField } from '../primitives/fields'
import { IdentityList } from './IdentityList'

function toRequest(value: { email: string; display_name: string }) {
  const name = value.display_name.trim()
  return { email: value.email.trim(), display_name: name === '' ? null : name }
}

/** Local sign-in (D-006). The router leaves this screen when the session changes. */
export function SignInScreen() {
  const { signIn, isPending } = useSignIn()
  const [answered, setAnswered] = useState<readonly Issue[]>([])
  const [failure, setFailure] = useState<AppError | null>(null)
  const form = useForm({
    defaultValues: { email: '', display_name: '' },
    validators: {
      onSubmit: ({ value }) => validatorResult(formIssues(LocalIdentityRequest, toRequest(value))),
    },
    onSubmit: async ({ value }) => {
      setAnswered([])
      setFailure(null)
      const result = await signIn(toRequest(value))
      if (result.ok) return
      if (result.error.code === 'validation_failed') setAnswered(result.error.issues)
      else setFailure(result.error)
    },
  })

  return (
    <CenteredSheet titleKey="signIn.title" hintKey="signIn.hint">
      <form
        noValidate
        className="flex flex-col gap-md"
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <form.Field name="email">
          {(field) => (
            <TextField
              labelKey="signIn.email"
              name={field.name}
              type="email"
              autoComplete="email"
              isRequired
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              error={fieldError(field.state.meta.errors, field.name, answered)}
            />
          )}
        </form.Field>
        <form.Field name="display_name">
          {(field) => (
            <TextField
              labelKey="signIn.displayName"
              name={field.name}
              autoComplete="name"
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              error={fieldError(field.state.meta.errors, field.name, answered)}
            />
          )}
        </form.Field>
        {failure === null ? null : (
          <p role="alert" className="text-label text-status-rejected">
            {t(errorKey(failure))}
          </p>
        )}
        <Button type="submit" variant="primary" isDisabled={isPending}>
          {t('signIn.submit')}
        </Button>
      </form>
      <IdentityList />
    </CenteredSheet>
  )
}
