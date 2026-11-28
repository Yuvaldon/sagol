import { ARCHIVE_ENTITY, PANEL_IDS } from '@config'
import type { Soldier, SoldierId } from '@contracts'
import { t } from '@i18n'
import {
  NO_GROUPING,
  UNIT_GROUPING,
  archivedRows,
  useLeaveCreation,
  useMovePermissions,
  useTagSetters,
  useOverlayLayer,
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
  type PeopleList,
  type PeopleViewState,
} from '@logic'
import { Search, SlidersHorizontal, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { OptionsMenu, type OptionAction, type OptionRow } from '../../kit/OptionsMenu'
import { SelectionTray, type TrayAction } from '../../kit/Tray'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { TextField } from '../../primitives/fields'
import { useIsDesktop } from '../../patterns/media'
import { PageFrame } from '../PageFrame'
import { CapsuleButton } from './CapsuleButton'
import { MoveDialog } from './MoveDialog'
import { TagsDialog } from './TagsDialog'
import { PageTop } from './PageTop'
import { PeopleRows } from './PeopleRows'

// "חיילים" (the handoff's Manage → Soldiers, D-482): every soldier the actor sees, regardless of presence, as thin person
// rows with their rank and tags and their next seven days, a table on a wide screen (D-491). The capsule holds the search, the options (sort, grouping,
// the inactive, the days; "בחירה" and the archive after the divider) and "הוספת חיילים". A row opens the person card;
// holding it, or "בחירה", starts a multi-select whose tray offers what every chosen soldier allows.

const SEPARATOR = ' · '
const WORD = ' '
const CATEGORY = 'category:'

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
  const desktop = useIsDesktop()
  const view = usePeopleView()
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [chosen, setChosen] = useState<ReadonlySet<SoldierId>>(new Set())
  const [moving, setMoving] = useState(false)
  const [tagging, setTagging] = useState(false)
  const list = usePeopleList(view, query)
  const soldiers = useSoldiers()
  const units = useUnits()
  const seen = soldiers.status === 'ready' ? soldiers.value : NO_SOLDIERS
  const liveUnits = units.status === 'ready' ? units.value : NO_UNITS
  const roster = useRosterPermissions(NO_SOLDIERS, liveUnits)
  const creation = useLeaveCreation(seen)
  const moves = useMovePermissions(seen, liveUnits)
  const tagsOf = useTagSetters(seen)
  const archived = useArchivedCount()
  const rows = useOptionRows(view, list.status === 'ready' ? list.value : null)
  // Choosing is a layer over the page: the back button ends it, as it closes a drawer (D-332, D-483).
  useOverlayLayer(selecting, () => {
    setSelecting(false)
    setChosen(new Set())
  })

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
  // What the search hides is let go: the tray acts only on rows in sight, and counts only them.
  const inSight = new Set(list.status === 'ready' ? list.value.items.flatMap((item) => (item.kind === 'soldier' ? [item.soldier.id] : [])) : [])
  const ids = [...chosen].filter((id) => inSight.has(id))
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
    // Tagging several: for who may update every chosen soldier, each saved by their own command (OI-400).
    ...(ids.length > 0 && ids.every(tagsOf)
      ? [
          {
            key: 'tags',
            label: t('manage.people.tags'),
            onPress: () => {
              setTagging(true)
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
    <PageFrame tray={tray} wide>
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
        <PeopleRows
          items={list.value.items}
          days={view.days}
          wide={desktop}
          choosing={{
            on: selecting,
            chosen,
            choose,
            startWith: (soldierId) => {
              setSelecting(true)
              setChosen(new Set([soldierId]))
            },
          }}
        />
      )}
      {tagging ? (
        <TagsDialog
          soldierIds={ids}
          onClose={(refused) => {
            setTagging(false)
            if (refused === null) return
            if (refused.length === 0) stopChoosing()
            else setChosen(new Set(refused))
          }}
        />
      ) : null}
      {moving ? (
        <MoveDialog
          soldierIds={ids}
          onClose={(refused) => {
            setMoving(false)
            // The refused stay chosen, so the step can be taken again for them; with none, the choosing is over.
            if (refused === null) return
            if (refused.length === 0) stopChoosing()
            else setChosen(new Set(refused))
          }}
        />
      ) : null}
    </PageFrame>
  )
}
