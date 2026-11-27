import { t, type I18nKey } from '@i18n'
import { ruleOfNode, useLeaveConditions, useLeaveTypes, useViewFilter, type BoardLeaveStatus, type FilterRule } from '@logic'
import type { BuilderTarget } from '../shell/builderOpen'
import { OPERATOR_LABELS, negates, plain, useFilterFields, type FieldEntity, type FilterFields } from '../shell/filterFields'

// The board's set conditions in words (D-131, D-312): a soldier rule as its field, its operator when it is not plain
// "any of", and its values; then the leave conditions. The options menu lists them under "סינון" (D-480), each opening
// its rule in the builder.

const SEPARATOR = ', '
const QUALIFIER_SEPARATOR = ' · '

export interface Condition {
  readonly key: string
  /** The condition read whole: "תגית: נהג, חובש". */
  readonly text: string
  readonly target: BuilderTarget | null
  readonly remove: () => void
}

function words(rule: FilterRule, fields: FilterFields, entity: FieldEntity): string {
  const draft = fields.draftOf(rule, entity)
  const field = draft === null ? undefined : fields.byKey.get(draft.field)
  if (draft === null || field === undefined) return t('filters.unavailable')
  const operator = plain(draft.operator) ? null : t(OPERATOR_LABELS[draft.operator])
  // A "none of" or "is not" whose every value matches nobody keeps everyone; the words say so (OI-264).
  const keepsEveryone = negates(draft.operator) && draft.values.length > 0 && draft.values.every(field.inert)
  const qualifier = keepsEveryone ? [operator, t('filters.keepsEveryone')].join(QUALIFIER_SEPARATOR) : operator
  const name = qualifier === null ? field.name : `${field.name} ${qualifier}`
  return draft.values.length === 0 ? name : `${name}: ${draft.values.map(field.labelOf).join(SEPARATOR)}`
}

const LEAVE_STATUS_KEYS: Record<BoardLeaveStatus, I18nKey> = { pending: 'leaves.statusPending', approved: 'leaves.statusApproved' }

export function useConditions(): readonly Condition[] {
  const filter = useViewFilter()
  const fields = useFilterFields()
  const leaves = useLeaveConditions()
  const types = useLeaveTypes()
  const read = filter.rules
  const soldier: Condition[] =
    read.kind === 'other'
      ? [{ key: 'other', text: t('filters.other'), target: null, remove: filter.clear }]
      : read.filter.rules.map((rule, index, rules) => ({
          key: `rule:${String(index)}`,
          text: words(rule, fields, 'soldier'),
          target: { kind: 'rule', index },
          remove: () => {
            filter.setRules({ ...read.filter, rules: rules.filter((_, at) => at !== index) })
          },
        }))
  const statuses = leaves.conditions.statuses ?? []
  const typeIds = leaves.conditions.type_ids ?? []
  const allTypes = types.status === 'ready' ? types.value : []
  const leave: Condition[] = []
  if (statuses.length > 0) {
    leave.push({
      key: 'leaveStatus',
      text: `${t('filters.leaveStatus')}: ${statuses.map((status) => t(LEAVE_STATUS_KEYS[status])).join(SEPARATOR)}`,
      target: { kind: 'leaveStatus' },
      remove: () => {
        leaves.setStatuses([])
      },
    })
  }
  if (typeIds.length > 0) {
    leave.push({
      key: 'leaveType',
      text: `${t('filters.leaveType')}: ${typeIds.map((id) => allTypes.find((type) => type.id === id)?.name ?? t('filters.unavailable')).join(SEPARATOR)}`,
      target: { kind: 'leaveType' },
      remove: () => {
        leaves.setTypes([])
      },
    })
  }
  const properties = leaves.conditions.properties ?? []
  for (const [index, node] of properties.entries()) {
    const rule = ruleOfNode(node)
    leave.push({
      key: `leaveProperty:${String(index)}`,
      text: rule === null ? t('filters.other') : words(rule, fields, 'leave'),
      target: { kind: 'leaveProperty', index },
      remove: () => {
        leaves.setProperties(properties.filter((_, at) => at !== index))
      },
    })
  }
  return [...soldier, ...leave]
}
