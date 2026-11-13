import { BAR_COLOR_MODES, FOCUS_MODE, type BarColorMode } from '@config'
import { t, type I18nKey } from '@i18n'
import { useActiveView, useBarColors } from '@logic'
import { Maximize2 } from 'lucide-react'
import { Button as AriaButton, Label, Radio, RadioGroup } from 'react-aria-components'
import { Drawer } from '../patterns/Drawer'
import { AVAILABLE_VIEWS, engineOf } from '../engines/registry'
import { useViewDevice } from '../patterns/media'
import { useFocusMode } from './focusMode'

// The view picker (D-311): a card per view the device offers, the current one marked, and under them the colors of
// the leaves. Picking a view, even the current one, shows it and closes the sheet; the colors stay open to compare.
// Focus mode is the sheet's last control, with the board's other view controls (D-301).

const CARD =
  'flex min-h-touch cursor-pointer flex-col items-center justify-center gap-xs rounded-panel border border-line p-md text-control text-text outline-focus outline-offset-2 data-focus-visible:outline-2 data-hovered:bg-inner data-selected:border-action-solid data-selected:bg-inner data-selected:font-semibold'
const SEGMENT =
  'flex min-h-touch flex-1 cursor-pointer items-center justify-center rounded-pill px-md text-control text-text outline-focus outline-offset-2 md:min-h-control data-focus-visible:outline-2 data-hovered:bg-line data-selected:bg-surface data-selected:font-semibold'

const ACTION =
  'flex min-h-touch cursor-pointer items-center gap-sm rounded-control px-md text-control text-text outline-focus outline-offset-2 md:min-h-control data-focus-visible:outline-2 data-hovered:bg-inner'

const COLOR_LABELS: Record<BarColorMode, I18nKey> = {
  type: 'workspace.colorsByType',
  uniform: 'workspace.colorsUniform',
}

export function ViewSheet({ onClose }: { readonly onClose: () => void }) {
  const { view, select } = useActiveView(AVAILABLE_VIEWS, useViewDevice())
  const colors = useBarColors()
  const focusMode = useFocusMode()
  return (
    <Drawer titleKey="workspace.view" onClose={onClose}>
      <div className="flex flex-col gap-xl">
        <RadioGroup
          aria-label={t('workspace.view')}
          value={view}
          onChange={(key) => {
            const next = AVAILABLE_VIEWS.find((id) => id === key)
            if (next === undefined) return
            select(next)
            onClose()
          }}
          className="grid grid-cols-2 gap-sm"
        >
          {AVAILABLE_VIEWS.map((id) => {
            const entry = engineOf(id)
            return (
              <Radio
                key={id}
                value={id}
                // The current card changes nothing, so its press only closes the sheet: a choice is made either way.
                onPress={() => {
                  if (id === view) onClose()
                }}
                className={CARD}
              >
                <entry.Icon aria-hidden size={22} />
                {t(entry.labelKey)}
              </Radio>
            )
          })}
        </RadioGroup>
        <RadioGroup
          value={colors.mode}
          orientation="horizontal"
          onChange={(key) => {
            const next = BAR_COLOR_MODES.find((mode) => mode === key)
            if (next !== undefined) colors.select(next)
          }}
          className="flex flex-col gap-xs"
        >
          <Label className="text-label font-semibold text-text-muted">{t('workspace.colors')}</Label>
          <div className="flex gap-2xs rounded-pill bg-inner p-2xs">
            {BAR_COLOR_MODES.map((mode) => (
              <Radio key={mode} value={mode} className={SEGMENT}>
                {t(COLOR_LABELS[mode])}
              </Radio>
            ))}
          </div>
        </RadioGroup>
        {focusMode.available ? (
          <AriaButton
            aria-keyshortcuts={FOCUS_MODE.shortcut}
            onPress={() => {
              onClose()
              focusMode.enter()
            }}
            className={ACTION}
          >
            <Maximize2 aria-hidden size={16} />
            <span className="flex-1 text-start">{t('workspace.focusEnter')}</span>
            <kbd className="font-sans text-label text-text-muted">{FOCUS_MODE.shortcut}</kbd>
          </AriaButton>
        ) : null}
      </div>
    </Drawer>
  )
}
