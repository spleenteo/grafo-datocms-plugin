import type { Filters, VisibleSet } from './filterGraph';
import type { Graph } from './types';

/**
 * Adds the relations of one node to a visible set, both directions and
 * regardless of the model filter, still honouring the status and relation
 * field filters. The node itself and the other ends that aren't visible yet
 * become context. Returns `visible` itself when there is nothing to add.
 */
export function expandAround(
  graph: Graph,
  visible: VisibleSet,
  nodeIndex: number,
  filters: Filters,
): VisibleSet {
  const node = graph.nodes[nodeIndex];
  if (!node) return visible;
  const isVisible = (id: string) => visible.coreIds.has(id) || visible.contextIds.has(id);
  const newContext = new Set<string>();
  if (!isVisible(node.id)) newContext.add(node.id);
  const known = new Set(visible.edgeIndexes);
  const newEdges: number[] = [];

  graph.edges.forEach((e, ei) => {
    if (e.source === e.target || !filters.fields.has(e.field)) return;
    if (e.source !== nodeIndex && e.target !== nodeIndex) return;
    const other = graph.nodes[e.source === nodeIndex ? e.target : e.source];
    if (!other || !filters.statuses.has(other.status)) return;
    if (!known.has(ei)) newEdges.push(ei);
    if (!isVisible(other.id)) newContext.add(other.id);
  });

  if (newEdges.length === 0 && newContext.size === 0) return visible;
  const contextIds = new Set(visible.contextIds);
  for (const id of newContext) contextIds.add(id);
  const edgeIndexes = [...visible.edgeIndexes, ...newEdges].sort((a, b) => a - b);
  return { coreIds: visible.coreIds, contextIds, edgeIndexes };
}
