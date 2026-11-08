import { PANEL_IDS } from '@config'
import type { AuthIdentity } from '@contracts'
import { t } from '@i18n'
import { useCurrentOrganization, useModuleAccess, usePanel } from '@logic'
import { Network } from 'lucide-react'
import { UnitsDrawer } from '../modules/units/UnitsDrawer'
import { Button } from '../primitives/Button'
import { UserMenu } from './UserMenu'
import { FailureScreen, LoadingScreen } from './states'

/**
 * The workspace frame (D-023, D-024): a viewport, with navigation floating over it, at the top on
 * desktop and at the bottom on mobile. Controls join the bar as their slices build them (D-076).
 */
export function WorkspaceScreen({ identity }: { readonly identity: AuthIdentity }) {
  const organization = useCurrentOrganization()
  const access = useModuleAccess()
  const panel = usePanel()
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
        <div className="flex shrink-0 items-center gap-xs">
          {access.units ? (
            <Button
              onPress={() => {
                panel.open(PANEL_IDS.units)
              }}
            >
              <Network aria-hidden size={14} />
              {t('units.open')}
            </Button>
          ) : null}
          <UserMenu identity={identity} />
        </div>
      </nav>
      <UnitsDrawer />
    </div>
  )
}
