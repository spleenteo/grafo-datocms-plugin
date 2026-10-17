import { extractLinks } from './extractLinks';
import type { Graph, NodeStatus, RawItem, Schema, SchemaItemType } from './types';

export const PARENT_FIELD_KEY = 'parent';

function firstNonEmpty(value: unknown, locales: string[]): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object' && value !== null) {
    const byLocale = value as Record<string, unknown>;
    for (const locale of locales) {
      const v = byLocale[locale];
      if (typeof v === 'string' && v.trim() !== '') return v.trim();
    }
  }
  return '';
}

function titleOf(item: RawItem, itemType: SchemaItemType, locales: string[]): string {
  if (itemType.titleFieldApiKey) {
    const raw = (item as unknown as Record<string, unknown>)[itemType.titleFieldApiKey];
    const title = firstNonEmpty(raw, locales);
    if (title) return title;
  }
  return `Untitled ${itemType.name}`;
}

function statusOf(item: RawItem): NodeStatus {
  const status = item.meta?.status as string | null | undefined;
  return status === 'draft' || status === 'updated' ? status : 'published';
}

export function buildGraph(schema: Schema, items: RawItem[], blocks: RawItem[]): Graph {
  const blocksById = new Map(blocks.map((b) => [b.id, b]));
  const lookup = { schema, blocksById };

  const models: Graph['models'] = [];
  const modelIndex = new Map<string, number>();
  for (const t of schema.itemTypes.values()) {
    if (t.isBlock) continue;
    modelIndex.set(t.id, models.length);
    models.push({ itemTypeId: t.id, apiKey: t.apiKey, name: t.name, count: 0 });
  }

  const nodes: Graph['nodes'] = [];
  const nodeIndex = new Map<string, number>();
  const kept: { item: RawItem; itemType: SchemaItemType }[] = [];
  for (const item of items) {
    const itemType = schema.itemTypes.get(item.item_type.id);
    if (!itemType || itemType.isBlock) continue;
    nodeIndex.set(item.id, nodes.length);
    nodes.push({
      id: item.id,
      title: titleOf(item, itemType, schema.locales),
      itemTypeId: itemType.id,
      status: statusOf(item),
    });
    models[modelIndex.get(itemType.id) as number].count++;
    kept.push({ item, itemType });
  }

  const fields: Graph['fields'] = [];
  const fieldIndex = new Map<string, number>();
  const fieldFor = (apiKey: string, isPseudo: boolean): number => {
    const key = `${isPseudo ? 'p' : 'r'}:${apiKey}`;
    let idx = fieldIndex.get(key);
    if (idx === undefined) {
      idx = fields.length;
      fields.push({ apiKey, isPseudo });
      fieldIndex.set(key, idx);
    }
    return idx;
  };

  const edges: Graph['edges'] = [];
  const seen = new Set<string>();
  const addEdge = (source: number, target: number, apiKey: string, isPseudo: boolean) => {
    const key = `${source}|${target}|${isPseudo ? 'p' : 'r'}:${apiKey}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ source, target, field: fieldFor(apiKey, isPseudo) });
  };

  kept.forEach(({ item, itemType }, source) => {
    const values = item as unknown as Record<string, unknown>;
    for (const link of extractLinks(itemType, values, lookup)) {
      const target = nodeIndex.get(link.targetId);
      if (target === undefined) continue;
      addEdge(source, target, link.fieldApiKey, false);
    }
    if (itemType.isTree) {
      const parentId = values.parent_id;
      if (typeof parentId === 'string') {
        const target = nodeIndex.get(parentId);
        if (target !== undefined) addEdge(source, target, PARENT_FIELD_KEY, true);
      }
    }
  });

  return { models, fields, nodes, edges };
}
