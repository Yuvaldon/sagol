import { ARCHIVE_ENTITY, PANEL_IDS } from '@config'
import type { Soldier, SoldierId } from '@contracts'
import { t } from '@i18n'
import {
  NO_GROUPING,
  UNIT_GROUPING,
  archivedRows,
  fullName,
  useLeaveCreation,
  useMovePermissions,
  usePanel,
  usePeopleList,
  usePeopleView,
  useRosterPermissions,
  useShellPlace,
  useSoldiers,
  useSoldiersWithArchived,
  useToday,
  useUnits,
  type BoardGrouping,
  type MyDay,
  type PeopleItem,
  type PeopleList,
  type PeopleRow,
  type PeopleViewState,
} from '@logic'
import { Check, Search, SlidersHorizontal, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button as AriaButton, Checkbox } from 'react-aria-components'
import { headingLabel } from '../../board/labels'
import { useLongPress } from '../../board/gestures'
import { OptionsMenu, type OptionAction, type OptionRow } from '../../kit/OptionsMenu'
import { SelectionTray, type TrayAction } from '../../kit/Tray'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { TextField } from '../../primitives/fields'
import { PageFrame } from '../PageFrame'
import { CapsuleButton } from './CapsuleButton'
import { MoveDialog } from './MoveDialog'
import { PageTop } from './PageTop'

// "חיילים" (the handoff's Manage → Soldiers, D-482): every soldier the actor sees, regardless of presence, as thin person
// rows with their rank and tags and their next seven days. The capsule holds the search, the options (sort, grouping,
// the inactive, the days; "בחירה" and the archive after the divider) and "הוספת חיילים". A row opens the person card;
// holding it, or "בחירה", starts a multi-select whose tray offers what every chosen soldier allows.

const SEPARATOR = ' · '
const WORD = ' '
const CATEGORY = 'category:'

const DOT: Readonly<Record<MyDay['state'], string>> = {
  base: 'bg-text',
  round: 'border border-text-muted',
  away: 'border border-text-muted',
  pending: 'border border-dashed border-status-pending-line',
}

const TODAY_KEYS = {
  base: 'manage.people.todayBase',
  round: 'manage.people.todayAway',
  away: 'manage.people.todayAway',
  pending: 'manage.people.todayPending',
} as const

/** The next seven days as dots, today first and larger: filled on base, hollow at home (the handoff's person row). */
function Dots({ days }: { readonly days: readonly MyDay[] }) {
  const [first] = days
  return (
    <span className="flex shrink-0 items-center gap-2xs">
      {days.map((day, index) => (
        <span key={day.date} aria-hidden className={`shrink-0 rounded-full ${index === 0 ? 'size-sm' : 'size-dot'} ${DOT[day.state]}`} />
      ))}
      {first === undefined ? null : <span className="sr-only">{t(TODAY_KEYS[first.state])}</span>}
    </span>
  )
}

function detailOf(row: PeopleRow): string {
  return [
    ...(row.rank === null ? [] : [row.rank.title]),
    ...row.tags,
    ...(row.soldier.status === 'inactive' ? [t('manage.people.inactiveMark')] : []),
  ].join(SEPARATOR)
}

const ROW = 'flex min-h-touch w-full min-w-none items-center gap-sm px-lg py-xs text-start outline-focus -outline-offset-2 data-focus-visible:outline-2'

function RowText({ row }: { readonly row: PeopleRow }) {
  const detail = detailOf(row)
  return (
    <span className="flex min-w-none flex-1 items-baseline gap-sm">
      <span className="shrink-0 truncate text-body font-semibold">{fullName(row.soldier)}</span>
      {detail === '' ? null : <span className="min-w-none truncate text-small text-text-muted">{detail}</span>}
    </span>
  )
}

