import {
  ArchivePropertyDefinitionInput,
  CreatePropertyDefinitionInput,
  PropertyDefinition,
  ReorderPropertyDefinitionsInput,
  RestorePropertyDefinitionInput,
  UpdatePropertyDefinitionInput,
  type DataCommands,
  type DataRepositories,
  type Permission,
  type PropertyEntityType,
} from '@contracts'
import { missingPermissions, propertyDefinitionIssues } from '@domain'
import type { ActorScope } from './actor'
import {
  bySortOrder,
  createReferenceCommands,
  createReferenceRepository,
  createReorderCommand,
  createRestoreCommand,
  noRestoreIssues,
  type ReferenceSpec,
} from './reference'
import type { LocalDependencies } from './dependencies'

// Custom property definitions (D-016, D-065): organization data, governed by the `properties` resource. Their entity
// and data types are fixed at creation; options are checked on every write (OI-073).

const ORGANIZATION = { kind: 'organization' } as const

/** Creating or changing the entity a definition describes. */
const WRITES_OF: Record<PropertyEntityType, readonly Permission[]> = {
  soldier: [
    { resource: 'soldiers', action: 'create' },
    { resource: 'soldiers', action: 'update' },
  ],
  unit: [
    { resource: 'units', action: 'create' },
    { resource: 'units', action: 'update' },
  ],
  leave: [
    { resource: 'leaves', action: 'create' },
    { resource: 'leaves', action: 'update' },
  ],
}

/**
 * Who creates or changes an entity on any target reads that entity type's definitions, live and archived, so its form
 * shows every required field (D-186). The `properties` module stays for `properties:*` holders.
 */
function writesEntityOf(scope: ActorScope, row: PropertyDefinition): boolean {
  return WRITES_OF[row.entity_type].some(
    (permission) => missingPermissions(scope.context, scope.soldier_id, [permission]).length === 0,
  )
}

const SPEC: ReferenceSpec<PropertyDefinition> = {
  table: 'property_definitions',
  resource: 'properties',
  schema: PropertyDefinition,
  checkTables: [],
  optionalText: [],
  targetOf: () => ORGANIZATION,
  rowIssues: ({ row }) => Promise.resolve(propertyDefinitionIssues(row)),
  alsoReadableBy: (_database, scope) => Promise.resolve((row) => writesEntityOf(scope, row)),
}

/** By `sort_order` inside an entity type. */
export function createPropertyDefinitionRepository(dependencies: LocalDependencies): DataRepositories['property_definitions'] {
  return createReferenceRepository(dependencies, SPEC, bySortOrder)
}

export function createPropertyDefinitionCommands(dependencies: LocalDependencies): DataCommands['property_definitions'] {
  return {
    ...createReferenceCommands(dependencies, SPEC, {
      create: CreatePropertyDefinitionInput,
      update: UpdatePropertyDefinitionInput,
      archive: ArchivePropertyDefinitionInput,
      placementOf: () => ORGANIZATION,
    }),
    // Each entity type has its own order: a soldier's properties are never placed among a leave's.
    reorder: createReorderCommand(dependencies, SPEC, ReorderPropertyDefinitionsInput, (row) => row.entity_type),
    restore: createRestoreCommand(dependencies, SPEC, { input: RestorePropertyDefinitionInput, restoreIssues: noRestoreIssues }),
  }
}
