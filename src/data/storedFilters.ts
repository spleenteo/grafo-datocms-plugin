import type { Filters } from './filterGraph';
import { allFilters } from './filterGraph';
import type { FieldStoreKey, Graph, NodeStatus } from './types';
import { fieldStoreKey, isRecord, NODE_STATUSES } from './types';

const DIRECTIONS: readonly Filters['direction'][] = ['both', 'out', 'in'];

export type StoredFilters = {
  v: 2;
  startingKey: string;
  offModels: string[];
  offFields: FieldStoreKey[];
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
    v: 2,
    startingKey,
    offModels: graph.models.filter((_, i) => !filters.models.has(i)).map((m) => m.apiKey),
    offFields: graph.fields
      .filter((_, i) => !filters.fields.has(i))
      .map((f) => fieldStoreKey(f, graph.models)),
    statuses: NODE_STATUSES.filter((s) => filters.statuses.has(s)),
    showsOutside: filters.showsOutside,
    direction: filters.direction,
    hidesOrphans: filters.hidesOrphans,
  };
}

const isStoreKey = (e: unknown): e is FieldStoreKey =>
  Array.isArray(e) &&
  e.length === 3 &&
  typeof e[0] === 'string' &&
  typeof e[1] === 'string' &&
  typeof e[2] === 'boolean';
const isV1Key = (e: unknown): e is [string, boolean] =>
  Array.isArray(e) && e.length === 2 && typeof e[0] === 'string' && typeof e[1] === 'boolean';

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
  if ((data.v !== 1 && data.v !== 2) || data.startingKey !== startingKey) return null;
  if (!isStringArray(data.offModels) || !isStringArray(data.statuses)) return null;
  if (
    !Array.isArray(data.offFields) ||
    !data.offFields.every(data.v === 2 ? isStoreKey : isV1Key)
  ) {
    return null;
  }
  if (typeof data.showsOutside !== 'boolean' || typeof data.hidesOrphans !== 'boolean') return null;
  const direction = DIRECTIONS.find((x) => x === data.direction);
  if (direction === undefined) return null;
  if (!data.statuses.every((s) => (NODE_STATUSES as readonly string[]).includes(s))) return null;

  const offModels = new Set(data.offModels);
  // v1 entries are [apiKey, isPseudo] and switch off that field of every model.
  const offFields = new Set(
    data.v === 2
      ? (data.offFields as FieldStoreKey[]).map(([m, k, p]) => `${p}:${m}:${k}`)
      : (data.offFields as [string, boolean][]).map(([k, p]) => `${p}::${k}`),
  );
  const isFieldOff = (f: Graph['fields'][number]): boolean =>
    offFields.has(`${f.isPseudo}:${graph.models[f.model].apiKey}:${f.apiKey}`) ||
    offFields.has(`${f.isPseudo}::${f.apiKey}`);
  const base = allFilters(graph);
  const models = new Set<number>();
  graph.models.forEach((m, i) => {
    if (!offModels.has(m.apiKey)) models.add(i);
  });
  if (models.size === 0) return null;
  const fields = new Set<number>();
  graph.fields.forEach((f, i) => {
    if (!isFieldOff(f)) fields.add(i);
  });
  return {
    ...base,
    models,
    fields,
    statuses: new Set(data.statuses as NodeStatus[]),
    showsOutside: data.showsOutside,
    direction,
    hidesOrphans: data.hidesOrphans,
  };
}