/** A soldier's row: it opens the card; held, it starts choosing with this soldier chosen. */
function PersonButton({ row, onHold }: { readonly row: PeopleRow; readonly onHold: () => void }) {
  const panel = usePanel()
  const hold = useLongPress(onHold)
  return (
    <AriaButton
      onPointerDownCapture={hold.onPointerDown}
      onPointerMove={hold.onPointerMove}
      onPointerUpCapture={hold.onPointerUp}
      onPointerCancel={hold.onPointerCancel}
      onPress={() => {
        if (hold.consumed()) return
        panel.open(PANEL_IDS.soldiers, { entity: row.soldier.id })
      }}
      className={`${ROW} cursor-pointer data-hovered:bg-inner`}
    >
      <RowText row={row} />
      {row.days === null ? null : <Dots days={row.days} />}
    </AriaButton>
  )
}

/** The same row while choosing: a check circle at its start, and the row itself is the checkbox. */
function ChoiceRow({ row, chosen, onChange }: { readonly row: PeopleRow; readonly chosen: boolean; readonly onChange: (chosen: boolean) => void }) {
  return (
    <Checkbox isSelected={chosen} onChange={onChange} aria-label={fullName(row.soldier)} className={`${ROW} cursor-pointer data-selected:bg-action-soft`}>
      <span
        aria-hidden
        className={`flex size-badge shrink-0 items-center justify-center rounded-full border ${chosen ? 'border-action-solid bg-action-solid text-on-action' : 'border-text-muted'}`}
      >
        {chosen ? <Check size={14} /> : null}
      </span>
      <RowText row={row} />
      {row.days === null ? null : <Dots days={row.days} />}
    </Checkbox>
  )
}

interface Section {
  readonly key: string
  readonly heading: PeopleItem | null
  readonly rows: readonly PeopleRow[]
}

/** The rows under their headers: one white card per group, or one for the whole list. */
function sectionsOf(items: readonly PeopleItem[]): Section[] {
  const sections: { key: string; heading: PeopleItem | null; rows: PeopleRow[] }[] = []
  for (const item of items) {
    if (item.kind === 'group') sections.push({ key: item.key, heading: item, rows: [] })
    else {
      const last = sections.at(-1)
      if (last === undefined) sections.push({ key: 'all', heading: null, rows: [item] })
      else last.rows.push(item)
    }
  }
  return sections
}

function groupKeyOf(grouping: BoardGrouping): string {
  return 'key' in grouping ? grouping.key : `${CATEGORY}${grouping.category}`
}

function useOptionRows(view: PeopleViewState, list: PeopleList | null): OptionRow[] {
  const sort: OptionRow = {
    key: 'sort',
    labelKey: 'manage.people.sort',
    value: t(view.sort === 'name' ? 'manage.people.sortName' : 'manage.people.sortRank'),
    changed: view.sort !== 'rank',
    choices: {
      selected: view.sort,
      options: [
        { key: 'rank', label: t('manage.people.sortRank') },
        { key: 'name', label: t('manage.people.sortName') },
      ],
      onChange: (key) => {
        view.setSort(key === 'name' ? 'name' : 'rank')
      },
    },
  }
  const groupings: readonly { readonly grouping: BoardGrouping; readonly label: string }[] = [
    { grouping: NO_GROUPING, label: t('workspace.groupKeys.none') },
    { grouping: UNIT_GROUPING, label: t('workspace.groupKeys.unit') },
    { grouping: { key: 'rank' }, label: t('workspace.groupKeys.rank') },
    ...(list?.categories ?? []).map((category) => ({ grouping: { category: category.id }, label: category.name })),
  ]
  const applied = list?.grouping ?? null
  const group: OptionRow = {
    key: 'group',
    labelKey: 'manage.people.group',
    value: groupings.find((choice) => applied !== null && groupKeyOf(choice.grouping) === groupKeyOf(applied))?.label ?? '',
    changed: applied !== null && list !== null && groupKeyOf(applied) !== groupKeyOf(list.defaultGrouping),
    choices: {
      selected: applied === null ? null : groupKeyOf(applied),
      options: groupings.map((choice) => ({ key: groupKeyOf(choice.grouping), label: choice.label })),
      onChange: (key) => {
        const choice = groupings.find((candidate) => groupKeyOf(candidate.grouping) === key)
        if (choice !== undefined) view.setGroup(choice.grouping)
      },
    },
  }
  const shownHidden = (shown: boolean) => t(shown ? 'manage.people.shown' : 'manage.people.hidden')
  const inactive: OptionRow = {
    key: 'inactive',
    labelKey: 'manage.people.inactive',
    value: shownHidden(view.inactive),
    changed: view.inactive,
    choices: {
      selected: view.inactive ? 'shown' : 'hidden',
      options: [
        { key: 'hidden', label: shownHidden(false) },
        { key: 'shown', label: shownHidden(true) },
      ],
      onChange: (key) => {
        view.setInactive(key === 'shown')
      },
    },
  }
  const days: OptionRow = {
    key: 'days',
    labelKey: 'manage.people.days',
    value: shownHidden(view.days),
    changed: !view.days,
    choices: {
      selected: view.days ? 'shown' : 'hidden',
      options: [
        { key: 'shown', label: shownHidden(true) },
        { key: 'hidden', label: shownHidden(false) },
      ],
      onChange: (key) => {
        view.setDays(key === 'shown')
      },
    },
  }
  return [sort, group, inactive, days]
}

