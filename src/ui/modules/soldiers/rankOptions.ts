import type { CommandRank, CommandRankId } from '@contracts'
import type { SelectOption } from '../../primitives/SelectField'

const NO_SELECTION = 'none'

/** The ranks a soldier may be given. An archived rank stays selectable only on the soldier who already holds it (D-095). */
export function rankOptions(ranks: readonly CommandRank[], current: CommandRankId | null): SelectOption<CommandRankId | null>[] {
  const offered = ranks.filter((rank) => rank.archived_at === null || rank.id === current)
  return [
    { key: NO_SELECTION, label: { key: 'soldiers.noRank' }, value: null },
    ...offered.map((rank) => ({ key: rank.id, label: { text: rank.title }, value: rank.id })),
  ]
}
