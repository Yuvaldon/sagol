import { LocalIdentityRequest, type AppError, type Issue } from '@contracts'
import { t } from '@i18n'
import { formIssues, useAuthMode, useGoogleSignIn, useSignIn } from '@logic'
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

/** Sign-in by the build's provider (D-207). The router leaves this screen when the session changes. */
export function SignInScreen() {
  return useAuthMode() === 'local' ? <LocalSignIn /> : <GoogleSignIn />
}

/** Google through Supabase Auth: the browser leaves for Google and returns signed in (D-207). */
function GoogleSignIn() {
  const { signIn, isPending } = useGoogleSignIn()
  const [failure, setFailure] = useState<AppError | null>(null)
  return (
    <CenteredSheet titleKey="signIn.title" hintKey="signIn.googleHint">
      <div className="flex flex-col gap-md">
        {failure === null ? null : (
          <p role="alert" className="text-label text-status-rejected">
            {t(errorKey(failure))}
          </p>
        )}
        <Button
          variant="primary"
          isDisabled={isPending}
          onPress={() => {
            setFailure(null)
            void signIn().then((result) => {
              if (!result.ok) setFailure(result.error)
            })
          }}
        >
          {t('signIn.google')}
        </Button>
      </div>
    </CenteredSheet>
  )
}

/** Local sign-in as a development identity (D-006). */
function LocalSignIn() {
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
