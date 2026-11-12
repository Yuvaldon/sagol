import { BAR_COLOR_MODES, TOOLTIP, type BarColorMode } from '@config'
import { t, type I18nKey } from '@i18n'
import { useActiveView, useBarColors } from '@logic'
import { Button as AriaButton, Header, Menu, MenuSection, MenuTrigger, Popover, TooltipTrigger } from 'react-aria-components'
import { NameTooltip } from '../primitives/Button'
import { AVAILABLE_VIEWS, engineOf } from '../engines/registry'
import { MenuChoice } from './menu'
import { MENU_HEADER, MENU_LIST, MENU_POPOVER, MENU_TRIGGER, onlyKey } from './menuStyles'

// The view menu lists what the engine registry holds, and nothing else (D-076, D-108). The colors of
// the leaves sit under their own heading (D-112), for every engine (D-174), so the bars gain no control.

/** Between the menu's name and the view chosen, in its tooltip. */
const LABEL_SEPARATOR = ': '

const COLOR_LABELS: Record<BarColorMode, I18nKey> = {
  type: 'workspace.colorsByType',
  uniform: 'workspace.colorsUniform',
}

export function ViewSwitcher() {
  const { view, select } = useActiveView(AVAILABLE_VIEWS)
  const colors = useBarColors()
  const current = engineOf(view)
  return (
    <MenuTrigger>
      <TooltipTrigger delay={TOOLTIP.delayMs} closeDelay={TOOLTIP.closeDelayMs}>
        <AriaButton className={MENU_TRIGGER}>
          <current.Icon aria-hidden size={14} />
          <span className="sr-only">
            {t('workspace.view')} {t(current.labelKey)}
          </span>
        </AriaButton>
        <NameTooltip>{[t('workspace.view'), t(current.labelKey)].join(LABEL_SEPARATOR)}</NameTooltip>
      </TooltipTrigger>
      <Popover className={MENU_POPOVER}>
        <Menu aria-label={t('workspace.view')} className={MENU_LIST}>
          <MenuSection
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[view]}
            onSelectionChange={(selection) => {
              const next = AVAILABLE_VIEWS.find((id) => id === onlyKey(selection))
              if (next !== undefined) select(next)
            }}
          >
            <Header className={MENU_HEADER}>{t('workspace.view')}</Header>
            {AVAILABLE_VIEWS.map((id) => {
              const entry = engineOf(id)
              return <MenuChoice key={id} id={id} label={t(entry.labelKey)} icon={<entry.Icon aria-hidden size={14} />} />
            })}
          </MenuSection>
          <MenuSection
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[colors.mode]}
            onSelectionChange={(selection) => {
              const next = BAR_COLOR_MODES.find((mode) => mode === onlyKey(selection))
              if (next !== undefined) colors.select(next)
            }}
          >
            <Header className={MENU_HEADER}>{t('workspace.colors')}</Header>
            {BAR_COLOR_MODES.map((mode) => (
              <MenuChoice key={mode} id={mode} label={t(COLOR_LABELS[mode])} />
            ))}
          </MenuSection>
        </Menu>
      </Popover>
    </MenuTrigger>
  )
}
