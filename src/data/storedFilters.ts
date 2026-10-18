import type { Filters } from './filterGraph';
import { allFilters } from './filterGraph';
import type { Graph, NodeStatus } from './types';
import { fieldKey, isRecord, NODE_STATUSES } from './types';

const DIRECTIONS: readonly Filters['direction'][] = ['both', 'out', 'in'];

export type StoredFilters = {
  v: 1;
  startingKey: string;
  offModels: string[];
  offFields: [string, boolean][];
  statuses: NodeStatus[];
  showsOutside: boolean;
  direction: Filters['direction'];
  hidesOrphans: boolean;
};

/** Identifies the configured starting models: sorted api keys, joined. */
export function startingKeyOf(apiKeys: readonly string[]): string {
  return [...apiKeys].sort().join(',');
}

/** Stores what is off (by api key), so models and fields added later come up on. */
export function serializeFilters(
  graph: Graph,
  filters: Filters,
  startingKey: string,
): StoredFilters {
  return {
    v: 1,
    startingKey,
    offModels: graph.models.filter((_, i) => !filters.models.has(i)).map((m) => m.apiKey),
    offFields: graph.fields
      .filter((_, i) => !filters.fields.has(i))
      .map((f): [string, boolean] => [f.apiKey, f.isPseudo]),
    statuses: NODE_STATUSES.filter((s) => filters.statuses.has(s)),
    showsOutside: filters.showsOutside,
    direction: filters.direction,
    hidesOrphans: filters.hidesOrphans,
  };
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

/** Fails closed: any doubt about the stored value returns null (use the starting filters). */
export function deserializeFilters(
  graph: Graph,
  data: unknown,
  startingKey: string,
): Filters | null {
  if (!isRecord(data)) return null;
  const d = data;
  if (d.v !== 1 || d.startingKey !== startingKey) return null;
  if (!isStringArray(d.offModels) || !isStringArray(d.statuses)) return null;
  if (
    !Array.isArray(d.offFields) ||
    !d.offFields.every(
      (e) => Array.isArray(e) && e.length === 2 && typeof e[0] === 'string' && typeof e[1] === 'boolean',
    )
  ) {
    return null;
  }
  if (typeof d.showsOutside !== 'boolean' || typeof d.hidesOrphans !== 'boolean') return null;
  const direction = DIRECTIONS.find((x) => x === d.direction);
  if (direction === undefined) return null;
  if (!d.statuses.every((s) => (NODE_STATUSES as readonly string[]).includes(s))) return null;

  const offModels = new Set(d.offModels);
  const offFields = new Set((d.offFields as [string, boolean][]).map(([k, p]) => fieldKey({ apiKey: k, isPseudo: p })));
  const base = allFilters(graph);
  const models = new Set<number>();
  graph.models.forEach((m, i) => {
    if (!offModels.has(m.apiKey)) models.add(i);
  });
  if (models.size === 0) return null;
  const fields = new Set<number>();
  graph.fields.forEach((f, i) => {
    if (!offFields.has(fieldKey(f))) fields.add(i);
  });
  return {
    ...base,
    models,
    fields,
    statuses: new Set(d.statuses as NodeStatus[]),
    showsOutside: d.showsOutside,
    direction,
    hidesOrphans: d.hidesOrphans,
  };
}
