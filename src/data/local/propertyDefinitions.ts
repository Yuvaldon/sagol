import {
  ArchivePropertyDefinitionInput,
  CreatePropertyDefinitionInput,
  PropertyDefinition,
  ReorderPropertyDefinitionsInput,
  UpdatePropertyDefinitionInput,
  type DataCommands,
  type DataRepositories,
} from '@contracts'
import { propertyDefinitionIssues } from '@domain'
import {
  bySortOrder,
  createReferenceCommands,
  createReferenceRepository,
  createReorderCommand,
  type ReferenceSpec,
} from './reference'
import type { LocalDependencies } from './dependencies'

// Custom property definitions (D-016, D-065): organization data, governed by the `properties` resource. Their entity
// and data types are fixed at creation; options are checked on every write (OI-073).

const ORGANIZATION = { kind: 'organization' } as const

const SPEC: ReferenceSpec<PropertyDefinition> = {
  table: 'property_definitions',
  resource: 'properties',
  schema: PropertyDefinition,
  checkTables: [],
  optionalText: [],
  targetOf: () => ORGANIZATION,
  rowIssues: ({ row }) => Promise.resolve(propertyDefinitionIssues(row)),
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
  }
}
