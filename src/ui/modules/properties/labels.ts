import type { PropertyDataType, PropertyEntityType } from '@contracts'
import type { I18nKey } from '@i18n'

// The names of a property's vocabularies on screen (D-016).

export const ENTITY_TYPE_KEYS: Record<PropertyEntityType, I18nKey> = {
  soldier: 'properties.entityTypes.soldier',
  unit: 'properties.entityTypes.unit',
  leave: 'properties.entityTypes.leave',
}

export const DATA_TYPE_KEYS: Record<PropertyDataType, I18nKey> = {
  text: 'properties.dataTypes.text',
  number: 'properties.dataTypes.number',
  date: 'properties.dataTypes.date',
  boolean: 'properties.dataTypes.boolean',
  select: 'properties.dataTypes.select',
  multi_select: 'properties.dataTypes.multi_select',
  soldier_ref: 'properties.dataTypes.soldier_ref',
  unit_ref: 'properties.dataTypes.unit_ref',
}
