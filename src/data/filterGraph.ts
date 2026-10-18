import type { Graph, NodeStatus } from './types';

export type Filters = {
  models: ReadonlySet<number>;
  statuses: ReadonlySet<NodeStatus>;
  fields: ReadonlySet<number>;
  showsOutside: boolean;
  direction: 'both' | 'out' | 'in';
  hidesOrphans: boolean;
};

export type VisibleSet = {
  coreIds: Set<string>;
  contextIds: Set<string>;
  /** Indexes into `graph.edges`, ascending. */
  edgeIndexes: number[];
};

export function allFilters(graph: Graph): Filters {
  return {
    models: new Set(graph.models.map((_, i) => i)),
    statuses: new Set<NodeStatus>(['published', 'updated', 'draft']),
    fields: new Set(graph.fields.map((_, i) => i)),
    showsOutside: false,
    direction: 'both',
    hidesOrphans: false,
  };
}

export function filterGraph(graph: Graph, filters: Filters): VisibleSet {
  const { nodes, edges } = graph;
  const isCore = nodes.map(
    (n) => filters.models.has(n.model) && filters.statuses.has(n.status),
  );
  const coreIds = new Set<string>();
  nodes.forEach((n, i) => {
    if (isCore[i]) coreIds.add(n.id);
  });
  const contextIdxs = new Set<number>();
  const edgeIndexes: number[] = [];
  const linked = new Set<number>();

  edges.forEach((e, ei) => {
    if (e.source === e.target || !filters.fields.has(e.field)) return;
    const s = isCore[e.source];
    const t = isCore[e.target];
    if (s && t) {
      edgeIndexes.push(ei);
      linked.add(e.source);
      linked.add(e.target);
      return;
    }
    if (!filters.showsOutside || s === t) return;
    if (filters.direction === 'out' && !s) return;
    if (filters.direction === 'in' && !t) return;
    const other = s ? e.target : e.source;
    if (!filters.statuses.has(nodes[other].status)) return;
    contextIdxs.add(other);
    edgeIndexes.push(ei);
    linked.add(e.source);
    linked.add(e.target);
  });

  const contextIds = new Set<string>();
  for (const i of contextIdxs) contextIds.add(nodes[i].id);

  if (filters.hidesOrphans) {
    nodes.forEach((n, i) => {
      if (linked.has(i)) return;
      coreIds.delete(n.id);
      contextIds.delete(n.id);
    });
  }
  return { coreIds, contextIds, edgeIndexes };
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export function sameVisibleSet(a: VisibleSet, b: VisibleSet): boolean {
  return (
    sameSet(a.coreIds, b.coreIds) &&
    sameSet(a.contextIds, b.contextIds) &&
    a.edgeIndexes.length === b.edgeIndexes.length &&
    a.edgeIndexes.every((v, i) => v === b.edgeIndexes[i])
  );
}
