import type { Unit, UnitId } from '@contracts'
import { unitTreeRows } from '@logic'
import type { SelectOption } from '../../primitives/SelectField'

/** The units a soldier may be placed in, in tree order. */
export function unitOptions(units: readonly Unit[], allowed: (id: UnitId) => boolean): SelectOption<UnitId | null>[] {
  return unitTreeRows(units)
    .filter((row) => allowed(row.unit.id))
    .map((row) => ({ key: row.unit.id, label: { text: row.unit.name }, value: row.unit.id, depth: row.depth }))
}
