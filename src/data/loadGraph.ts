import { buildClient } from '@datocms/cma-client-browser';
import { buildGraph } from './buildGraph';
import { createLoadMemo } from './loadMemo';
import { parseSchema } from './parseSchema';
import type { Graph, Permissions, RawItem, RawRecord } from './types';
import { visibleModelPlan } from './visibleModelPlan';

export type RolePermissions = Permissions;

export type LoadGraphOptions = {
  apiToken: string;
  environment: string;
  baseUrl?: string;
  permissions: RolePermissions;
  /** Current user: with `on_creator` rules the readable records depend on who asks. */
  userId: string;
  /** Models never loaded nor shown (applied after the role's read access is computed). */
  excludedModelApiKeys: readonly string[];
  /** Bypasses the memo; a success replaces the entry, a failure leaves it alone. */
  fresh?: boolean;
};

export type LoadGraphResult = { graph: Graph; requestCount: number };

const TYPE_CHUNK_SIZE = 200;
const PER_PAGE = 500;
// `nested: true` caps perPage at 30
const NESTED_PER_PAGE = 30;
const CONCURRENCY = 3;

const memo = createLoadMemo<LoadGraphResult>();

/**
 * Cache key of one load: same environment, endpoint and effective permissions.
 * Stable across renders, so it can be an effect dependency.
 */
export function loadGraphKey(
  environment: string,
  baseUrl: string | undefined,
  userId: string,
  permissions: RolePermissions,
  excludedModelApiKeys: readonly string[],
): string {
  return `${environment}\n${baseUrl ?? ''}\n${userId}\n${JSON.stringify({
    positive: permissions.positive_item_type_permissions,
    negative: permissions.negative_item_type_permissions,
    excluded: [...excludedModelApiKeys].sort(),
  })}`;
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function loadGraphUncached(options: LoadGraphOptions): Promise<LoadGraphResult> {
  let count = 0;
  const fetchFn: typeof fetch = (...args) => {
    count++;
    return fetch(...args);
  };
  const client = buildClient({
    apiToken: options.apiToken,
    environment: options.environment,
    baseUrl: options.baseUrl,
    fetchFn,
  });

  const site = await client.site.rawFind({ include: 'item_types,item_types.fields' });
  const fullSchema = parseSchema(site);

  const blockIds = [...fullSchema.itemTypes.values()].filter((t) => t.isBlock).map((t) => t.id);
  const { modelIds, schema, isFullRead } = visibleModelPlan(
    fullSchema,
    options.permissions,
    options.environment,
    options.excludedModelApiKeys,
  );

  async function listFlat(typeIds: string[]): Promise<RawItem[]> {
    const items: RawItem[] = [];
    for (const ids of chunk(typeIds, TYPE_CHUNK_SIZE)) {
      for await (const item of client.items.listPagedIterator(
        { filter: { type: ids.join(',') }, version: 'current' },
        { perPage: PER_PAGE, concurrency: CONCURRENCY },
      )) {
        items.push(item);
      }
    }
    return items;
  }

  // Restricted roles: blocks come inline with the records the role can read,
  // never from a listing by block type (that would download blocks of hidden records).
  async function listNested(typeIds: string[]): Promise<RawRecord[]> {
    const items: RawRecord[] = [];
    for (const ids of chunk(typeIds, TYPE_CHUNK_SIZE)) {
      for await (const item of client.items.listPagedIterator(
        { filter: { type: ids.join(',') }, version: 'current', nested: true },
        { perPage: NESTED_PER_PAGE, concurrency: CONCURRENCY },
      )) {
        items.push(item);
      }
    }
    return items;
  }

  let graph: Graph;
  if (modelIds.length === 0) {
    graph = buildGraph(schema, [], []);
  } else if (isFullRead) {
    const [items, blocks] = await Promise.all([listFlat(modelIds), listFlat(blockIds)]);
    graph = buildGraph(schema, items, blocks);
  } else {
    graph = buildGraph(schema, await listNested(modelIds), []);
  }
  return { graph, requestCount: count };
}

export function loadGraph(options: LoadGraphOptions): Promise<LoadGraphResult> {
  const key = loadGraphKey(
    options.environment,
    options.baseUrl,
    options.userId,
    options.permissions,
    options.excludedModelApiKeys,
  );
  return memo.load(key, () => loadGraphUncached(options), options.fresh);
}
