import { z } from 'zod'
import { UnitId, UnitLevelId } from '../common/ids'
import { checkDateRange } from '../common/refinements'
import { UnitColumns, UnitLevel } from '../entities/hierarchy'
import { ExpectedVersion, archiveInput, reorderInput, updateInput } from './common'

export const CreateUnitLevelInput = z.strictObject(
  UnitLevel.pick({ id: true, name: true, sort_order: true }).shape,
)
export type CreateUnitLevelInput = z.infer<typeof CreateUnitLevelInput>

export const UpdateUnitLevelInput = updateInput(UnitLevelId, UnitLevel.pick({ name: true }).shape)
export type UpdateUnitLevelInput = z.infer<typeof UpdateUnitLevelInput>

export const ArchiveUnitLevelInput = archiveInput(UnitLevelId)
export type ArchiveUnitLevelInput = z.infer<typeof ArchiveUnitLevelInput>

export const ReorderUnitLevelsInput = reorderInput(UnitLevelId)
export type ReorderUnitLevelsInput = z.infer<typeof ReorderUnitLevelsInput>

const unitContent = UnitColumns.pick({
  name: true,
  code: true,
  unit_level_id: true,
  kind: true,
  valid_from: true,
  valid_to: true,
  color_key: true,
  properties: true,
}).shape

export const CreateUnitInput = z
  .strictObject({
    id: UnitId,
    /** Initial parent. Later changes go through `moveUnit` only. */
    parent_id: UnitColumns.shape.parent_id,
    sort_order: UnitColumns.shape.sort_order,
    ...unitContent,
  })
  .superRefine((input, ctx) => {
    checkDateRange(ctx, input.valid_from, input.valid_to, 'valid_to')
  })
export type CreateUnitInput = z.infer<typeof CreateUnitInput>

/** `parent_id` is not updatable here: re-parenting is `moveUnit` (cycle check, D-009). */
export const UpdateUnitInput = updateInput(UnitId, unitContent)
export type UpdateUnitInput = z.infer<typeof UpdateUnitInput>

export const ArchiveUnitInput = archiveInput(UnitId)
export type ArchiveUnitInput = z.infer<typeof ArchiveUnitInput>

/** Orders the children of one parent. */
export const ReorderUnitsInput = reorderInput(UnitId)
export type ReorderUnitsInput = z.infer<typeof ReorderUnitsInput>

/** `moveUnit`: re-parent a unit (NULL = top level). Domain rejects cycles (D-009). */
export const MoveUnitInput = z.strictObject({
  id: UnitId,
  expected_version: ExpectedVersion,
  parent_id: UnitColumns.shape.parent_id,
})
export type MoveUnitInput = z.infer<typeof MoveUnitInput>
