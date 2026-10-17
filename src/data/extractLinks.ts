import type { RawItem, Schema, SchemaItemType } from './types';

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

const STRUCTURED_LINK_TYPES = new Set(['itemLink', 'inlineItem']);
const STRUCTURED_BLOCK_TYPES = new Set(['block', 'inlineBlock']);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function visitBlock(blockId: unknown, c: Collector): void {
  if (typeof blockId !== 'string' || c.visitedBlocks.has(blockId)) return;
  const block = c.lookup.blocksById.get(blockId);
  if (!block) return;
  c.visitedBlocks.add(blockId);
  const blockType = c.lookup.schema.itemTypes.get(block.item_type.id);
  if (!blockType) return;
  collectFields(blockType, block as unknown as Record<string, unknown>, c);
}

function walkDast(node: unknown, c: Collector): void {
  if (!isObject(node)) return;
  const type = node.type;
  if (typeof type === 'string') {
    if (STRUCTURED_LINK_TYPES.has(type) && typeof node.item === 'string') {
      c.targets.add(node.item);
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
      if (isObject(value)) walkDast(value.document, c);
      break;
  }
}

function collectFields(
  itemType: SchemaItemType,
  values: Record<string, unknown>,
  c: Collector,
): void {
  for (const field of itemType.fields) {
    const value = values[field.apiKey];
    if (value === null || value === undefined) continue;
    if (field.isLocalized) {
      if (!isObject(value)) continue;
      for (const localeValue of Object.values(value)) {
        collectValue(field.fieldType, localeValue, c);
      }
    } else {
      collectValue(field.fieldType, value, c);
    }
  }
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
  for (const field of itemType.fields) {
    const c: Collector = {
      lookup,
      visitedBlocks: new Set(),
      targets: new Set(),
    };
    collectFields({ ...itemType, fields: [field] }, values, c);
    for (const targetId of c.targets) {
      result.push({ fieldApiKey: field.apiKey, targetId });
    }
  }
  return result;
}
