import type { JsonValue, PropertyDefinition, PropertyEntityType } from '@contracts'
import {
  definitionsOf,
  propertyFormValues,
  toStoredProperties,
  usePropertyDefinitions,
  type PropertyFieldValue,
  type PropertyFormValues,
  type WithProperties,
} from '@logic'
import { useState } from 'react'

// The custom property fields of one entity's form (D-016). Their values live beside the form's own, since the form's
// values are typed path by path and a property's are not.

const NONE: Readonly<Record<string, JsonValue>> = {}

export interface PropertyFields {
  /** The live definitions of the entity type, in order; none while they load. */
  readonly definitions: readonly PropertyDefinition[]
  readonly values: PropertyFormValues
  readonly set: (id: string, value: PropertyFieldValue) => void
  /** What a command takes: the values to store, or nothing while the definitions load, which keeps the stored ones. */
  readonly withProperties: WithProperties
  /** The field names that answers land on (`properties.<id>`). */
  readonly fieldNames: readonly string[]
}

export function propertyFieldName(definition: Pick<PropertyDefinition, 'id'>): string {
  return `properties.${definition.id}`
}

export function usePropertyFields(entityType: PropertyEntityType, stored: Readonly<Record<string, JsonValue>> = NONE): PropertyFields {
  const all = usePropertyDefinitions()
  const [edited, setEdited] = useState<PropertyFormValues>({})
  const definitions = all.status === 'ready' ? definitionsOf(all.value, entityType) : []
  const values = { ...propertyFormValues(definitions, stored), ...edited }
  return {
    definitions,
    values,
    set: (id, value) => {
      setEdited((current) => ({ ...current, [id]: value }))
    },
    withProperties: all.status === 'ready' ? { properties: toStoredProperties(definitions, stored, values) } : {},
    fieldNames: definitions.map(propertyFieldName),
  }
}
