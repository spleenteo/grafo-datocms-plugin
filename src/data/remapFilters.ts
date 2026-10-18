import type { Filters } from './filterGraph';
import type { Graph } from './types';
import { fieldKey } from './types';

/**
 * Carries filters from `prev` over to `next` after a refresh. Models match by
 * `itemTypeId`, fields by `fieldKey` (model, api key, pseudo). Entries new in `next` are on;
 * entries gone from `next` are dropped.
 */
export function remapFilters(prev: Graph, next: Graph, filters: Filters): Filters {
  const prevModelIdx = new Map(prev.models.map((m, i) => [m.itemTypeId, i]));
  const models = new Set<number>();
  next.models.forEach((m, i) => {
    const p = prevModelIdx.get(m.itemTypeId);
    if (p === undefined || filters.models.has(p)) models.add(i);
  });

  const prevFieldIdx = new Map(prev.fields.map((f, i) => [fieldKey(f, prev.models), i]));
  const fields = new Set<number>();
  next.fields.forEach((f, i) => {
    const p = prevFieldIdx.get(fieldKey(f, next.models));
    if (p === undefined || filters.fields.has(p)) fields.add(i);
  });

  return {
    models,
    fields,
    statuses: new Set(filters.statuses),
    showsOutside: filters.showsOutside,
    direction: filters.direction,
    hidesOrphans: filters.hidesOrphans,
  };
}
