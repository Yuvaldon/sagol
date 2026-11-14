import { z } from 'zod'
import { AvailabilityRuleId } from '../common/ids'
import { AvailabilityRuleColumns, checkAvailabilityRule } from '../entities/rules'
import { archiveInput, restoreInput, updateInput } from './common'

const ruleContent = AvailabilityRuleColumns.omit({
  id: true,
  organization_id: true,
  created_at: true,
  created_by: true,
  updated_at: true,
  updated_by: true,
  version: true,
  archived_at: true,
}).shape

export const CreateAvailabilityRuleInput = z
  .strictObject({ id: AvailabilityRuleId, ...ruleContent })
  .superRefine(checkAvailabilityRule)
export type CreateAvailabilityRuleInput = z.infer<typeof CreateAvailabilityRuleInput>

export const UpdateAvailabilityRuleInput = updateInput(AvailabilityRuleId, ruleContent)
export type UpdateAvailabilityRuleInput = z.infer<typeof UpdateAvailabilityRuleInput>

export const ArchiveAvailabilityRuleInput = archiveInput(AvailabilityRuleId)
export type ArchiveAvailabilityRuleInput = z.infer<typeof ArchiveAvailabilityRuleInput>
export const RestoreAvailabilityRuleInput = restoreInput(AvailabilityRuleId)
export type RestoreAvailabilityRuleInput = z.infer<typeof RestoreAvailabilityRuleInput>
