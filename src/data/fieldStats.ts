import type { Graph } from './types';

export type FieldStats = {
  /** Relations per field, self-links excluded. */
  counts: number[];
  /** Models of the records each field links to. */
  targets: Set<number>[];
};

export function fieldStats(graph: Graph): FieldStats {
  const counts = new Array<number>(graph.fields.length).fill(0);
  const targets = graph.fields.map(() => new Set<number>());
  for (const e of graph.edges) {
    if (e.source === e.target) continue;
    counts[e.field] += 1;
    targets[e.field].add(graph.nodes[e.target].model);
  }
  return { counts, targets };
}

/** Whether a field of a model outside the selection links into it (an incoming relation of the selection). */
export function linksInto(targets: ReadonlySet<number>, models: ReadonlySet<number>): boolean {
  for (const m of targets) if (models.has(m)) return true;
  return false;
}
