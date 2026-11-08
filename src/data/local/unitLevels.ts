import {
  ArchiveUnitLevelInput,
  CreateUnitLevelInput,
  ReorderUnitLevelsInput,
  UpdateUnitLevelInput,
  UnitLevel,
  type DataCommands,
  type DataRepositories,
} from '@contracts'
import type { LocalDependencies } from './dependencies'
import {
  createReferenceCommands,
  createReferenceRepository,
  createReorderCommand,
  type ReferenceSpec,
} from './reference'

// `unit_levels`: organization data, with no references of its own (D-053, D-089). Archiving a level
// that units use is allowed, because archived rows stay referenceable (D-017, D-088).

const SPEC: ReferenceSpec<UnitLevel> = {
  table: 'unit_levels',
  resource: 'unit_levels',
  schema: UnitLevel,
  checkTables: [],
  targetOf: () => ({ kind: 'organization' }),
  rowIssues: () => Promise.resolve([]),
}

export function createUnitLevelRepository(dependencies: LocalDependencies): DataRepositories['unit_levels'] {
  return createReferenceRepository(dependencies, SPEC)
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
  }
}
