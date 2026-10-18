import type { RawItem, Schema, SchemaField, SchemaItemType } from './types';
import { isRecord } from './types';

export type ExtractedLink = { fieldApiKey: string; targetId: string };

export type ExtractLookup = {
  schema: Schema;
  blocksById: Map<string, RawItem>;
};

type Collector = {
  lookup: ExtractLookup;
  visitedBlocks: Set<string>;
  targets: Set<string>;
};

const RELATION_FIELD_TYPES = new Set([
  'link',
  'links',
  'rich_text',
  'single_block',
  'structured_text',
]);

const relationFieldsCache = new WeakMap<SchemaItemType, SchemaField[]>();

/** Fields that can hold a link, computed once per item type. */
function relationFields(itemType: SchemaItemType): SchemaField[] {
  let list = relationFieldsCache.get(itemType);
  if (!list) {
    list = itemType.fields.filter((f) => RELATION_FIELD_TYPES.has(f.fieldType));
    relationFieldsCache.set(itemType, list);
  }
  return list;
}

const STRUCTURED_LINK_TYPES = new Set(['itemLink', 'inlineItem']);
const STRUCTURED_BLOCK_TYPES = new Set(['block', 'inlineBlock']);

type ResolvedBlock = { id: string; itemTypeId: string; values: Record<string, unknown> };

function idOf(value: unknown): string | null {
  if (isRecord(value) && typeof value.id === 'string') return value.id;
  return null;
}

/**
 * Item type of an inline block from a `nested: true` listing:
 * `relationships.item_type.data.id`, else `__itemTypeId`, else a flattened `item_type.id`.
 */
function inlineItemTypeId(block: Record<string, unknown>): string | null {
  const relationships = block.relationships;
  if (isRecord(relationships) && isRecord(relationships.item_type)) {
    const id = idOf(relationships.item_type.data);
    if (id !== null) return id;
  }
  if (typeof block.__itemTypeId === 'string') return block.__itemTypeId;
  return idOf(block.item_type);
}

/** A block reference is a block ID (flat listing) or an inline block object (nested listing). */
function resolveBlock(ref: unknown, lookup: ExtractLookup): ResolvedBlock | null {
  if (typeof ref === 'string') {
    const block = lookup.blocksById.get(ref);
    if (!block) return null;
    const values: Record<string, unknown> = block;
    return { id: ref, itemTypeId: block.item_type.id, values };
  }
  if (!isRecord(ref) || typeof ref.id !== 'string') return null;
  const itemTypeId = inlineItemTypeId(ref);
  if (itemTypeId === null) return null;
  const values = isRecord(ref.attributes) ? ref.attributes : ref;
  return { id: ref.id, itemTypeId, values };
}

function visitBlock(ref: unknown, c: Collector): void {
  const block = resolveBlock(ref, c.lookup);
  if (!block || c.visitedBlocks.has(block.id)) return;
  c.visitedBlocks.add(block.id);
  const blockType = c.lookup.schema.itemTypes.get(block.itemTypeId);
  if (!blockType) return;
  collectFields(blockType, block.values, c);
}

function walkDast(node: unknown, c: Collector): void {
  if (!isRecord(node)) return;
  const type = node.type;
  if (typeof type === 'string') {
    if (STRUCTURED_LINK_TYPES.has(type)) {
      const target = typeof node.item === 'string' ? node.item : idOf(node.item);
      if (target !== null) c.targets.add(target);
    } else if (STRUCTURED_BLOCK_TYPES.has(type)) {
      visitBlock(node.item, c);
    }
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) walkDast(child, c);
  }
}

function collectValue(fieldType: string, value: unknown, c: Collector): void {
  if (value === null || value === undefined) return;
  switch (fieldType) {
    case 'link':
      if (typeof value === 'string') c.targets.add(value);
      break;
    case 'links':
      if (Array.isArray(value)) {
        for (const id of value) if (typeof id === 'string') c.targets.add(id);
      }
      break;
    case 'rich_text':
      if (Array.isArray(value)) for (const id of value) visitBlock(id, c);
      break;
    case 'single_block':
      visitBlock(value, c);
      break;
    case 'structured_text':
      if (isRecord(value)) walkDast(value.document, c);
      break;
  }
}

function collectField(field: SchemaField, values: Record<string, unknown>, c: Collector): void {
  const value = values[field.apiKey];
  if (value === null || value === undefined) return;
  if (field.isLocalized) {
    if (!isRecord(value)) return;
    for (const localeValue of Object.values(value)) {
      collectValue(field.fieldType, localeValue, c);
    }
  } else {
    collectValue(field.fieldType, value, c);
  }
}

function collectFields(
  itemType: SchemaItemType,
  values: Record<string, unknown>,
  c: Collector,
): void {
  for (const field of relationFields(itemType)) collectField(field, values, c);
}

/**
 * Links of one record, attributed to its top-level field (links found inside
 * nested blocks count for the field holding the block). Deduped per field.
 */
export function extractLinks(
  itemType: SchemaItemType,
  values: Record<string, unknown>,
  lookup: ExtractLookup,
): ExtractedLink[] {
  const result: ExtractedLink[] = [];
  const c: Collector = { lookup, visitedBlocks: new Set(), targets: new Set() };
  for (const field of relationFields(itemType)) {
    if (values[field.apiKey] == null) continue;
    c.visitedBlocks.clear();
    c.targets.clear();
    collectField(field, values, c);
    for (const targetId of c.targets) {
      result.push({ fieldApiKey: field.apiKey, targetId });
    }
  }
  return result;
}
