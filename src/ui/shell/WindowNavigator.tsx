import { NEW_ENTITY, PANEL_IDS, RANGE_KINDS, type RangeKind } from '@config'
import { t, type I18nKey } from '@i18n'
import { pickableRotations, useDateWindow, useDeploymentPermissions, usePanel, useUnits, type WindowKind } from '@logic'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button as AriaButton, Header, Menu, MenuItem, MenuSection, MenuTrigger, Popover } from 'react-aria-components'
import { formatDate, formatDateRange } from '../patterns/dates'
import { Button, IconButton } from '../primitives/Button'
import { MenuChoice } from './menu'
import { MENU_HEADER, MENU_ITEM, MENU_LIST, MENU_POPOVER, onlyKey } from './menuStyles'

// The date window and its range picker (D-103, D-211). The label opens the picker: a day, a week, a month, or a whole
// rotation of the scope. The arrows step by the chosen unit; the product is RTL only, so "back" points to the right.
// "Today" appears only while the window does not hold today (D-076).

type StepKind = Exclude<RangeKind, 'rotation'>
const STEP_KINDS = RANGE_KINDS.filter((kind): kind is StepKind => kind !== 'rotation')
const ROTATION_KEY = 'rotation:'

const RANGE_LABELS: Record<StepKind, I18nKey> = {
  day: 'workspace.ranges.day',
  week: 'workspace.ranges.week',
  month: 'workspace.ranges.month',
}
const PREVIOUS_LABELS: Record<WindowKind, I18nKey> = {
  day: 'workspace.previousWindow.day',
  week: 'workspace.previousWindow.week',
  month: 'workspace.previousWindow.month',
  rotation: 'workspace.previousWindow.rotation',
  custom: 'workspace.previousWindow.custom',
}
const NEXT_LABELS: Record<WindowKind, I18nKey> = {
  day: 'workspace.nextWindow.day',
  week: 'workspace.nextWindow.week',
  month: 'workspace.nextWindow.month',
  rotation: 'workspace.nextWindow.rotation',
  custom: 'workspace.nextWindow.custom',
}
const NEW_ROTATION_KEY = 'new-rotation'

/** What the picker offers to pick: the steps, and the running and upcoming rotations, or creating the first one. */
function RangeMenu() {
  const { window, today, rotations, setRange, showRotation } = useDateWindow()
  const units = useUnits()
  const panel = usePanel()
  const pickable = today === null ? [] : pickableRotations(rotations, today)
  const liveUnits = units.status === 'ready' ? units.value : []
  const { createAny } = useDeploymentPermissions(liveUnits, rotations)
  if (window === null) return null
  const selected =
    window.kind === 'rotation' && window.rotationId !== null ? `${ROTATION_KEY}${window.rotationId}` : window.kind
  return (
    <Menu
      aria-label={t('workspace.range')}
      className={MENU_LIST}
      selectionMode="single"
      selectedKeys={[selected]}
      onSelectionChange={(selection) => {
        const key = onlyKey(selection)
        if (key === null) return
        if (key === NEW_ROTATION_KEY) {
          panel.open(PANEL_IDS.deployments, { entity: NEW_ENTITY })
          return
        }
        if (key.startsWith(ROTATION_KEY)) {
          const rotation = rotations.find((candidate) => `${ROTATION_KEY}${candidate.id}` === key)
          if (rotation !== undefined) showRotation(rotation.id)
          return
        }
        const kind = STEP_KINDS.find((candidate) => candidate === key)
        if (kind !== undefined) setRange(kind)
      }}
    >
      <MenuSection>
        <Header className={MENU_HEADER}>{t('workspace.range')}</Header>
        {STEP_KINDS.map((kind) => (
          <MenuChoice key={kind} id={kind} label={t(RANGE_LABELS[kind])} />
        ))}
      </MenuSection>
      {pickable.length > 0 || createAny ? (
        <MenuSection>
          <Header className={MENU_HEADER}>{t('workspace.rotations')}</Header>
          {pickable.length > 0 ? (
            pickable.map((rotation) => (
              <MenuChoice
                key={rotation.id}
                id={`${ROTATION_KEY}${rotation.id}`}
                label={rotation.name}
                detail={
                  rotation.end_date === null
                    ? formatDate(rotation.start_date, 'dayMonth')
                    : formatDateRange(rotation.start_date, rotation.end_date)
                }
              />
            ))
          ) : (
            <MenuItem id={NEW_ROTATION_KEY} textValue={t('workspace.newRotation')} className={MENU_ITEM}>
              <Plus aria-hidden size={14} />
              <span className="flex-1">{t('workspace.newRotation')}</span>
            </MenuItem>
          )}
        </MenuSection>
      ) : null}
    </Menu>
  )
}

export function WindowNavigator() {
  const { window, rotations, canShift, shift, goToToday } = useDateWindow()
  if (window === null) return null
  const rotation = window.kind === 'rotation' ? rotations.find((candidate) => candidate.id === window.rotationId) : undefined
  return (
    <div className="flex shrink-0 items-center gap-2xs">
      <IconButton
        labelKey={PREVIOUS_LABELS[window.kind]}
        isDisabled={!canShift(-1)}
        onPress={() => {
          shift(-1)
        }}
      >
        <ChevronRight aria-hidden size={14} />
      </IconButton>
      <MenuTrigger>
        <AriaButton className="inline-flex min-h-touch cursor-pointer items-center gap-xs rounded-pill px-xs text-control font-semibold whitespace-nowrap tabular-nums outline-focus outline-offset-2 md:min-h-control data-focus-visible:outline-2 data-hovered:bg-inner">
          <span className="sr-only">{t('workspace.window')} </span>
          <span aria-live="polite" className="inline-flex items-center gap-xs">
            {rotation === undefined ? null : <span className="hidden md:inline">{rotation.name}</span>}
            <span>{formatDateRange(window.from, window.to)}</span>
          </span>
        </AriaButton>
        <Popover className={MENU_POPOVER}>
          <RangeMenu />
        </Popover>
      </MenuTrigger>
      <IconButton
        labelKey={NEXT_LABELS[window.kind]}
        isDisabled={!canShift(1)}
        onPress={() => {
          shift(1)
        }}
      >
        <ChevronLeft aria-hidden size={14} />
      </IconButton>
      {window.holdsToday ? null : <Button onPress={goToToday}>{t('workspace.today')}</Button>}
    </div>
  )
}
