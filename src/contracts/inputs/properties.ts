import { z } from 'zod'
import { PropertyDefinitionId } from '../common/ids'
import { PropertyDefinition } from '../entities/properties'
import { archiveInput, restoreInput, reorderInput, updateInput } from './common'

const definitionContent = PropertyDefinition.pick({
  label: true,
  options: true,
  is_required: true,
}).shape

export const CreatePropertyDefinitionInput = z.strictObject({
  id: PropertyDefinitionId,
  ...PropertyDefinition.pick({ entity_type: true, data_type: true, sort_order: true }).shape,
  ...definitionContent,
})
export type CreatePropertyDefinitionInput = z.infer<typeof CreatePropertyDefinitionInput>

/**
 * `entity_type` and `data_type` are fixed after creation: changing them would invalidate the
 * values stored under the definition id (D-016).
 */
export const UpdatePropertyDefinitionInput = updateInput(PropertyDefinitionId, definitionContent)
export type UpdatePropertyDefinitionInput = z.infer<typeof UpdatePropertyDefinitionInput>

export const ArchivePropertyDefinitionInput = archiveInput(PropertyDefinitionId)
export type ArchivePropertyDefinitionInput = z.infer<typeof ArchivePropertyDefinitionInput>
export const RestorePropertyDefinitionInput = restoreInput(PropertyDefinitionId)
export type RestorePropertyDefinitionInput = z.infer<typeof RestorePropertyDefinitionInput>

/** Orders the definitions of one entity type. */
export const ReorderPropertyDefinitionsInput = reorderInput(PropertyDefinitionId)
export type ReorderPropertyDefinitionsInput = z.infer<typeof ReorderPropertyDefinitionsInput>
