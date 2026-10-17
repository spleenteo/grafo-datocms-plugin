import { buildClient } from '@datocms/cma-client-browser';
import { buildGraph } from './buildGraph';
import { parseSchema } from './parseSchema';
import type { Graph, RawItem } from './types';

export type LoadGraphOptions = {
  apiToken: string;
  environment: string;
  baseUrl?: string;
};

export type LoadGraphResult = { graph: Graph; requestCount: number };

const TYPE_CHUNK_SIZE = 200;
const PER_PAGE = 500;
const CONCURRENCY = 3;

const memo = new Map<string, Promise<LoadGraphResult>>();

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
  const schema = parseSchema(site);

  const modelIds: string[] = [];
  const blockIds: string[] = [];
  for (const t of schema.itemTypes.values()) (t.isBlock ? blockIds : modelIds).push(t.id);

  async function listAll(typeIds: string[]): Promise<RawItem[]> {
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

  const [items, blocks] = await Promise.all([listAll(modelIds), listAll(blockIds)]);
  const graph = buildGraph(schema, items, blocks);
  return { graph, requestCount: count };
}

export function loadGraph(options: LoadGraphOptions): Promise<LoadGraphResult> {
  const key = options.environment;
  const cached = memo.get(key);
  if (cached) return cached;
  const promise = loadGraphUncached(options);
  memo.set(key, promise);
  promise.catch(() => {
    if (memo.get(key) === promise) memo.delete(key);
  });
  return promise;
}
