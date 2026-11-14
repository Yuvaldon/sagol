import { dashboardModuleKey, type DashboardModule } from '@contracts'
import { t } from '@i18n'
import { ChevronLeft, Plus } from 'lucide-react'
import { Menu, MenuItem, MenuTrigger, SubmenuTrigger } from 'react-aria-components'
import { Popover } from '../../../primitives/overlays'
import { Button } from '../../../primitives/Button'
import { MODULE_KEYS, moduleTitleKey } from './moduleWords'

// "הוספת רכיב" (D-349): the modules not on the board that the scope can draw; a big number opens its metrics.

const ITEM =
  'flex min-h-touch cursor-pointer items-center gap-sm rounded-control px-md text-control whitespace-nowrap outline-none md:min-h-control data-focused:bg-inner data-open:bg-inner'
const SURFACE = 'glass-menu min-w-trigger rounded-panel p-xs'
const LIST = 'flex max-w-menu flex-col gap-2xs outline-none'

export function AddMenu({ addable, onAdd }: { readonly addable: readonly DashboardModule[]; readonly onAdd: (module: DashboardModule) => void }) {
  const stats = addable.filter((module) => module.module === 'stat')
  const others = addable.filter((module) => module.module !== 'stat')
  if (addable.length === 0) return null
  return (
    <MenuTrigger>
      <Button>
        <Plus aria-hidden size={16} />
        {t('dashboard.add')}
      </Button>
      <Popover className={SURFACE}>
        <Menu className={LIST}>
          {stats.length === 0 ? null : (
            <SubmenuTrigger>
              <MenuItem id="stat" textValue={t(MODULE_KEYS.stat)} className={ITEM}>
                <span className="flex-1">{t(MODULE_KEYS.stat)}</span>
                <ChevronLeft aria-hidden size={14} />
              </MenuItem>
              <Popover className={SURFACE}>
                <Menu className={LIST}>
                  {stats.map((module) => (
                    <MenuItem key={dashboardModuleKey(module)} id={dashboardModuleKey(module)} textValue={t(moduleTitleKey(module))} onAction={() => onAdd(module)} className={ITEM}>
                      {t(moduleTitleKey(module))}
                    </MenuItem>
                  ))}
                </Menu>
              </Popover>
            </SubmenuTrigger>
          )}
          {others.map((module) => (
            <MenuItem key={dashboardModuleKey(module)} id={dashboardModuleKey(module)} textValue={t(moduleTitleKey(module))} onAction={() => onAdd(module)} className={ITEM}>
              {t(moduleTitleKey(module))}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  )
}
