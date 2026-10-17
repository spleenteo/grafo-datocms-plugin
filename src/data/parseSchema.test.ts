import { describe, expect, it } from 'vitest';
import type { RawApiTypes } from '@datocms/cma-client-browser';
import { parseSchema } from './parseSchema';

const ref = (type: string, id: string) => ({ data: { type, id } });
const none = { data: null };

function itemType(
  id: string,
  apiKey: string,
  opts: { block?: boolean; tree?: boolean; title?: string; presentation?: string } = {},
) {
  return {
    type: 'item_type',
    id,
    attributes: { api_key: apiKey, name: apiKey.toUpperCase(), modular_block: !!opts.block, tree: !!opts.tree },
    relationships: {
      presentation_title_field: opts.presentation ? ref('field', opts.presentation) : none,
      title_field: opts.title ? ref('field', opts.title) : none,
    },
  };
}

function field(id: string, itemTypeId: string, apiKey: string, fieldType: string, localized = false) {
  return {
    type: 'field',
    id,
    attributes: { api_key: apiKey, field_type: fieldType, localized },
    relationships: { item_type: ref('item_type', itemTypeId), fieldset: none },
  };
}

const site = {
  data: { type: 'site', id: 's', attributes: { locales: ['en', 'it'] } },
  included: [
    itemType('m1', 'article', { title: 'f2', presentation: 'f1' }),
    itemType('b1', 'hero', { block: true }),
    itemType('t1', 'category', { tree: true, title: 'f4' }),
    { type: 'upload', id: 'u1', attributes: {}, relationships: {} },
    field('f1', 'm1', 'headline', 'string', true),
    field('f2', 'm1', 'slug_title', 'string'),
    field('f3', 'b1', 'cta', 'link'),
    field('f4', 't1', 'label', 'string'),
  ],
} as unknown as RawApiTypes.SiteSelfTargetSchema;

describe('parseSchema', () => {
  const schema = parseSchema(site);

  it('reads locales and ignores unrelated resources', () => {
    expect(schema.locales).toEqual(['en', 'it']);
    expect([...schema.itemTypes.keys()]).toEqual(['m1', 'b1', 't1']);
  });

  it('flags block and tree models', () => {
    expect(schema.itemTypes.get('b1')?.isBlock).toBe(true);
    expect(schema.itemTypes.get('t1')?.isTree).toBe(true);
    expect(schema.itemTypes.get('m1')?.isBlock).toBe(false);
  });

  it('groups fields per item type and reads the localized flag', () => {
    const article = schema.itemTypes.get('m1');
    expect(article?.fields.map((f) => [f.apiKey, f.isLocalized])).toEqual([
      ['headline', true],
      ['slug_title', false],
    ]);
  });

  it('prefers presentation_title_field, falls back to title_field, else null', () => {
    expect(schema.itemTypes.get('m1')?.titleFieldApiKey).toBe('headline');
    expect(schema.itemTypes.get('t1')?.titleFieldApiKey).toBe('label');
    expect(schema.itemTypes.get('b1')?.titleFieldApiKey).toBeNull();
  });
});
