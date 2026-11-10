import { SoldierPreferences, type Result, type SoldierPreferencesRecord } from '@contracts'
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
