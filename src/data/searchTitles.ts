import type { Graph } from './types';

// Lowercased titles, computed once per graph.
const lowerTitles = new WeakMap<Graph, string[]>();

function titlesLower(graph: Graph): string[] {
  let lower = lowerTitles.get(graph);
  if (!lower) {
    lower = graph.nodes.map((n) => n.title.toLowerCase());
    lowerTitles.set(graph, lower);
  }
  return lower;
}

/** Ids of visible nodes whose title contains the query, in nodes order. */
export function searchTitles(
  graph: Graph,
  visibleIds: ReadonlySet<string>,
  query: string,
): string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const lower = titlesLower(graph);
  const ids: string[] = [];
  graph.nodes.forEach((n, i) => {
    if (visibleIds.has(n.id) && lower[i].includes(needle)) ids.push(n.id);
  });
  return ids;
}
