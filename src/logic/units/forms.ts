import {
  CreateUnitInput,
  CreateUnitLevelInput,
  UnitId,
  UnitKind,
  UnitLevelId,
  type Issue,
  type Unit,
  type UnitLevel,
  type UpdateUnitInput,
} from '@contracts'
import { formIssues } from '../forms/issues'
import { siblingsUnder } from './tree'

// Between the forms and the command inputs. Ids are generated here, by the caller (D-044). The
// fields on screen are name, level and color; `code`, `kind` and the dates stay at their defaults
// until a slice shows them (D-092).

export interface UnitFormValues {
  readonly name: string
  readonly unit_level_id: UnitLevelId | null
  readonly color_key: string | null
}

/** After the last sibling: `sort_order` is set at creation and by reorder (D-045). */
function nextSortOrder(rows: readonly { sort_order: number }[]): number {
  return Math.max(-1, ...rows.map((row) => row.sort_order)) + 1
}

export function toCreateUnitInput(
  values: UnitFormValues,
  parentId: UnitId | null,
  units: readonly Unit[],
): CreateUnitInput {
  return {
    ...values,
    id: UnitId.parse(crypto.randomUUID()),
    parent_id: parentId,
    sort_order: nextSortOrder(siblingsUnder(units, parentId)),
    code: null,
    kind: UnitKind.enum.standing,
    valid_from: null,
    valid_to: null,
    properties: {},
  }
}

/** The same field codes the adapter answers (D-068). */
export function unitFormIssues(values: UnitFormValues): Issue[] {
  return formIssues(CreateUnitInput, toCreateUnitInput(values, null, []))
}

/**
 * The update of a form opened at `openedVersion`, which is what makes a change from another tab
 * answer `stale_version` instead of being overwritten. NULL when nothing changed.
 */
export function toUpdateUnitInput(
  unit: Unit,
  openedVersion: number,
  values: UnitFormValues,
): UpdateUnitInput | null {
  const changes = {
    ...(values.name === unit.name ? {} : { name: values.name }),
    ...(values.unit_level_id === unit.unit_level_id ? {} : { unit_level_id: values.unit_level_id }),
    ...(values.color_key === unit.color_key ? {} : { color_key: values.color_key }),
  }
  if (Object.keys(changes).length === 0) return null
  return { id: unit.id, expected_version: openedVersion, changes }
}

export function toCreateUnitLevelInput(name: string, levels: readonly UnitLevel[]): CreateUnitLevelInput {
  return {
    id: UnitLevelId.parse(crypto.randomUUID()),
    name,
    sort_order: nextSortOrder(levels.filter((level) => level.archived_at === null)),
  }
}

export function unitLevelFormIssues(name: string): Issue[] {
  return formIssues(CreateUnitLevelInput, toCreateUnitLevelInput(name, []))
}

/** An update's field issues, at the paths of the form's fields (D-065). */
export function formFieldIssues(issues: readonly Issue[]): Issue[] {
  return issues.map((issue) => (issue.path[0] === 'changes' ? { ...issue, path: issue.path.slice(1) } : issue))
}
