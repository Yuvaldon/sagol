import { NEW_ENTITY, PANEL_IDS } from '@config'
import { Permission, type AppError, type Issue, type Organization, type Role, type RoleId } from '@contracts'
import { t } from '@i18n'
import {
  NEW_ROLE_VALUES,
  PERMISSION_GRID,
  formFieldIssues,
  liveRoles,
  permissionsOfRole,
  roleFormIssues,
  roleFormValues,
  useCurrentOrganization,
  usePanel,
  useRoleCommands,
  useRolePermissionHints,
  useRolePermissions,
  useRoles,
  useSetBaselineRole,
  type RoleFormValues,
} from '@logic'
import { Archive, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { ActionMenu, type RowAction } from '../../patterns/ActionMenu'
import { SmallDialog } from '../../patterns/Dialogs'
import { EntityForm } from '../../patterns/EntityForm'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { CLEAN_FORM, formStateOf, issueError } from '../../patterns/forms'
import { Button } from '../../primitives/Button'
import { CheckList } from '../../primitives/ChoiceList'
import { ColorField } from '../../primitives/ColorField'
import { SelectField, type SelectOption } from '../../primitives/SelectField'
import { TextAreaField } from '../../primitives/TextAreaField'
import { TextField } from '../../primitives/fields'
import { toneOf } from '../../theme/palette'

// The roles section (D-165): the baseline role, the list of roles, and a role's form with the grid of D-040's valid
// pairs. Roles are the `roles` resource at organization scope; the baseline is the organization's (D-003).

const ROLE_FIELDS: readonly string[] = ['name', 'description', 'color_key', 'permissions']
const NO_BASELINE = 'none'

function PermissionGrid({
  permissions,
  onChange,
}: {
  readonly permissions: readonly Permission[]
  readonly onChange: (permissions: Permission[]) => void
}) {
  return (
    <fieldset className="flex flex-col gap-sm">
      <legend className="text-label font-semibold text-text-muted">{t('roles.permissions')}</legend>
      <p className="text-micro text-text-muted">{t('roles.permissionsHint')}</p>
      {PERMISSION_GRID.map((row) => {
        const held = permissions.filter((permission) => permission.resource === row.resource)
        return (
          <CheckList
            key={row.resource}
            inline
            label={{ key: `permissionLabels.resources.${row.resource}` }}
            choices={row.actions.map((action) => ({ key: action, label: { key: `permissionLabels.actions.${action}` } }))}
            selected={held.map((permission) => permission.action)}
            onChange={(keys) => {
              const others = permissions.filter((permission) => permission.resource !== row.resource)
              const chosen = row.actions
                .filter((action) => keys.includes(action))
                .map((action) => Permission.parse({ resource: row.resource, action }))
              onChange([...others, ...chosen])
            }}
          />
        )
      })}
    </fieldset>
  )
}

function RoleForm({
  role,
  stored,
  onReload,
}: {
  readonly role: Role | null
  readonly stored: readonly Permission[]
  readonly onReload: () => void
}) {
  const panel = usePanel()
  const { create, update } = useRoleCommands()
  const [opened] = useState(role)
  const [openedPermissions] = useState(stored)
  const [values, setValues] = useState<RoleFormValues>(opened === null ? NEW_ROLE_VALUES : roleFormValues(opened, openedPermissions))
  const [submitted, setSubmitted] = useState(false)
  const [state, setState] = useState(CLEAN_FORM)
  const own: readonly Issue[] = submitted ? formFieldIssues(roleFormIssues(values)) : []
  const errorOf = (name: string) => issueError(own, state.answered, name)
  const backToList = () => {
    panel.open(PANEL_IDS.roles)
  }
  const change = (next: Partial<RoleFormValues>) => {
    setValues((current) => ({ ...current, ...next }))
  }

  const submit = async () => {
    setSubmitted(true)
    setState(CLEAN_FORM)
    if (roleFormIssues(values).length > 0) return
    const result =
      opened === null
        ? await create.run(values)
        : await update.run({ role: opened, stored: openedPermissions, openedVersion: opened.version, values })
    if (result.ok) backToList()
    else setState(formStateOf(result.error, ROLE_FIELDS))
  }

  return (
    <EntityForm
      titleKey={opened === null ? 'roles.newTitle' : 'roles.editTitle'}
      submitKey={opened === null ? 'common.create' : 'common.save'}
      isPending={create.isPending || update.isPending}
      failure={state.failure}
      onReload={onReload}
      onCancel={backToList}
      onSubmit={() => {
        void submit()
      }}
    >
      <TextField
        labelKey="roles.name"
        name="name"
        isRequired
        value={values.name}
        onChange={(name) => {
          change({ name })
        }}
        error={errorOf('name')}
      />
      <TextAreaField
        labelKey="roles.description"
        name="description"
        value={values.description}
        onChange={(description) => {
          change({ description })
        }}
        error={errorOf('description')}
      />
      <ColorField
        labelKey="palette.label"
        name="color_key"
        value={values.color_key}
        onChange={(color_key) => {
          change({ color_key })
        }}
        error={errorOf('color_key')}
      />
      <PermissionGrid
        permissions={values.permissions}
        onChange={(permissions) => {
          change({ permissions })
        }}
      />
    </EntityForm>
  )
}

function RoleEditor({ role, stored }: { readonly role: Role | null; readonly stored: readonly Permission[] }) {
  // A new generation opens the latest row, after someone else changed it.
  const [generation, setGeneration] = useState(0)
  return (
    <RoleForm
      key={generation}
      role={role}
      stored={stored}
      onReload={() => {
        setGeneration((current) => current + 1)
      }}
    />
  )
}

function BaselinePicker({ organization, roles }: { readonly organization: Organization; readonly roles: readonly Role[] }) {
  const setBaseline = useSetBaselineRole()
  const [failure, setFailure] = useState<AppError | null>(null)
  const options: SelectOption<RoleId | null>[] = [
    { key: NO_BASELINE, label: { key: 'roles.baselineNone' }, value: null },
    ...roles.map((role) => ({ key: role.id, label: { text: role.name }, value: role.id })),
  ]
  return (
    <div className="flex flex-col gap-xs">
      <SelectField
        labelKey="roles.baseline"
        name="baseline_role_id"
        value={organization.baseline_role_id}
        options={options}
        onChange={(roleId) => {
          setFailure(null)
          void setBaseline.run({ organization, roleId }).then((result) => {
            if (!result.ok) setFailure(result.error)
          })
        }}
        error={null}
      />
      <p className="text-micro text-text-muted">{t('roles.baselineHint')}</p>
      {failure === null ? null : <FailureNotice error={failure} />}
    </div>
  )
}

export function RolesModule() {
  const panel = usePanel()
  const roles = useRoles()
  const pairs = useRolePermissions()
  const organization = useCurrentOrganization()
  const permissions = useRolePermissionHints()
  const commands = useRoleCommands()
  const [failure, setFailure] = useState<AppError | null>(null)
  const [archiving, setArchiving] = useState<Role | null>(null)

  if (roles.status === 'failed') return <FailureNotice error={roles.error} />
  if (pairs.status === 'failed') return <FailureNotice error={pairs.error} />
  if (roles.status === 'loading' || pairs.status === 'loading') return <LoadingNotice />

  const live = liveRoles(roles.value)
  const newRole = () => {
    setFailure(null)
    panel.open(PANEL_IDS.roles, { entity: NEW_ENTITY })
  }

  if (panel.entity === NEW_ENTITY) {
    if (!permissions.create) return <EmptyNotice titleKey="roles.notFound" bodyKey="roles.emptyReadOnly" />
    return <RoleEditor role={null} stored={[]} />
  }
  if (panel.entity !== null) {
    const role = live.find((candidate) => candidate.id === panel.entity)
    if (role === undefined || !permissions.update) {
      return (
        <div className="flex flex-col items-center gap-md py-xl text-center">
          <p className="text-name text-text-muted">{t('roles.notFound')}</p>
          <Button
            onPress={() => {
              panel.open(PANEL_IDS.roles)
            }}
          >
            {t('common.backToList')}
          </Button>
        </div>
      )
    }
    return <RoleEditor key={role.id} role={role} stored={permissionsOfRole(pairs.value, role.id)} />
  }

  const current = organization.status === 'ready' ? organization.value : null
  const baseline =
    current !== null && permissions.baseline ? <BaselinePicker organization={current} roles={live} /> : null

  if (live.length === 0) {
    return (
      <div className="flex flex-col gap-md">
        {baseline}
        <EmptyNotice titleKey="roles.emptyTitle" bodyKey={permissions.create ? 'roles.emptyBody' : 'roles.emptyReadOnly'}>
          {permissions.create ? (
            <Button variant="primary" onPress={newRole}>
              <Plus aria-hidden size={14} />
              {t('roles.new')}
            </Button>
          ) : null}
        </EmptyNotice>
      </div>
    )
  }

  const actionsOf = (role: Role): RowAction[] =>
    permissions.archive
      ? [
          {
            id: 'archive',
            labelKey: 'common.archive',
            icon: <Archive aria-hidden size={14} />,
            onAction: () => {
              setFailure(null)
              setArchiving(role)
            },
          },
        ]
      : []

  return (
    <div className="flex flex-col gap-md">
      <p className="text-name text-text-muted">{t('roles.hint')}</p>
      {baseline}
      {failure === null ? null : <FailureNotice error={failure} />}
      <ul aria-label={t('roles.listLabel')} className="flex flex-col">
        {live.map((role) => {
          const count = permissionsOfRole(pairs.value, role.id).length
          const text = (
            <span className="flex min-w-none flex-col">
              <span className="truncate text-name font-semibold">{role.name}</span>
              <span className="truncate text-micro text-text-muted">
                {count} {t('roles.permissionCount')}
                {current?.baseline_role_id === role.id ? ` · ${t('roles.isBaseline')}` : ''}
              </span>
            </span>
          )
          return (
            <li key={role.id} className="flex items-center gap-2xs border-b border-line bg-surface">
              <span aria-hidden className={`ms-xs size-dot shrink-0 rounded-pill ${toneOf(role.color_key).fill}`} />
              {permissions.update ? (
                <AriaButton
                  onPress={() => {
                    panel.open(PANEL_IDS.roles, { entity: role.id })
                  }}
                  className="flex min-h-touch min-w-none flex-1 cursor-pointer items-center rounded-control p-xs text-start outline-focus md:min-h-control data-focus-visible:outline-2 data-hovered:bg-inner"
                >
                  {text}
                </AriaButton>
              ) : (
                <span className="flex min-h-touch min-w-none flex-1 items-center p-xs md:min-h-control">{text}</span>
              )}
              <ActionMenu labelKey="common.actions" actions={actionsOf(role)} />
            </li>
          )
        })}
      </ul>
      {permissions.create ? (
        <div>
          <Button onPress={newRole}>
            <Plus aria-hidden size={14} />
            {t('roles.new')}
          </Button>
        </div>
      ) : null}
      {archiving === null ? null : (
        <SmallDialog
          role="alertdialog"
          titleKey="roles.archiveTitle"
          hintKey="roles.archiveBody"
          confirmKey="common.archive"
          isPending={commands.archive.isPending}
          onCancel={() => {
            setArchiving(null)
          }}
          onConfirm={() => {
            void commands.archive.run(archiving).then((result) => {
              setArchiving(null)
              if (!result.ok) setFailure(result.error)
            })
          }}
        />
      )}
    </div>
  )
}
