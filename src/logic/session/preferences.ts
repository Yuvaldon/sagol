import {
  RulesRowPlacement,
  SoldierPreferences,
  type NavigationModule,
  type Result,
  type SoldierPreferencesRecord,
} from '@contracts'
import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { loaded, type Loaded } from '../queries/loaded'
import { unwrap } from '../queries/results'
import { usePorts } from '../runtime/context'

// The signed-in soldier's own preferences (D-041, D-121). No row means the defaults, which the contract fills in.

interface MyPreferences {
  readonly preferences: SoldierPreferences
  /** NULL until the first save creates the row. */
  readonly version: number | null
}

function useMyPreferenceRecord(): Loaded<MyPreferences> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: QUERY_KEYS.soldierPreferences,
      queryFn: async (): Promise<MyPreferences> => {
        const record = await unwrap(data.repositories.soldier_preferences.mine())
        return { preferences: record?.preferences ?? SoldierPreferences.parse({}), version: record?.version ?? null }
      },
    }),
  )
}

export function useMyPreferences(): Loaded<SoldierPreferences> {
  const record = useMyPreferenceRecord()
  return record.status === 'ready' ? { status: 'ready', value: record.value.preferences } : record
}

/** Saves a change over what is stored, at the stored version; a save that missed a change answers `stale_version`. */
export function useUpdateMyPreferences() {
  const { data } = usePorts()
  const record = useMyPreferenceRecord()
  const stored = record.status === 'ready' ? record.value : null
  return useCommand([QUERY_KEYS.soldierPreferences], (changes: Partial<SoldierPreferences>): Promise<Result<SoldierPreferencesRecord>> => {
    if (stored === null) return Promise.resolve({ ok: false, error: { code: 'unavailable' } })
    return data.commands.accounts.updateMyPreferences({
      expected_version: stored.version,
      preferences: { ...stored.preferences, ...changes },
    })
  })
}

export interface NavigationPreferences {
  /** What the soldier pinned to the bar, in the order pinned; empty until the preferences load. */
  readonly pinned: readonly NavigationModule[]
  readonly rulesRow: RulesRowPlacement
  /** FALSE while the preferences cannot be read, so nothing offers a change that cannot be saved (D-076, D-121). */
  readonly editable: boolean
  togglePin(module: NavigationModule): void
  setRulesRow(placement: RulesRowPlacement): void
}

const NO_PINS: readonly NavigationModule[] = []

/** The bar's pins and the heat row's place (D-173), kept in the soldier's own preferences so every device has them. */
export function useNavigationPreferences(): NavigationPreferences {
  const preferences = useMyPreferences()
  const save = useUpdateMyPreferences()
  const value = preferences.status === 'ready' ? preferences.value : null
  const pinned = value?.pinned_modules ?? NO_PINS
  return {
    pinned,
    rulesRow: value?.rules_row_placement ?? RulesRowPlacement.enum.below,
    editable: value !== null,
    togglePin(module) {
      const next = pinned.includes(module) ? pinned.filter((one) => one !== module) : [...pinned, module]
      void save.run({ pinned_modules: next })
    },
    setRulesRow(placement) {
      void save.run({ rules_row_placement: placement })
    },
  }
}
