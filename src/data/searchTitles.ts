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

/** Ids of nodes in scope (null: every record) whose title contains the query, in nodes order. */
export function searchTitles(
  graph: Graph,
  scopeIds: ReadonlySet<string> | null,
  query: string,
): string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const lower = titlesLower(graph);
  const ids: string[] = [];
  graph.nodes.forEach((n, i) => {
    if ((scopeIds === null || scopeIds.has(n.id)) && lower[i].includes(needle)) ids.push(n.id);
  });
  return ids;
}
