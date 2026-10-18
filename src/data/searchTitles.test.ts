import { describe, expect, it } from 'vitest';
import { searchTitles } from './searchTitles';
import type { Graph } from './types';

const node = (id: string, title: string) => ({
  id,
  title,
  itemTypeId: 't',
  model: 0,
  status: 'published' as const,
  createdAt: null,
  updatedAt: null,
  publishedAt: null,
  creator: null,
});
const graph: Graph = {
  models: [{ itemTypeId: 't', apiKey: 'a', name: 'A', count: 4 }],
  fields: [],
  nodes: [node('1', 'Hello World'), node('2', 'other'), node('3', 'say HELLO'), node('4', 'hello hidden')],
  edges: [],
};
const visible = new Set(['1', '2', '3']);

describe('searchTitles', () => {
  it('matches case-insensitively in nodes order', () => {
    expect(searchTitles(graph, visible, 'hello')).toEqual(['1', '3']);
  });
  it('includes any visible id (core or context) and excludes hidden', () => {
    expect(searchTitles(graph, visible, 'hello')).not.toContain('4');
  });
  it('searches every record with a null scope', () => {
    expect(searchTitles(graph, null, 'hello')).toEqual(['1', '3', '4']);
  });
  it('trims the query', () => {
    expect(searchTitles(graph, visible, '  WORLD ')).toEqual(['1']);
  });
  it('returns [] for blank query', () => {
    expect(searchTitles(graph, visible, '')).toEqual([]);
    expect(searchTitles(graph, visible, '   ')).toEqual([]);
  });
});
