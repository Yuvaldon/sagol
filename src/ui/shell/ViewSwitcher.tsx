import { BAR_COLOR_MODES, TOOLTIP, type BarColorMode } from '@config'
import { t, type I18nKey } from '@i18n'
import { useActiveView, useBarColors } from '@logic'
import { Check } from 'lucide-react'
import {
  Button as AriaButton,
  Header,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
  TooltipTrigger,
  type Selection,
} from 'react-aria-components'
import { NameTooltip } from '../primitives/Button'
import type { ReactNode } from 'react'
import { AVAILABLE_VIEWS, engineOf } from '../engines/registry'

// The view menu lists what the engine registry holds, and nothing else (D-076, D-108). The colors of
// the leaves sit under their own heading (D-112), for every engine (D-174), so the bars gain no control.

const ITEM =
  'flex min-h-touch cursor-pointer items-center gap-sm rounded-control px-md text-control whitespace-nowrap outline-none md:min-h-control data-focused:bg-inner'
/** Between the menu's name and the view chosen, in its tooltip. */
const LABEL_SEPARATOR = ': '

const HEADER = 'px-md pt-xs pb-2xs text-label font-semibold text-text-muted'

const COLOR_LABELS: Record<BarColorMode, I18nKey> = {
  type: 'workspace.colorsByType',
  uniform: 'workspace.colorsUniform',
}

function only(selection: Selection): string | null {
  if (selection === 'all') return null
  const [key] = [...selection]
  return typeof key === 'string' ? key : null
}

function Item({ id, label, icon }: { readonly id: string; readonly label: string; readonly icon?: ReactNode }) {
  return (
    <MenuItem id={id} textValue={label} className={ITEM}>
      {({ isSelected }) => (
        <>
          {icon}
          <span className="flex-1">{label}</span>
          {isSelected ? <Check aria-hidden size={14} /> : null}
        </>
      )}
    </MenuItem>
  )
}

export function ViewSwitcher() {
  const { view, select } = useActiveView(AVAILABLE_VIEWS)
  const colors = useBarColors()
  const current = engineOf(view)
  return (
    <MenuTrigger>
      <TooltipTrigger delay={TOOLTIP.delayMs} closeDelay={TOOLTIP.closeDelayMs}>
        <AriaButton className="inline-flex min-h-touch min-w-touch cursor-pointer items-center justify-center rounded-pill bg-inner text-text outline-focus outline-offset-2 md:min-h-control md:min-w-control data-focus-visible:outline-2 data-hovered:bg-line">
          <current.Icon aria-hidden size={14} />
          <span className="sr-only">
            {t('workspace.view')} {t(current.labelKey)}
          </span>
        </AriaButton>
        <NameTooltip>{[t('workspace.view'), t(current.labelKey)].join(LABEL_SEPARATOR)}</NameTooltip>
      </TooltipTrigger>
      <Popover className="glass-menu min-w-trigger rounded-panel p-xs">
        <Menu aria-label={t('workspace.view')} className="flex max-w-menu flex-col gap-2xs outline-none">
          <MenuSection
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[view]}
            onSelectionChange={(selection) => {
              const next = AVAILABLE_VIEWS.find((id) => id === only(selection))
              if (next !== undefined) select(next)
            }}
          >
            <Header className={HEADER}>{t('workspace.view')}</Header>
            {AVAILABLE_VIEWS.map((id) => {
              const entry = engineOf(id)
              return <Item key={id} id={id} label={t(entry.labelKey)} icon={<entry.Icon aria-hidden size={14} />} />
            })}
          </MenuSection>
            <MenuSection
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[colors.mode]}
              onSelectionChange={(selection) => {
                const next = BAR_COLOR_MODES.find((mode) => mode === only(selection))
                if (next !== undefined) colors.select(next)
              }}
            >
              <Header className={HEADER}>{t('workspace.colors')}</Header>
              {BAR_COLOR_MODES.map((mode) => (
                <Item key={mode} id={mode} label={t(COLOR_LABELS[mode])} />
              ))}
            </MenuSection>
        </Menu>
      </Popover>
    </MenuTrigger>
  )
}
