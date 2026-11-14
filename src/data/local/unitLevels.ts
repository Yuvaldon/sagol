import {
  ArchiveUnitLevelInput,
  CreateUnitLevelInput,
  ReorderUnitLevelsInput,
  RestoreUnitLevelInput,
  UpdateUnitLevelInput,
  UnitLevel,
  type DataCommands,
  type DataRepositories,
} from '@contracts'
import type { LocalDependencies } from './dependencies'
import {
  bySortOrder,
  createReferenceCommands,
  createReferenceRepository,
  createReorderCommand,
  createRestoreCommand,
  noRestoreIssues,
  type ReferenceSpec,
} from './reference'

// `unit_levels`: organization data, with no references of its own (D-053, D-089). Archiving a level
// that units use is allowed, because archived rows stay referenceable (D-017, D-088).

const SPEC: ReferenceSpec<UnitLevel> = {
  table: 'unit_levels',
  resource: 'unit_levels',
  schema: UnitLevel,
  checkTables: [],
  optionalText: [],
  targetOf: () => ({ kind: 'organization' }),
  rowIssues: () => Promise.resolve([]),
}

export function createUnitLevelRepository(dependencies: LocalDependencies): DataRepositories['unit_levels'] {
  return createReferenceRepository(dependencies, SPEC, bySortOrder)
}

export function createUnitLevelCommands(dependencies: LocalDependencies): DataCommands['unit_levels'] {
  return {
    ...createReferenceCommands(dependencies, SPEC, {
      create: CreateUnitLevelInput,
      update: UpdateUnitLevelInput,
      archive: ArchiveUnitLevelInput,
      placementOf: () => ({ kind: 'organization' }),
    }),
    reorder: createReorderCommand(dependencies, SPEC, ReorderUnitLevelsInput, () => null),
    restore: createRestoreCommand(dependencies, SPEC, { input: RestoreUnitLevelInput, restoreIssues: noRestoreIssues }),
  }
}
