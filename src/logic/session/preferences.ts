import {
  RulesRowPlacement,
  SoldierPreferences,
  type NavigationModule,
  type Result,
  type SoldierPreferencesRecord,
} from '@contracts'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
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

type PreferenceChange = Partial<SoldierPreferences> | ((current: SoldierPreferences) => Partial<SoldierPreferences>)

/** One save at a time per client: each one reads what the previous one stored, so quick presses do not collide. */
const saving = new WeakMap<QueryClient, Promise<unknown>>()

/**
 * Saves a change over what is stored, at the stored version. Saves run in turn, each over the latest stored row, so a
 * change made while another is saving builds on it; a save that missed a change elsewhere answers `stale_version`.
 */
export function useUpdateMyPreferences() {
  const { data } = usePorts()
  const client = useQueryClient()
  return useCommand([QUERY_KEYS.soldierPreferences], (change: PreferenceChange): Promise<Result<SoldierPreferencesRecord>> => {
    const save = async (): Promise<Result<SoldierPreferencesRecord>> => {
      const stored = client.getQueryData<MyPreferences>(QUERY_KEYS.soldierPreferences)
      if (stored === undefined) return { ok: false, error: { code: 'unavailable' } }
      const changes = typeof change === 'function' ? change(stored.preferences) : change
      const result = await data.commands.accounts.updateMyPreferences({
        expected_version: stored.version,
        preferences: { ...stored.preferences, ...changes },
      })
      if (result.ok) {
        client.setQueryData<MyPreferences>(QUERY_KEYS.soldierPreferences, {
          preferences: result.value.preferences,
          version: result.value.version,
        })
      }
      return result
    }
    const next = (saving.get(client) ?? Promise.resolve()).then(save, save)
    saving.set(client, next.catch(() => undefined))
    return next
  })
}

export interface NavigationPreferences {
  /** What the soldier pinned to the bar, in the order pinned; empty until the preferences load. */
  readonly pinned: readonly NavigationModule[]
  readonly rulesRow: RulesRowPlacement
  /** FALSE while the preferences cannot be read, so nothing offers a change that cannot be saved (D-076, D-121). */
  readonly editable: boolean
  /** FALSE until the preferences are read or have failed, so nothing is placed by a default and then moved. */
  readonly settled: boolean
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
    settled: preferences.status !== 'loading',
    togglePin(module) {
      void save.run((current) => ({
        pinned_modules: current.pinned_modules.includes(module)
          ? current.pinned_modules.filter((one) => one !== module)
          : [...current.pinned_modules, module],
      }))
    },
    setRulesRow(placement) {
      void save.run({ rules_row_placement: placement })
    },
  }
}
