import { BAR_COLOR_MODES, FOCUS_MODE, TOOLTIP, type BarColorMode } from '@config'
import { t, type I18nKey } from '@i18n'
import { useActiveView, useBarColors } from '@logic'
import { Maximize2 } from 'lucide-react'
import { Button as AriaButton, Header, Menu, MenuItem, MenuSection, MenuTrigger, Popover, TooltipTrigger } from 'react-aria-components'
import { NameTooltip } from '../primitives/Button'
import { AVAILABLE_VIEWS, engineOf } from '../engines/registry'
import { useFocusMode } from './focusMode'
import { MenuChoice } from './menu'
import { useIsDesktop, useViewDevice } from '../patterns/media'
import { SortSections } from './SortControl'
import { MENU_HEADER, MENU_ITEM, MENU_LIST, MENU_POPOVER, MENU_TRIGGER, onlyKey } from './menuStyles'

// The view menu lists what the engine registry holds, and nothing else (D-076, D-108). The colors of
// the leaves sit under their own heading (D-112), for every engine (D-174); focus mode is the last section, while a
// board is drawn (D-301), so the bars gain no control.

/** Between the menu's name and the view chosen, in its tooltip. */
const LABEL_SEPARATOR = ': '

const COLOR_LABELS: Record<BarColorMode, I18nKey> = {
  type: 'workspace.colorsByType',
  uniform: 'workspace.colorsUniform',
}

export function ViewSwitcher() {
  const { view, select } = useActiveView(AVAILABLE_VIEWS, useViewDevice())
  const colors = useBarColors()
  const current = engineOf(view)
  const isDesktop = useIsDesktop()
  const focusMode = useFocusMode()
  return (
    <MenuTrigger>
      <TooltipTrigger delay={TOOLTIP.delayMs} closeDelay={TOOLTIP.closeDelayMs}>
        {/* Focus returns here when focus mode ends (D-301). */}
        <AriaButton ref={focusMode.bind('control')} className={MENU_TRIGGER}>
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
          {/* A phone's strip has no room for the sort's button: its sections follow the view's here (D-273). */}
          {isDesktop ? null : <SortSections />}
          {focusMode.available ? (
            <MenuSection>
              <MenuItem
                id={FOCUS_MODE.menuItem}
                textValue={t('workspace.focusEnter')}
                aria-keyshortcuts={FOCUS_MODE.shortcut}
                onAction={focusMode.enter}
                className={MENU_ITEM}
              >
                <Maximize2 aria-hidden size={14} />
                <span className="flex-1">{t('workspace.focusEnter')}</span>
                <kbd className="font-sans text-label text-text-muted">{FOCUS_MODE.shortcut}</kbd>
              </MenuItem>
            </MenuSection>
          ) : null}
        </Menu>
      </Popover>
    </MenuTrigger>
  )
}
