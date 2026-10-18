import { buildClient } from '@datocms/cma-client-browser';
import { buildGraph } from './buildGraph';
import { parseSchema } from './parseSchema';
import { readAccess } from './readAccess';
import type { Graph, RawItem, RawRecord, Schema } from './types';

/** The two arrays of `ctx.currentRole.meta.final_permissions` that decide read access. */
export type RolePermissions = {
  positive_item_type_permissions: unknown[];
  negative_item_type_permissions: unknown[];
};

export type LoadGraphOptions = {
  apiToken: string;
  environment: string;
  baseUrl?: string;
  permissions: RolePermissions;
  /** Bypasses the memo; a success replaces the entry, a failure leaves it alone. */
  fresh?: boolean;
};

export type LoadGraphResult = { graph: Graph; requestCount: number };

const TYPE_CHUNK_SIZE = 200;
const PER_PAGE = 500;
// `nested: true` caps perPage at 30
const NESTED_PER_PAGE = 30;
const CONCURRENCY = 3;

const memo = new Map<string, Promise<LoadGraphResult>>();
// Latest fresh load per key: only that one may write its result to the memo.
const freshTokens = new Map<string, number>();
let lastFreshToken = 0;

/**
 * Cache key of one load: same environment, endpoint and effective permissions.
 * Stable across renders, so it can be an effect dependency.
 */
export function loadGraphKey(
  environment: string,
  baseUrl: string | undefined,
  permissions: RolePermissions,
): string {
  return `${environment}\n${baseUrl ?? ''}\n${JSON.stringify({
    positive: permissions.positive_item_type_permissions,
    negative: permissions.negative_item_type_permissions,
  })}`;
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Drops the models the role can't read; block models stay. */
function readableSchema(schema: Schema, readableModelIds: Set<string>): Schema {
  const itemTypes = new Map(
    [...schema.itemTypes].filter(([id, t]) => t.isBlock || readableModelIds.has(id)),
  );
  return { locales: schema.locales, itemTypes };
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

  const allModelIds: string[] = [];
  const blockIds: string[] = [];
  for (const t of fullSchema.itemTypes.values()) (t.isBlock ? blockIds : allModelIds).push(t.id);

  const access = readAccess(options.permissions, options.environment, allModelIds);
  const schema = readableSchema(fullSchema, access.readableModelIds);
  const modelIds = allModelIds.filter((id) => access.readableModelIds.has(id));

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
  } else if (access.isFullRead) {
    const [items, blocks] = await Promise.all([listFlat(modelIds), listFlat(blockIds)]);
    graph = buildGraph(schema, items, blocks);
  } else {
    graph = buildGraph(schema, await listNested(modelIds), []);
  }
  return { graph, requestCount: count };
}

export function loadGraph(options: LoadGraphOptions): Promise<LoadGraphResult> {
  const key = loadGraphKey(options.environment, options.baseUrl, options.permissions);
  if (options.fresh) {
    lastFreshToken += 1;
    const token = lastFreshToken;
    freshTokens.set(key, token);
    const promise = loadGraphUncached(options);
    promise.then(
      (result) => {
        if (freshTokens.get(key) === token) memo.set(key, Promise.resolve(result));
      },
      () => {},
    );
    return promise;
  }
  const cached = memo.get(key);
  if (cached) return cached;
  const promise = loadGraphUncached(options);
  memo.set(key, promise);
  promise.catch(() => {
    if (memo.get(key) === promise) memo.delete(key);
  });
  return promise;
}
