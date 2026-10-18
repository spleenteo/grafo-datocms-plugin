import type { Graph } from './types';

/** Ids of visible nodes whose title contains the query, in nodes order. */
export function searchTitles(
  graph: Graph,
  visibleIds: ReadonlySet<string>,
  query: string,
): string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return graph.nodes
    .filter((n) => visibleIds.has(n.id) && n.title.toLowerCase().includes(needle))
    .map((n) => n.id);
}
