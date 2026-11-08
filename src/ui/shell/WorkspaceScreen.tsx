import type { AuthIdentity } from '@contracts'
import { t } from '@i18n'
import { useCurrentOrganization } from '@logic'
import { UserMenu } from './UserMenu'
import { FailureScreen, LoadingScreen } from './states'

/**
 * The workspace frame (D-023, D-024): a viewport, with navigation floating over it, at the top on
 * desktop and at the bottom on mobile. Controls join the bar as their slices build them (D-076).
 */
export function WorkspaceScreen({ identity }: { readonly identity: AuthIdentity }) {
  const organization = useCurrentOrganization()
  if (organization.status === 'loading') return <LoadingScreen />
  if (organization.status === 'failed') return <FailureScreen error={organization.error} />

  return (
    <div className="relative flex min-h-dvh bg-canvas p-sm">
      <main className="flex flex-1 items-center justify-center rounded-panel border border-line bg-surface px-xl">
        <div className="flex flex-col items-center gap-xs text-center">
          <h1 className="text-title font-bold tracking-tight">{t('workspace.emptyTitle')}</h1>
          <p className="text-body text-text-muted">{t('workspace.emptyBody')}</p>
        </div>
      </main>
      <nav
        aria-label={t('workspace.navigation')}
        className="glass-bar bottom-safe absolute inset-x-lg flex items-center justify-between gap-md rounded-pill p-xs md:top-lg md:bottom-auto"
      >
        <span className="truncate px-md text-control font-bold">{organization.value?.name ?? t('app.name')}</span>
        <UserMenu identity={identity} />
      </nav>
    </div>
  )
}
