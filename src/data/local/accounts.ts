import { UpdateMyPreferencesInput, type DataCommands, type DataRepositories, type TableName } from '@contracts'
import { tableOf } from './database'
import type { LocalDependencies } from './dependencies'
import { asResult, fail, parseInput, parsedRow } from './failure'
import { requireLinked, resolveSession } from './session'

// The signed-in soldier's own preferences (D-041, D-121). The row is the actor's own, so reading and writing it
// need only a linked session, and the soldier is never an input (D-008).

const PREFERENCE_TABLES: readonly TableName[] = ['soldier_accounts', 'soldier_preferences']

export function createSoldierPreferencesRepository({
  database,
  identity,
}: LocalDependencies): DataRepositories['soldier_preferences'] {
  return {
    mine: () =>
      asResult(() =>
        database.transaction('r', PREFERENCE_TABLES, async () => {
          const actor = requireLinked(await resolveSession(database, identity.current()))
          const stored = await tableOf(database, 'soldier_preferences').get(actor.soldier_id)
          return stored === undefined ? null : parsedRow('soldier_preferences', stored)
        }),
      ),
  }
}

/** What the local adapter builds of `commands.accounts` so far. Linking lands in V9 (D-076). */
export type LocalAccountCommands = Pick<DataCommands['accounts'], 'updateMyPreferences'>

export function createAccountCommands({ database, identity, time, changes }: LocalDependencies): LocalAccountCommands {
  return {
    updateMyPreferences: (raw) =>
      asResult(async () => {
        const input = parseInput(UpdateMyPreferencesInput, raw)
        const written = await database.transaction('rw', PREFERENCE_TABLES, async () => {
          const actor = requireLinked(await resolveSession(database, identity.current()))
          const stored = await tableOf(database, 'soldier_preferences').get(actor.soldier_id)
          // NULL creates the row; a number must be the stored version (D-121).
          if ((stored?.version ?? null) !== input.expected_version) return fail({ code: 'stale_version' })
          const row = parsedRow('soldier_preferences', {
            soldier_id: actor.soldier_id,
            organization_id: actor.organization_id,
            preferences: input.preferences,
            updated_at: time.now(),
            version: (stored?.version ?? 0) + 1,
          })
          await tableOf(database, 'soldier_preferences').put(row)
          return row
        })
        changes.publish([{ table: 'soldier_preferences', ids: [written.soldier_id] }])
        return written
      }),
  }
}
