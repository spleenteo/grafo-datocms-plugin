import { allFilters, type Filters } from './filterGraph';
import type { Graph } from './types';

/** A graph with more records than this is too big to draw whole. */
export const LARGE_GRAPH_RECORDS = 1500;
/** Orphans are hidden at the start when they are more than this share of the records. */
export const ORPHAN_SHARE = 0.5;

export function isLargeGraph(graph: Graph): boolean {
  return graph.nodes.length > LARGE_GRAPH_RECORDS;
}

/** Records with no relation to another record (self-links don't count), over the whole graph. */
function orphanCount(graph: Graph): number {
  const linked = new Set<number>();
  for (const e of graph.edges) {
    if (e.source === e.target) continue;
    linked.add(e.source);
    linked.add(e.target);
  }
  return graph.nodes.length - linked.size;
}

/**
 * Where a visit starts: the configured models that exist in the graph. With none,
 * all models, except on a large graph, which starts empty (the editor searches and
 * grows the view). Orphans start hidden on a large graph with configured models,
 * and on any graph where they are more than half the records.
 */
export function startingFilters(graph: Graph, apiKeys: readonly string[]): Filters {
  const filters = allFilters(graph);
  const wanted = new Set(apiKeys);
  const configured = new Set<number>();
  graph.models.forEach((m, i) => {
    if (wanted.has(m.apiKey)) configured.add(i);
  });
  const isLarge = isLargeGraph(graph);
  const hasConfigured = configured.size > 0;
  const models = hasConfigured ? configured : isLarge ? new Set<number>() : filters.models;
  const hidesOrphans =
    (isLarge && hasConfigured) || orphanCount(graph) > graph.nodes.length * ORPHAN_SHARE;
  return { ...filters, models, hidesOrphans };
}
