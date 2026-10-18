import type { Graph } from './types';

export type Relation = { nodeIndex: number; field: number };

export function nodeIndexById(graph: Graph): Map<string, number> {
  return new Map(graph.nodes.map((n, i) => [n.id, i]));
}

/** Links of one node over the whole graph, self-links excluded, sorted by field label, then api key, then title. */
export function relationsOf(
  graph: Graph,
  nodeIndex: number,
): { outgoing: Relation[]; incoming: Relation[] } {
  const outgoing: Relation[] = [];
  const incoming: Relation[] = [];
  for (const e of graph.edges) {
    if (e.source === e.target) continue;
    if (e.source === nodeIndex) outgoing.push({ nodeIndex: e.target, field: e.field });
    else if (e.target === nodeIndex) incoming.push({ nodeIndex: e.source, field: e.field });
  }
  const compare = (a: Relation, b: Relation) =>
    graph.fields[a.field].label.localeCompare(graph.fields[b.field].label) ||
    graph.fields[a.field].apiKey.localeCompare(graph.fields[b.field].apiKey) ||
    graph.nodes[a.nodeIndex].title.localeCompare(graph.nodes[b.nodeIndex].title);
  return { outgoing: outgoing.sort(compare), incoming: incoming.sort(compare) };
}
