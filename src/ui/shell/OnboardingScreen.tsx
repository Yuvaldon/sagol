import type { AppError, AuthIdentity, Issue } from '@contracts'
import { t } from '@i18n'
import { claimIssues, timeZoneChoices, useClaimOrganization, useOnboarding, useSignOut } from '@logic'
import { useForm } from '@tanstack/react-form'
import { useMemo, useState } from 'react'
import { errorKey } from '../errors/messages'
import { CenteredSheet } from '../patterns/Sheet'
import { fieldError, validatorResult } from '../patterns/forms'
import { Button } from '../primitives/Button'
import { SearchSelectField, TextField } from '../primitives/fields'
import { IdentityList } from './IdentityList'
import { FailureScreen, LoadingScreen } from './states'

function ClaimForm() {
  const { claim, isPending } = useClaimOrganization()
  const choices = useMemo(() => timeZoneChoices(), [])
  const [answered, setAnswered] = useState<readonly Issue[]>([])
  const [failure, setFailure] = useState<AppError | null>(null)
  const form = useForm({
    defaultValues: {
      organization: { name: '', timezone: choices.device },
      soldier: { first_name: '', last_name: '' },
    },
    validators: {
      onSubmit: ({ value }) => validatorResult(claimIssues({ ...value, owner_role_name: t('onboarding.ownerRoleName') })),
    },
    onSubmit: async ({ value }) => {
      setAnswered([])
      setFailure(null)
      const result = await claim({ ...value, owner_role_name: t('onboarding.ownerRoleName') })
      if (result.ok) return
      if (result.error.code === 'validation_failed') setAnswered(result.error.issues)
      else setFailure(result.error)
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
      <form.Field name="organization.name">
        {(field) => (
          <TextField
            labelKey="onboarding.organizationName"
            name={field.name}
            isRequired
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, answered)}
          />
        )}
      </form.Field>
      <form.Field name="organization.timezone">
        {(field) => (
          <SearchSelectField
            labelKey="onboarding.timezone"
            toggleLabelKey="onboarding.timezoneToggle"
            name={field.name}
            value={field.state.value}
            options={choices.zones}
            onChange={field.handleChange}
            error={fieldError(field.state.meta.errors, field.name, answered)}
          />
        )}
      </form.Field>
      <form.Field name="soldier.first_name">
        {(field) => (
          <TextField
            labelKey="onboarding.firstName"
            name={field.name}
            autoComplete="given-name"
            isRequired
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, answered)}
          />
        )}
      </form.Field>
      <form.Field name="soldier.last_name">
        {(field) => (
          <TextField
            labelKey="onboarding.lastName"
            name={field.name}
            autoComplete="family-name"
            isRequired
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
        {t('onboarding.submit')}
      </Button>
    </form>
  )
}

function SignOutButton() {
  const { signOut, isPending } = useSignOut()
  return (
    <Button
      isDisabled={isPending}
      onPress={() => {
        void signOut()
      }}
    >
      {t('account.signOut')}
    </Button>
  )
}

/** An `unlinked` identity: it claims an empty organization, or it sees that it has no access. */
export function OnboardingScreen({ identity }: { readonly identity: AuthIdentity }) {
  const onboarding = useOnboarding()
  if (onboarding.status === 'loading') return <LoadingScreen />
  if (onboarding.status === 'failed') return <FailureScreen error={onboarding.error} />
  if (onboarding.value.bootstrap_available) {
    return (
      <CenteredSheet titleKey="onboarding.title" hintKey="onboarding.hint">
        <ClaimForm />
      </CenteredSheet>
    )
  }
  return (
    <CenteredSheet titleKey="noAccess.title" hintKey="noAccess.body">
      <SignOutButton />
      <IdentityList exclude={identity.auth_user_id} />
    </CenteredSheet>
  )
}
