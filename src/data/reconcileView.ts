import type { Filters, VisibleSet } from './filterGraph';
import { remapFilters } from './remapFilters';
import type { Graph } from './types';

/**
 * Filters to use for `graph`. A new graph object is a refresh: the stored
 * filters are remapped onto it, so they never pair with stale indexes.
 */
export function reconcileFilters(
  prevGraph: Graph,
  graph: Graph,
  stored: Filters,
): { filters: Filters; isRemap: boolean } {
  if (graph === prevGraph) return { filters: stored, isRemap: false };
  return { filters: remapFilters(prevGraph, graph, stored), isRemap: true };
}

/**
 * Selection to keep after the filters changed. A remap (Reload) is not a user
 * change, so the selection stays; a user change clears a record outside the
 * filtered set.
 */
export function reconcileSelection(
  selectedId: string | null,
  filtersChanged: boolean,
  isRemap: boolean,
  filtered: Pick<VisibleSet, 'coreIds' | 'contextIds'>,
): string | null {
  if (!filtersChanged || isRemap || selectedId === null) return selectedId;
  if (filtered.coreIds.has(selectedId) || filtered.contextIds.has(selectedId)) return selectedId;
  return null;
}
