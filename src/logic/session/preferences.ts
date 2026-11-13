import {
  Appearance,
  SoldierPreferences,
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

/** One save at a time per client: each one reads what the previous one stored, so quick presses do not collide. */
const saving = new WeakMap<QueryClient, Promise<unknown>>()

/** A change, or a change worked out from the row as stored when its turn comes, so it never undoes an earlier save. */
export type PreferenceChange = Partial<SoldierPreferences> | ((stored: SoldierPreferences) => Partial<SoldierPreferences>)

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
      } else {
        // The screen shows the row as stored again, and the soldier chooses over it (D-187).
        await client.invalidateQueries({ queryKey: QUERY_KEYS.soldierPreferences })
      }
      return result
    }
    const next = (saving.get(client) ?? Promise.resolve()).then(save, save)
    saving.set(client, next.catch(() => undefined))
    return next
  })
}

/** A preference save's answer: a failure is shown, never dropped (D-187). */
export type PreferenceSaved = Result<SoldierPreferencesRecord>

export interface AppearancePreference {
  /** Light until the preferences are read: a soldier who chose dark sees light first, never dark and back (D-181). */
  readonly appearance: Appearance
  /** FALSE while the preferences cannot be read, so the choice is not offered (D-076). */
  readonly editable: boolean
  setAppearance(appearance: Appearance): Promise<PreferenceSaved>
}

/** The soldier's color scheme (D-181), kept in their own preferences so every device has it. */
export function useAppearance(): AppearancePreference {
  const preferences = useMyPreferences()
  const save = useUpdateMyPreferences()
  const value = preferences.status === 'ready' ? preferences.value : null
  return {
    appearance: value?.appearance ?? Appearance.enum.light,
    editable: value !== null,
    setAppearance(appearance) {
      return save.run({ appearance })
    },
  }
}
