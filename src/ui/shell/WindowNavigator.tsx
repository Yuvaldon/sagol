import { DATE_WINDOW, RANGE_KINDS, type RangeKind } from '@config'
import { t, type I18nKey } from '@i18n'
import { customSpan, useDateWindow, type WindowKind } from '@logic'
import type { CalendarDate, Deployment } from '@contracts'
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Button as AriaButton, Header, Menu, MenuSection, MenuTrigger } from 'react-aria-components'
import { Popover } from '../primitives/overlays'
import { formatDate, formatDateRange } from '../patterns/dates'
import { SmallDialog } from '../patterns/Dialogs'
import { useIsDesktop } from '../patterns/media'
import { DateField } from '../primitives/DateField'
import { Button, IconButton } from '../primitives/Button'
import { MenuChoice } from './menu'
import { MENU_HEADER, MENU_LIST, MENU_POPOVER, onlyKey } from './menuStyles'

// The date window and its range picker (D-103, D-211). The label opens the picker: a day, a week, two or four weeks (D-383), a month, a whole
// rotation of the scope, past ones too, newest first: the only way to them, with no rotation control or label in the bar
// (D-217, D-339); or another range, any two dates up to the window's cap (D-339). The arrows step by the chosen unit;
// the product is RTL only, so "back" points to the right.
// "Today" appears only while the window does not hold today (D-076).

type StepKind = Exclude<RangeKind, 'rotation'>
const STEP_KINDS = RANGE_KINDS.filter((kind): kind is StepKind => kind !== 'rotation')
const ROTATION_KEY = 'rotation:'
const CUSTOM_KEY = 'custom'

const RANGE_LABELS: Record<StepKind, I18nKey> = {
  day: 'workspace.ranges.day',
  week: 'workspace.ranges.week',
  two_weeks: 'workspace.ranges.two_weeks',
  four_weeks: 'workspace.ranges.four_weeks',
  month: 'workspace.ranges.month',
}
const PREVIOUS_LABELS: Record<WindowKind, I18nKey> = {
  day: 'workspace.previousWindow.day',
  week: 'workspace.previousWindow.week',
  two_weeks: 'workspace.previousWindow.two_weeks',
  four_weeks: 'workspace.previousWindow.four_weeks',
  month: 'workspace.previousWindow.month',
  rotation: 'workspace.previousWindow.rotation',
  custom: 'workspace.previousWindow.custom',
}
const NEXT_LABELS: Record<WindowKind, I18nKey> = {
  day: 'workspace.nextWindow.day',
  week: 'workspace.nextWindow.week',
  two_weeks: 'workspace.nextWindow.two_weeks',
  four_weeks: 'workspace.nextWindow.four_weeks',
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
function RangeMenu({ onCustom }: { readonly onCustom: () => void }) {
  const { window, rotations, setRange, showRotation } = useDateWindow()
  if (window === null) return null
  // Another range is never marked: choosing it again opens its dates, which a marked choice would only clear.
  const selected =
    window.kind === 'custom' ? [] : [window.kind === 'rotation' && window.rotationId !== null ? `${ROTATION_KEY}${window.rotationId}` : window.kind]
  // The scope's rotations run by their start; the picker lists the latest first, the arrows still step in time.
  const newestFirst = rotations.toReversed()
  return (
    <Menu
      aria-label={t('workspace.range')}
      className={MENU_LIST}
      selectionMode="single"
      selectedKeys={selected}
      onSelectionChange={(selection) => {
        const key = onlyKey(selection)
        if (key === null) return
        if (key === CUSTOM_KEY) {
          onCustom()
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
          {newestFirst.map((rotation) => (
            <MenuChoice key={rotation.id} id={`${ROTATION_KEY}${rotation.id}`} label={rotation.name} detail={rotationDates(rotation)} />
          ))}
        </MenuSection>
      ) : null}
      <MenuSection>
        <MenuChoice id={CUSTOM_KEY} label={t('workspace.customRange')} />
      </MenuSection>
    </Menu>
  )
}

/** Another range (D-339): two dates, both included, at most `DATE_WINDOW.maxDays` days, on the custom window of D-211. */
function CustomRangeDialog({ from, to, onClose }: { readonly from: CalendarDate; readonly to: CalendarDate; readonly onClose: () => void }) {
  const { showCustom } = useDateWindow()
  const [draft, setDraft] = useState<{ readonly from: CalendarDate | ''; readonly to: CalendarDate | '' }>({ from, to })
  const [tried, setTried] = useState(false)
  const complete = draft.from !== '' && draft.to !== '' && draft.from <= draft.to
  const span = draft.from === '' || draft.to === '' ? null : customSpan({ from: draft.from, to: draft.to })
  const error = !tried || span !== null ? null : complete ? 'workspace.customTooLong' : 'workspace.customInvalid'
  return (
    <SmallDialog
      titleKey="workspace.customTitle"
      confirmKey="workspace.customShow"
      isPending={false}
      onCancel={onClose}
      onConfirm={() => {
        setTried(true)
        if (span !== null && showCustom(span.from, span.to)) onClose()
      }}
    >
      <DateField
        labelKey="workspace.customFrom"
        name="from"
        value={draft.from}
        onChange={(next) => {
          setDraft((current) => ({ ...current, from: next }))
        }}
        error={null}
      />
      <DateField
        labelKey="workspace.customTo"
        name="to"
        value={draft.to}
        onChange={(next) => {
          setDraft((current) => ({ ...current, to: next }))
        }}
        error={error}
      />
      <p className="text-micro text-text-muted">
        {t('workspace.customLimit')} <span className="tabular-nums">{DATE_WINDOW.maxDays}</span>
      </p>
    </SmallDialog>
  )
}

export function WindowNavigator() {
  const { window, canShift, shift, goToToday } = useDateWindow()
  const isDesktop = useIsDesktop()
  const [custom, setCustom] = useState(false)
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
          <RangeMenu
            onCustom={() => {
              setCustom(true)
            }}
          />
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
      {custom ? (
        <CustomRangeDialog
          from={window.from}
          to={window.to}
          onClose={() => {
            setCustom(false)
          }}
        />
      ) : null}
    </div>
  )
}
