import { describe, expect, it } from 'vitest';
import { extractLinks } from './extractLinks';
import type { RawItem, Schema, SchemaItemType } from './types';

const f = (apiKey: string, fieldType: string, isLocalized = false) => ({
  id: `f-${apiKey}`,
  apiKey,
  label: apiKey,
  fieldType,
  isLocalized,
});

const page: SchemaItemType = {
  id: 'page',
  apiKey: 'page',
  name: 'Page',
  isBlock: false,
  isTree: false,
  titleFieldApiKey: 'title',
  fields: [
    f('title', 'string'),
    f('author', 'link'),
    f('related', 'links'),
    f('body', 'structured_text'),
    f('sections', 'rich_text'),
    f('hero', 'single_block'),
    f('lauthor', 'link', true),
  ],
};
const blockA: SchemaItemType = {
  ...page,
  id: 'blockA',
  apiKey: 'block_a',
  name: 'Block A',
  isBlock: true,
  fields: [f('ref', 'link'), f('inner', 'structured_text'), f('hero', 'single_block')],
};
const schema: Schema = {
  locales: ['en', 'it'],
  itemTypes: new Map([
    ['page', page],
    ['blockA', blockA],
  ]),
};
const block = (id: string, extra: Record<string, unknown>) =>
  ({ id, item_type: { id: 'blockA' }, ...extra }) as unknown as RawItem;
const lookupWith = (blocks: RawItem[]) => ({
  schema,
  blocksById: new Map(blocks.map((b) => [b.id, b])),
});
const dast = (...children: unknown[]) => ({
  schema: 'dast',
  document: { type: 'root', children },
});

describe('extractLinks', () => {
  it('reads link and links', () => {
    const out = extractLinks(page, { author: 'a1', related: ['r1', 'r2'] }, lookupWith([]));
    expect(out).toEqual([
      { fieldApiKey: 'author', targetId: 'a1' },
      { fieldApiKey: 'related', targetId: 'r1' },
      { fieldApiKey: 'related', targetId: 'r2' },
    ]);
  });

  it('reads itemLink and inlineItem in Structured Text', () => {
    const body = dast({
      type: 'paragraph',
      children: [
        { type: 'span', value: 'x' },
        { type: 'itemLink', item: 's1', children: [{ type: 'span', value: 'y' }] },
        { type: 'inlineItem', item: 's2' },
      ],
    });
    const out = extractLinks(page, { body }, lookupWith([]));
    expect(out).toEqual([
      { fieldApiKey: 'body', targetId: 's1' },
      { fieldApiKey: 'body', targetId: 's2' },
    ]);
  });

  it('follows a modular content block with a link', () => {
    const out = extractLinks(
      page,
      { sections: ['b1', 'missing'] },
      lookupWith([block('b1', { ref: 'x1' })]),
    );
    expect(out).toEqual([{ fieldApiKey: 'sections', targetId: 'x1' }]);
  });

  it('attributes links in a block nested in a block inside Structured Text to the top-level field', () => {
    const viaField = block('b2', { ref: 'deep-field' });
    const viaInline = block('b3', { ref: 'deep-inline' });
    const outer = block('b1', {
      hero: 'b2',
      inner: dast({ type: 'inlineBlock', item: 'b3' }),
    });
    const out = extractLinks(
      page,
      { body: dast({ type: 'block', item: 'b1' }) },
      lookupWith([outer, viaField, viaInline]),
    );
    expect(out).toHaveLength(2);
    expect(out).toContainEqual({ fieldApiKey: 'body', targetId: 'deep-field' });
    expect(out).toContainEqual({ fieldApiKey: 'body', targetId: 'deep-inline' });
  });

  it('unions localized values without duplicates', () => {
    const out = extractLinks(
      page,
      { lauthor: { en: 'a1', it: 'a2' } },
      lookupWith([]),
    );
    expect(out).toEqual([
      { fieldApiKey: 'lauthor', targetId: 'a1' },
      { fieldApiKey: 'lauthor', targetId: 'a2' },
    ]);
    expect(
      extractLinks(page, { lauthor: { en: 'a1', it: 'a1' } }, lookupWith([])),
    ).toHaveLength(1);
  });

  it('survives block cycles', () => {
    const b = block('b1', { hero: 'b1', ref: 'x' });
    const out = extractLinks(page, { hero: 'b1' }, lookupWith([b]));
    expect(out).toEqual([{ fieldApiKey: 'hero', targetId: 'x' }]);
  });

  describe('nested listing (inline block objects)', () => {
    const inline = (id: string, attributes: Record<string, unknown>) => ({
      type: 'item',
      id,
      attributes,
      relationships: { item_type: { data: { id: 'blockA', type: 'item_type' } } },
      __itemTypeId: 'blockA',
    });

    it('follows an inline modular content block with a link', () => {
      const out = extractLinks(
        page,
        { sections: [inline('b1', { ref: 'x1' }), inline('b2', { ref: null })] },
        lookupWith([]),
      );
      expect(out).toEqual([{ fieldApiKey: 'sections', targetId: 'x1' }]);
    });

    it('follows a Structured Text block node holding an object with a nested inline block', () => {
      const deep = inline('b2', { ref: 'deep-field' });
      const outer = inline('b1', {
        hero: deep,
        inner: dast({ type: 'inlineBlock', item: inline('b3', { ref: 'deep-inline' }) }),
      });
      const out = extractLinks(page, { body: dast({ type: 'block', item: outer }) }, lookupWith([]));
      expect(out).toHaveLength(2);
      expect(out).toContainEqual({ fieldApiKey: 'body', targetId: 'deep-field' });
      expect(out).toContainEqual({ fieldApiKey: 'body', targetId: 'deep-inline' });
    });

    it('reads itemLink and inlineItem whose item is an object', () => {
      const body = dast({
        type: 'paragraph',
        children: [
          { type: 'itemLink', item: { id: 's1', type: 'item' }, children: [] },
          { type: 'inlineItem', item: 's2' },
        ],
      });
      expect(extractLinks(page, { body }, lookupWith([]))).toEqual([
        { fieldApiKey: 'body', targetId: 's1' },
        { fieldApiKey: 'body', targetId: 's2' },
      ]);
    });

    it('resolves the block type from __itemTypeId when relationships are absent', () => {
      const out = extractLinks(
        page,
        { hero: { type: 'item', id: 'b1', __itemTypeId: 'blockA', attributes: { ref: 'x' } } },
        lookupWith([]),
      );
      expect(out).toEqual([{ fieldApiKey: 'hero', targetId: 'x' }]);
    });

    it('skips inline blocks of unknown type and visits a repeated block once', () => {
      const unknown = { ...inline('b9', { ref: 'nope' }), relationships: undefined, __itemTypeId: 'zzz' };
      const b = inline('b1', { ref: 'x' });
      const out = extractLinks(page, { sections: [unknown, b, b] }, lookupWith([]));
      expect(out).toEqual([{ fieldApiKey: 'sections', targetId: 'x' }]);
    });
  });
});
