import { t } from '@i18n'
import { unitTreeRows, useCurrentOrganization, useUnits, useViewFilter } from '@logic'
import { useMemo } from 'react'

// The name of what the board shows (D-104, D-173): the unit the filter names, else the one root the actor sees, else
// the organization. The unit drawer opened from the board is named by it.

export function useScopeName(): string {
  const units = useUnits()
  const organization = useCurrentOrganization()
  const { unit } = useViewFilter()
  return useMemo(() => {
    const rows = units.status === 'ready' ? unitTreeRows(units.value) : []
    if (unit.kind === 'unit') {
      const named = rows.find((row) => row.unit.id === unit.unitId)
      if (named !== undefined) return named.unit.name
    }
    const roots = rows.filter((row) => row.depth === 0)
    if (roots.length === 1 && roots[0] !== undefined) return roots[0].unit.name
    return organization.status === 'ready' && organization.value !== null ? organization.value.name : t('app.name')
  }, [units, organization, unit])
}
