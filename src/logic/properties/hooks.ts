import type { PermissionCheck, PropertyDefinition, Result } from '@contracts'
import { useQuery } from '@tanstack/react-query'
import { steppedItems } from '../forms/order'
import { useCan } from '../permissions/hooks'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { loaded, type Loaded } from '../queries/loaded'
import { unwrap } from '../queries/results'
import { usePorts } from '../runtime/context'
import {
  definitionsOf,
  toCreatePropertyDefinitionInput,
  toUpdatePropertyDefinitionInput,
  type PropertyDefinitionFormValues,
} from './properties'

// Reading and changing property definitions (D-016). Values are written by the commands of their entity.

const WITH_ARCHIVED = { include_archived: true }

/** Every definition, archived ones too: a filter or a stored value keeps its label. */
export function usePropertyDefinitions(): Loaded<readonly PropertyDefinition[]> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.propertyDefinitions, WITH_ARCHIVED],
      queryFn: () => unwrap(data.repositories.property_definitions.list(WITH_ARCHIVED)),
    }),
  )
}

export function usePropertyDefinitionCommands() {
  const { data } = usePorts()
  const definitions = data.commands.property_definitions
  const keys = [QUERY_KEYS.propertyDefinitions]

  const create = useCommand(
    keys,
    ({ values, all }: { values: PropertyDefinitionFormValues; all: readonly PropertyDefinition[] }) =>
      definitions.create(toCreatePropertyDefinitionInput(values, all)),
  )
  const update = useCommand(
    keys,
    async ({
      definition,
      openedVersion,
      values,
    }: {
      definition: PropertyDefinition
      openedVersion: number
      values: PropertyDefinitionFormValues
    }) => {
      const input = toUpdatePropertyDefinitionInput(definition, openedVersion, values)
      const unchanged: Result<PropertyDefinition> = { ok: true, value: definition }
      return input === null ? unchanged : definitions.update(input)
    },
  )
  const archive = useCommand(keys, (definition: PropertyDefinition) =>
    definitions.archive({ id: definition.id, expected_version: definition.version }),
  )
  /** Up or down among the definitions of its entity type. */
  const step = useCommand(
    keys,
    async ({ definition, direction, all }: { definition: PropertyDefinition; direction: -1 | 1; all: readonly PropertyDefinition[] }) => {
      const items = steppedItems(definitionsOf(all, definition.entity_type), definition, direction)
      const unchanged: Result<PropertyDefinition[]> = { ok: true, value: [] }
      return items === null ? unchanged : definitions.reorder({ items })
    },
  )
  return { create, update, archive, step }
}

// ---------------------------------------------------------------------- hints

const PROPERTY_CHECKS = {
  create: { permission: { resource: 'properties', action: 'create' }, target: { kind: 'organization' } },
  update: { permission: { resource: 'properties', action: 'update' }, target: { kind: 'organization' } },
  archive: { permission: { resource: 'properties', action: 'delete' }, target: { kind: 'organization' } },
} as const satisfies Record<string, PermissionCheck>

const PROPERTY_CHECK_LIST: readonly PermissionCheck[] = Object.values(PROPERTY_CHECKS)

/** Definitions are the `properties` resource at organization scope (D-053). */
export function usePropertyPermissions() {
  const can = useCan(PROPERTY_CHECK_LIST)
  return {
    create: can(PROPERTY_CHECKS.create),
    update: can(PROPERTY_CHECKS.update),
    archive: can(PROPERTY_CHECKS.archive),
  }
}
