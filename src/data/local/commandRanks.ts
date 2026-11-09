import {
  ArchiveCommandRankInput,
  CommandRank,
  CreateCommandRankInput,
  UpdateCommandRankInput,
  type DataCommands,
  type DataRepositories,
} from '@contracts'
import { archiveRankIssues } from '@domain'
import { colorKeyIssues } from './checks'
import { tableOf } from './database'
import type { LocalDependencies } from './dependencies'
import { createReferenceCommands, createReferenceRepository, type ReferenceSpec } from './reference'

// `command_ranks`: organization data, ordered by `seniority` (D-002, D-095). There is no reorder: the
// number is the order.

const SPEC: ReferenceSpec<CommandRank> = {
  table: 'command_ranks',
  resource: 'command_ranks',
  schema: CommandRank,
  checkTables: [],
  optionalText: ['short_title'],
  targetOf: () => ({ kind: 'organization' }),
  rowIssues: ({ before, row }) => Promise.resolve(colorKeyIssues(before?.color_key, row.color_key)),
}

/** Most senior first. Equal seniority falls back to the id, so the order is stable. */
function bySeniority(a: CommandRank, b: CommandRank): number {
  return b.seniority - a.seniority || a.id.localeCompare(b.id)
}

export function createCommandRankRepository(dependencies: LocalDependencies): DataRepositories['command_ranks'] {
  return createReferenceRepository(dependencies, SPEC, bySeniority)
}

export function createCommandRankCommands(dependencies: LocalDependencies): DataCommands['command_ranks'] {
  return createReferenceCommands(dependencies, SPEC, {
    create: CreateCommandRankInput,
    update: UpdateCommandRankInput,
    archive: ArchiveCommandRankInput,
    placementOf: () => ({ kind: 'organization' }),
    archiveIssues: async (database, scope, rank) => {
      const soldiers = await tableOf(database, 'soldiers').where('organization_id').equals(scope.organization_id).toArray()
      return archiveRankIssues(soldiers, rank.id)
    },
  })
}
