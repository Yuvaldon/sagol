import type { AccountLinkRequest, AppError, AuthIdentity, Issue } from '@contracts'
import { t } from '@i18n'
import {
  claimIssues,
  fullName,
  linkRequestIssues,
  timeZoneChoices,
  useCancelLinkRequest,
  useClaimOrganization,
  useOnboarding,
  useRequestLink,
  useSignOut,
  type LinkRequestValues,
} from '@logic'
import { useForm } from '@tanstack/react-form'
import { useMemo, useState } from 'react'
import { errorKey } from '../errors/messages'
import { CenteredSheet } from '../patterns/Sheet'
import { FailureNotice } from '../patterns/Notices'
import { fieldError, formStateOf, validatorResult } from '../patterns/forms'
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

const REQUEST_FIELDS: readonly string[] = ['first_name', 'last_name', 'personal_id']

/** Asks to be linked to a soldier (D-030, D-156). The answer never says whether a soldier matched (D-066). */
function RequestForm() {
  const request = useRequestLink()
  const [answered, setAnswered] = useState<readonly Issue[]>([])
  const [failure, setFailure] = useState<AppError | null>(null)
  const initial: LinkRequestValues = { first_name: '', last_name: '', personal_id: '' }
  const form = useForm({
    defaultValues: initial,
    validators: { onSubmit: ({ value }) => validatorResult(linkRequestIssues(value)) },
    onSubmit: async ({ value }) => {
      setAnswered([])
      setFailure(null)
      const result = await request.run(value)
      if (result.ok) return
      const state = formStateOf(result.error, REQUEST_FIELDS)
      setAnswered(state.answered)
      setFailure(state.failure)
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
      <form.Field name="last_name">
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
      <form.Field name="personal_id">
        {(field) => (
          <TextField
            labelKey="linkRequest.personalId"
            name={field.name}
            inputMode="numeric"
            dir="ltr"
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, answered)}
          />
        )}
      </form.Field>
      {failure === null ? null : <FailureNotice error={failure} />}
      <Button type="submit" variant="primary" isDisabled={request.isPending}>
        {t('linkRequest.submit')}
      </Button>
    </form>
  )
}

/** The identity's request waits for a reviewer; it may withdraw it and file another. */
function PendingRequest({ request }: { readonly request: AccountLinkRequest }) {
  const cancel = useCancelLinkRequest()
  const [failure, setFailure] = useState<AppError | null>(null)
  return (
    <div className="flex flex-col gap-md">
      <dl className="flex flex-col gap-xs">
        <dt className="text-label font-semibold text-text-muted">{t('linkRequest.sentAs')}</dt>
        <dd className="text-control">{fullName(request)}</dd>
      </dl>
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
        {t('linkRequest.cancel')}
      </Button>
    </div>
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

/**
 * An `unlinked` identity: it claims an empty organization, or asks to be linked to a soldier and waits for a
 * reviewer (D-030, D-156).
 */
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
  const open = onboarding.value.open_request
  return (
    <CenteredSheet titleKey={open === null ? 'linkRequest.title' : 'linkRequest.pendingTitle'} hintKey={open === null ? 'linkRequest.hint' : 'linkRequest.pendingHint'}>
      {open === null ? <RequestForm /> : <PendingRequest request={open} />}
      <SignOutButton />
      <IdentityList exclude={identity.auth_user_id} />
    </CenteredSheet>
  )
}
