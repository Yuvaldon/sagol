import type { UnitId } from '@contracts'
import { t } from '@i18n'
import { unitTreeRows, useUnits, useViewFilter } from '@logic'
import { ChevronDown, Network } from 'lucide-react'
import { useMemo } from 'react'
import { Button as AriaButton, ListBox, ListBoxItem, Popover, Select, SelectValue } from 'react-aria-components'
import { useIsDesktop } from '../patterns/media'

// Which unit the views show (D-104): the whole organization, or one unit with its sub-units, chosen from
// the tree the actor can see. The bar shows it as a compact label; a viewer whose tree has a single root reads that
// root's name rather than "the whole organization" (D-173). A phone's strip has no room for the name: the picker is its icon,
// with the name read aloud, and a single unit, with nothing to choose, is not shown there (D-273).

const ORGANIZATION_KEY = 'organization'
const OTHER_KEY = 'other'

interface UnitChoice {
  readonly key: string
  readonly label: string
  readonly depth: number
  readonly unitId: UnitId | null
}

export function UnitSelector() {
  const units = useUnits()
  const { unit, selectUnit } = useViewFilter()
  const isDesktop = useIsDesktop()
  const rows = useMemo(() => (units.status === 'ready' ? unitTreeRows(units.value) : []), [units])

  const choices = useMemo((): UnitChoice[] => {
    const list: UnitChoice[] = [
      { key: ORGANIZATION_KEY, label: t('workspace.wholeOrganization'), depth: 0, unitId: null },
      ...rows.map((row) => ({ key: row.unit.id, label: row.unit.name, depth: row.depth, unitId: row.unit.id })),
    ]
    // A link may name a unit the actor cannot see, or a filter only a later bar writes.
    if (unit.kind === 'unit' && !rows.some((row) => row.unit.id === unit.unitId)) {
      list.push({ key: unit.unitId, label: t('workspace.unitUnavailable'), depth: 0, unitId: unit.unitId })
    }
    if (unit.kind === 'other') list.push({ key: OTHER_KEY, label: t('workspace.otherFilter'), depth: 0, unitId: null })
    return list
  }, [rows, unit])

  const roots = rows.filter((row) => row.depth === 0)
  const anchor = roots.length === 1 ? (roots[0]?.unit.name ?? null) : null
  // Nothing to choose from: the whole organization is all there is (D-076).
  if (choices.length < 2) return null
  // A single unit in sight is the only scope there is: its name, not a picker (D-173).
  const only = rows.length === 1 && choices.length === 2 ? rows[0] : undefined
  if (only !== undefined) {
    if (!isDesktop) return null
    return (
      <span className="inline-flex min-h-touch max-w-unit-picker min-w-unit-floor items-center gap-xs rounded-pill bg-inner px-sm text-control font-semibold text-text md:min-h-control">
        <Network aria-hidden size={14} className="shrink-0 text-text-muted" />
        <span className="sr-only">{t('workspace.unit')}</span>
        <span className="truncate">{only.unit.name}</span>
      </span>
    )
  }
  const selected = unit.kind === 'organization' ? ORGANIZATION_KEY : unit.kind === 'unit' ? unit.unitId : OTHER_KEY

  return (
    <Select
      aria-label={t('workspace.unit')}
      value={selected}
      onChange={(key) => {
        const choice = choices.find((candidate) => candidate.key === key)
        if (choice === undefined || choice.key === OTHER_KEY) return
        selectUnit(choice.unitId)
      }}
      className={isDesktop ? 'max-w-unit-picker min-w-unit-floor' : 'shrink-0'}
    >
      <AriaButton
        className={`inline-flex min-h-touch cursor-pointer items-center rounded-pill bg-inner text-control ${isDesktop ? 'max-w-full min-w-none gap-xs ps-sm pe-sm' : 'min-w-touch justify-center'} font-semibold text-text outline-focus outline-offset-2 md:min-h-control data-focus-visible:outline-2 data-hovered:bg-line`}
      >
        <Network aria-hidden size={isDesktop ? 14 : 18} className="shrink-0 text-text-muted" />
        <SelectValue className={isDesktop ? 'truncate' : 'sr-only'}>
          {({ selectedText }) => (selected === ORGANIZATION_KEY && anchor !== null ? anchor : selectedText)}
        </SelectValue>
        {isDesktop ? <ChevronDown aria-hidden size={12} className="shrink-0" /> : null}
      </AriaButton>
      <Popover className="glass-menu min-w-trigger overflow-auto rounded-panel">
        <ListBox className="max-h-list max-w-menu overflow-auto p-xs outline-none">
          {choices.map((choice) => (
            <ListBoxItem
              key={choice.key}
              id={choice.key}
              textValue={choice.label}
              isDisabled={choice.key === OTHER_KEY}
              style={{ paddingInlineStart: `calc(var(--spacing-md) + var(--spacing-lg) * ${String(choice.depth)})` }}
              className="flex min-h-touch cursor-pointer items-center rounded-control pe-md text-control outline-none md:min-h-control data-focused:bg-inner data-selected:font-semibold"
            >
              {choice.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  )
}
