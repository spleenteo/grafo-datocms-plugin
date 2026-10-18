import { allFilters, type Filters } from './filterGraph';
import type { Graph } from './types';

/** All filters on, with models limited to the configured ones that exist in the graph (none: all). */
export function startingFilters(graph: Graph, apiKeys: readonly string[]): Filters {
  const filters = allFilters(graph);
  const wanted = new Set(apiKeys);
  const models = new Set<number>();
  graph.models.forEach((m, i) => {
    if (wanted.has(m.apiKey)) models.add(i);
  });
  return models.size === 0 ? filters : { ...filters, models };
}
