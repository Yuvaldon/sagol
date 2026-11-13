import { RANGE_KINDS, type RangeKind } from '@config'
import { t, type I18nKey } from '@i18n'
import { useDateWindow, type WindowKind } from '@logic'
import type { Deployment } from '@contracts'
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button as AriaButton, Header, Menu, MenuSection, MenuTrigger } from 'react-aria-components'
import { Popover } from '../primitives/overlays'
import { formatDate, formatDateRange } from '../patterns/dates'
import { useIsDesktop } from '../patterns/media'
import { Button, IconButton } from '../primitives/Button'
import { MenuChoice } from './menu'
import { MENU_HEADER, MENU_LIST, MENU_POPOVER, onlyKey } from './menuStyles'

// The date window and its range picker (D-103, D-211). The label opens the picker: a day, a week, a month, or a whole
// rotation of the scope, past ones too: the only way to them, with no rotation control or label in the bar (D-217). The arrows step by the chosen unit; the product is RTL only, so "back" points to the right.
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
function rotationDates(rotation: Deployment): string {
  return rotation.end_date === null ? formatDate(rotation.start_date, 'dayMonth') : formatDateRange(rotation.start_date, rotation.end_date)
}

/**
 * What the picker offers: the steps, and every rotation of the scope (D-217). One rotation is a single "whole rotation"
 * choice with its dates; more are a list under that header. Opening a rotation lives in the navigation panel.
 */
function RangeMenu() {
  const { window, rotations, setRange, showRotation } = useDateWindow()
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
      {rotations.length === 1 && rotations[0] !== undefined ? (
        <MenuSection>
          <MenuChoice
            id={`${ROTATION_KEY}${rotations[0].id}`}
            label={t('workspace.rotations')}
            detail={rotationDates(rotations[0])}
          />
        </MenuSection>
      ) : rotations.length > 1 ? (
        <MenuSection>
          <Header className={MENU_HEADER}>{t('workspace.rotations')}</Header>
          {rotations.map((rotation) => (
            <MenuChoice key={rotation.id} id={`${ROTATION_KEY}${rotation.id}`} label={rotation.name} detail={rotationDates(rotation)} />
          ))}
        </MenuSection>
      ) : null}
    </Menu>
  )
}

export function WindowNavigator() {
  const { window, canShift, shift, goToToday } = useDateWindow()
  const isDesktop = useIsDesktop()
  if (window === null) return null
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
          <span aria-live="polite">{formatDateRange(window.from, window.to)}</span>
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
      {/* On a phone the bar has no room for the word: an icon with the same name and a tooltip (D-215). */}
      {window.holdsToday ? null : isDesktop ? (
        <Button onPress={goToToday}>{t('workspace.today')}</Button>
      ) : (
        <IconButton labelKey="workspace.today" onPress={goToToday}>
          <CalendarCheck aria-hidden size={14} />
        </IconButton>
      )}
    </div>
  )
}
