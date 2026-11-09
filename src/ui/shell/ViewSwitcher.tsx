import { t } from '@i18n'
import { useActiveView } from '@logic'
import { Check } from 'lucide-react'
import { Button as AriaButton, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components'
import { AVAILABLE_VIEWS, engineOf } from '../engines/registry'

// The view switcher lists what the engine registry holds, and nothing else (D-076, D-108).

export function ViewSwitcher() {
  const { view, select } = useActiveView(AVAILABLE_VIEWS)
  const current = engineOf(view)
  return (
    <MenuTrigger>
      <AriaButton className="inline-flex min-h-touch min-w-touch cursor-pointer items-center justify-center gap-xs rounded-pill bg-inner px-sm text-control font-semibold text-text outline-focus outline-offset-2 md:min-h-control md:min-w-control data-focus-visible:outline-2 data-hovered:bg-line">
        <current.Icon aria-hidden size={14} />
        <span className="sr-only">{t('workspace.view')}</span>
        <span className="sr-only md:not-sr-only">{t(current.labelKey)}</span>
      </AriaButton>
      <Popover className="glass-menu min-w-trigger rounded-panel p-xs">
        <Menu
          aria-label={t('workspace.view')}
          selectionMode="single"
          selectedKeys={[view]}
          onAction={(key) => {
            const next = AVAILABLE_VIEWS.find((id) => id === key)
            if (next !== undefined) select(next)
          }}
          className="flex max-w-menu flex-col gap-2xs outline-none"
        >
          {AVAILABLE_VIEWS.map((id) => {
            const entry = engineOf(id)
            return (
              <MenuItem
                key={id}
                id={id}
                textValue={t(entry.labelKey)}
                className="flex min-h-touch cursor-pointer items-center gap-sm rounded-control px-md text-control whitespace-nowrap outline-none md:min-h-control data-focused:bg-inner"
              >
                {({ isSelected }) => (
                  <>
                    <entry.Icon aria-hidden size={14} />
                    <span className="flex-1">{t(entry.labelKey)}</span>
                    {isSelected ? <Check aria-hidden size={14} /> : null}
                  </>
                )}
              </MenuItem>
            )
          })}
        </Menu>
      </Popover>
    </MenuTrigger>
  )
}