/** How many archived soldiers the actor may bring back (D-371): the archive's door counts them. */
function useArchivedCount(): number {
  const withArchived = useSoldiersWithArchived()
  const units = useUnits()
  const archived = useMemo(() => (withArchived.status === 'ready' ? archivedRows(withArchived.value) : NO_SOLDIERS), [withArchived])
  const permissions = useRosterPermissions(archived, units.status === 'ready' ? units.value : NO_UNITS)
  return archived.filter((soldier) => permissions.archive(soldier)).length
}

const NO_SOLDIERS: readonly Soldier[] = []
const NO_UNITS: readonly never[] = []

export function SoldiersPage({ name }: { readonly name: string }) {
  const place = useShellPlace()
  const panel = usePanel()
  const today = useToday()
  const view = usePeopleView()
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [chosen, setChosen] = useState<ReadonlySet<SoldierId>>(new Set())
  const [moving, setMoving] = useState(false)
  const list = usePeopleList(view, query)
  const soldiers = useSoldiers()
  const units = useUnits()
  const seen = soldiers.status === 'ready' ? soldiers.value : NO_SOLDIERS
  const liveUnits = units.status === 'ready' ? units.value : NO_UNITS
  const roster = useRosterPermissions(NO_SOLDIERS, liveUnits)
  const creation = useLeaveCreation(seen)
  const moves = useMovePermissions(seen, liveUnits)
  const archived = useArchivedCount()
  const rows = useOptionRows(view, list.status === 'ready' ? list.value : null)

  const choose = (soldierId: SoldierId, on: boolean) => {
    setChosen((current) => {
      const next = new Set(current)
      if (on) next.add(soldierId)
      else next.delete(soldierId)
      return next
    })
  }
  const stopChoosing = () => {
    setSelecting(false)
    setChosen(new Set())
  }
  const footer: OptionAction[] = [
    {
      key: 'select',
      label: t('manage.people.select'),
      onPress: () => {
        setSelecting(true)
      },
    },
    ...(archived > 0
      ? [
          {
            key: 'archive',
            label: [t('manage.people.archive'), String(archived)].join(SEPARATOR),
            onPress: () => {
              panel.open(PANEL_IDS.soldiers, { entity: ARCHIVE_ENTITY })
            },
          },
        ]
      : []),
  ]
  const ids = [...chosen]
  const creatable = new Set(creation.soldiers.map((soldier) => soldier.id))
  const actions: TrayAction[] = [
    ...(ids.length > 0 && today !== null && ids.every((id) => creatable.has(id))
      ? [
          {
            key: 'leave',
            label: t('manage.people.leave'),
            onPress: () => {
              const [only] = ids
              const days = { start_date: today, end_date: today }
              panel.open(PANEL_IDS.leaves, {
                entity: 'new',
                draft: ids.length === 1 && only !== undefined ? { ...days, soldier_id: only } : { ...days, soldier_ids: ids },
              })
              stopChoosing()
            },
          },
        ]
      : []),
    ...(ids.length > 0 && ids.every(moves.moves) && liveUnits.some((unit) => moves.moveTo(unit.id))
      ? [
          {
            key: 'move',
            label: t('manage.people.move'),
            onPress: () => {
              setMoving(true)
            },
          },
        ]
      : []),
  ]
  const tray = selecting ? (
    <SelectionTray
      labelKey="manage.people.selectionLabel"
      count={[String(ids.length), t('manage.people.selected')].join(WORD)}
      actions={actions}
      clearKey="manage.people.clearSelection"
      onClear={stopChoosing}
    />
  ) : null
  const count = list.status === 'ready' ? list.value.count : null

  return (
    <PageFrame tray={tray}>
      <PageTop
        titleKey="manage.pages.soldiers"
        detail={count === null ? name : [name, [String(count), t('manage.people.count')].join(WORD)].join(SEPARATOR)}
        tools={
          <>
            <CapsuleButton
              labelKey="manage.people.search"
              pressed={searching}
              onPress={() => {
                if (searching) setQuery('')
                setSearching(!searching)
              }}
            >
              <Search aria-hidden size={20} />
            </CapsuleButton>
            <OptionsMenu labelKey="manage.people.options" icon={<SlidersHorizontal aria-hidden size={20} />} rows={rows} footer={footer} />
            {roster.create ? (
              <CapsuleButton
                labelKey="manage.pages.addSoldiers"
                onPress={() => {
                  place.openPage('add_soldiers')
                }}
              >
                <UserPlus aria-hidden size={20} />
              </CapsuleButton>
            ) : null}
          </>
        }
      />
      {searching ? (
        // The field takes the keyboard as it opens: the search is what the press asked for.
        <TextField labelKey="manage.people.searchLabel" name="search" value={query} onChange={setQuery} error={null} autoFocus />
      ) : null}
      {list.status === 'failed' ? (
        <FailureNotice error={list.error} />
      ) : list.status === 'loading' ? (
        <LoadingNotice />
      ) : list.value.count === 0 ? (
        query === '' ? (
          <EmptyNotice titleKey="manage.people.emptyTitle" bodyKey={roster.create ? 'manage.people.emptyBody' : 'soldiers.emptyReadOnly'} headingLevel={2} />
        ) : (
          <p role="status" className="py-lg text-center text-body text-text-muted">
            {t('manage.people.noResults')}
          </p>
        )
      ) : (
        <div aria-label={t('manage.people.listLabel')} role="region" className="flex flex-col gap-lg">
          {sectionsOf(list.value.items).map((section) => (
            <section key={section.key} className="flex flex-col gap-xs">
              {section.heading?.kind === 'group' ? (
                <h2 className="flex items-center justify-between gap-sm px-xs text-body font-bold">
                  <span className="min-w-none truncate">{headingLabel(section.heading.label)}</span>
                  <span className="shrink-0 text-small font-normal text-text-muted tabular-nums">{section.heading.size}</span>
                </h2>
              ) : null}
              <ul className="flex flex-col overflow-hidden rounded-card bg-surface">
                {section.rows.map((row) => (
                  <li key={row.key} className="border-b border-divider-strong last:border-b-0">
                    {selecting ? (
                      <ChoiceRow
                        row={row}
                        chosen={chosen.has(row.soldier.id)}
                        onChange={(on) => {
                          choose(row.soldier.id, on)
                        }}
                      />
                    ) : (
                      <PersonButton
                        row={row}
                        onHold={() => {
                          setSelecting(true)
                          setChosen(new Set([row.soldier.id]))
                        }}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {moving ? (
        <MoveDialog
          soldierIds={ids}
          onClose={(done) => {
            setMoving(false)
            if (done) stopChoosing()
          }}
        />
      ) : null}
    </PageFrame>
  )
}
