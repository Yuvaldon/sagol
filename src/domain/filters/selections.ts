import { TagMatch, type CommandRankId, type FilterExpression, type FilterNode, type TagId } from '@contracts'

// What a filter selects in a positive sense: the tags and command ranks a matching soldier
// may hold because of the filter. A rule grouped by tag or rank evaluates these groups even
// when no soldier holds them (D-072). A `not` flips the sense, and so does a `none` tag match.

/** Tags and ranks selected positively, each id once, in first-seen order. */
export interface PositiveSelections {
  readonly tag_ids: TagId[]
  readonly command_rank_ids: CommandRankId[]
}

export function positiveSelections(expression: FilterExpression): PositiveSelections {
  const tags = new Set<TagId>()
  const ranks = new Set<CommandRankId>()
  const visit = (node: FilterNode, negated: boolean): void => {
    switch (node.kind) {
      case 'and':
      case 'or':
        node.nodes.forEach((child) => {
          visit(child, negated)
        })
        return
      case 'not':
        visit(node.node, !negated)
        return
      case 'tag':
        if ((node.match === TagMatch.enum.none) === negated) node.tag_ids.forEach((id) => tags.add(id))
        return
      case 'command_rank':
        if (!negated) node.command_rank_ids.forEach((id) => ranks.add(id))
        return
      default:
        return
    }
  }
  if (expression.where !== undefined) visit(expression.where, false)
  return { tag_ids: [...tags], command_rank_ids: [...ranks] }
}
