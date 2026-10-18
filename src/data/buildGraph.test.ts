import { describe, expect, it } from 'vitest';
import { buildGraph } from './buildGraph';
import type { RawItem, Schema, SchemaItemType } from './types';

const f = (apiKey: string, fieldType: string, isLocalized = false) => ({
  id: `f-${apiKey}`,
  apiKey,
  fieldType,
  isLocalized,
});
const t = (id: string, over: Partial<SchemaItemType>): SchemaItemType => ({
  id,
  apiKey: id,
  name: id.toUpperCase(),
  isBlock: false,
  isTree: false,
  titleFieldApiKey: 'title',
  fields: [f('title', 'string')],
  ...over,
});
const mk = (schemaTypes: SchemaItemType[]): Schema => ({
  locales: ['en', 'it'],
  itemTypes: new Map(schemaTypes.map((x) => [x.id, x])),
});
const item = (id: string, typeId: string, extra: Record<string, unknown> = {}) =>
  ({ id, item_type: { id: typeId }, meta: { status: 'published' }, ...extra }) as unknown as RawItem;

describe('buildGraph', () => {
  const article = t('article', {
    fields: [f('title', 'string'), f('author', 'link'), f('parent', 'link')],
  });
  const unused = t('unused', {});
  const blk = t('blk', { isBlock: true, fields: [f('ref', 'link')] });

  it('counts models (including empty ones, excluding blocks) and builds nodes', () => {
    const g = buildGraph(mk([article, unused, blk]), [
        item('1', 'article', {
          title: 'One',
          meta: {
            status: 'published',
            created_at: '2026-01-01T10:00:00Z',
            updated_at: '2026-01-02T10:00:00Z',
            published_at: null,
          },
          creator: { type: 'user', id: 'u1' },
        }),
      ], []);
    expect(g.models.map((m) => [m.apiKey, m.count])).toEqual([
      ['article', 1],
      ['unused', 0],
    ]);
    expect(g.nodes).toEqual([
      {
        id: '1',
        title: 'One',
        itemTypeId: 'article',
        model: 0,
        status: 'published',
        createdAt: '2026-01-01T10:00:00Z',
        updatedAt: '2026-01-02T10:00:00Z',
        publishedAt: null,
        creator: { type: 'user', id: 'u1' },
      },
    ]);
    for (const node of g.nodes) {
      expect(g.models[node.model].itemTypeId).toBe(node.itemTypeId);
    }
  });

  it('builds edges for link fields', () => {
    const g = buildGraph(
      mk([article]),
      [item('1', 'article', { author: '2' }), item('2', 'article')],
      [],
    );
    expect(g.fields).toEqual([{ apiKey: 'author', isPseudo: false }]);
    expect(g.edges).toEqual([{ source: 0, target: 1, field: 0 }]);
  });

  it('attributes block links to the top-level field', () => {
    const withBlocks = t('doc', {
      fields: [f('title', 'string'), f('sections', 'rich_text')],
    });
    const g = buildGraph(
      mk([withBlocks, blk]),
      [item('1', 'doc', { sections: ['b1'] }), item('2', 'doc')],
      [item('b1', 'blk', { ref: '2' })],
    );
    expect(g.fields).toEqual([{ apiKey: 'sections', isPseudo: false }]);
    expect(g.edges).toEqual([{ source: 0, target: 1, field: 0 }]);
  });

  it('turns parent_id into a pseudo-field edge, distinct from a real parent field', () => {
    const tree = t('tree', {
      isTree: true,
      fields: [f('title', 'string'), f('parent', 'link')],
    });
    const g = buildGraph(
      mk([tree]),
      [
        item('1', 'tree'),
        item('2', 'tree', { parent_id: '1', parent: '1' }),
      ],
      [],
    );
    expect(g.fields).toEqual([
      { apiKey: 'parent', isPseudo: false },
      { apiKey: 'parent', isPseudo: true },
    ]);
    expect(g.edges).toEqual([
      { source: 1, target: 0, field: 0 },
      { source: 1, target: 0, field: 1 },
    ]);
  });

  it('drops dangling targets', () => {
    const g = buildGraph(mk([article]), [item('1', 'article', { author: 'gone' })], []);
    expect(g.edges).toEqual([]);
    expect(g.fields).toEqual([]);
  });

  it('dedupes edges on (source, target, field) and keeps self-links', () => {
    const multi = t('multi', { fields: [f('title', 'string'), f('rel', 'links')] });
    const g = buildGraph(
      mk([multi]),
      [item('1', 'multi', { rel: ['1', '1'] })],
      [],
    );
    expect(g.edges).toEqual([{ source: 0, target: 0, field: 0 }]);
  });

  it('takes the first non-empty localized title in site locale order', () => {
    const loc = t('loc', { fields: [f('title', 'string', true)] });
    const g = buildGraph(
      mk([loc]),
      [item('1', 'loc', { title: { en: '', it: 'Ciao' } })],
      [],
    );
    expect(g.nodes[0].title).toBe('Ciao');
  });

  it('falls back to Untitled <name>', () => {
    const g = buildGraph(mk([article]), [item('1', 'article', { title: '  ' })], []);
    expect(g.nodes[0].title).toBe('Untitled ARTICLE');
  });

  it('keeps draft and updated, maps null to published', () => {
    const mkS = (id: string, status: string | null) =>
      ({ ...item(id, 'article'), meta: { status } }) as unknown as RawItem;
    const g = buildGraph(
      mk([article]),
      [mkS('1', 'draft'), mkS('2', 'updated'), mkS('3', null)],
      [],
    );
    expect(g.nodes.map((n) => n.status)).toEqual(['draft', 'updated', 'published']);
  });
});
