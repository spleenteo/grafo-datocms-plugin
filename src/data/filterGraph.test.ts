import { describe, expect, it } from 'vitest';
import {
  allFilters,
  filterGraph,
  sameVisibleSet,
  type Filters,
} from './filterGraph';
import type { Graph, NodeStatus } from './types';

const node = (id: string, model: number, status: NodeStatus = 'published') => ({
  id,
  title: id,
  itemTypeId: `t${model}`,
  model,
  status,
});

// a(0,M0) b(1,M0) c(2,M1) d(3,M1,draft)
const graph: Graph = {
  models: [0, 1].map((i) => ({ itemTypeId: `t${i}`, apiKey: `m${i}`, name: `M${i}`, count: 2 })),
  fields: [
    { apiKey: 'f0', isPseudo: false },
    { apiKey: 'f1', isPseudo: false },
  ],
  nodes: [node('a', 0), node('b', 0), node('c', 1), node('d', 1, 'draft')],
  edges: [
    { source: 0, target: 1, field: 0 }, // 0 a->b
    { source: 0, target: 2, field: 1 }, // 1 a->c
    { source: 2, target: 0, field: 0 }, // 2 c->a
    { source: 1, target: 3, field: 0 }, // 3 b->d
    { source: 2, target: 2, field: 0 }, // 4 self
  ],
};

const with_ = (patch: Partial<Filters>): Filters => ({ ...allFilters(graph), ...patch });
const ids = (s: Set<string>) => [...s].sort();

describe('filterGraph', () => {
  it('shows all non-self edges with all filters', () => {
    const v = filterGraph(graph, allFilters(graph));
    expect(v.edgeIndexes).toEqual([0, 1, 2, 3]);
    expect(ids(v.coreIds)).toEqual(['a', 'b', 'c', 'd']);
    expect(v.contextIds.size).toBe(0);
  });

  it('never shows self-links', () => {
    const v = filterGraph(graph, with_({ models: new Set([1]), statuses: new Set<NodeStatus>(['published']) }));
    expect(v.edgeIndexes).toEqual([]);
  });

  it('removes a model and its links', () => {
    const v = filterGraph(graph, with_({ models: new Set([0]) }));
    expect(ids(v.coreIds)).toEqual(['a', 'b']);
    expect(v.edgeIndexes).toEqual([0]);
  });

  it('removes a status', () => {
    const v = filterGraph(graph, with_({ statuses: new Set<NodeStatus>(['published', 'updated']) }));
    expect(ids(v.coreIds)).toEqual(['a', 'b', 'c']);
    expect(v.edgeIndexes).toEqual([0, 1, 2]);
  });

  it('removes a field', () => {
    const v = filterGraph(graph, with_({ fields: new Set([1]) }));
    expect(v.edgeIndexes).toEqual([1]);
  });

  it('outside both adds context from either direction', () => {
    const v = filterGraph(graph, with_({ models: new Set([0]), showsOutside: true }));
    expect(ids(v.coreIds)).toEqual(['a', 'b']);
    expect(ids(v.contextIds)).toEqual(['c', 'd']);
    expect(v.edgeIndexes).toEqual([0, 1, 2, 3]);
  });

  it('outside out keeps links whose core end is the source', () => {
    const v = filterGraph(graph, with_({ models: new Set([0]), showsOutside: true, direction: 'out' }));
    expect(ids(v.contextIds)).toEqual(['c', 'd']);
    expect(v.edgeIndexes).toEqual([0, 1, 3]);
  });

  it('outside in keeps links whose core end is the target', () => {
    const v = filterGraph(graph, with_({ models: new Set([0]), showsOutside: true, direction: 'in' }));
    expect(ids(v.contextIds)).toEqual(['c']);
    expect(v.edgeIndexes).toEqual([0, 2]);
  });

  it('outside respects status on the context end', () => {
    const v = filterGraph(
      graph,
      with_({ models: new Set([0]), showsOutside: true, statuses: new Set<NodeStatus>(['published']) }),
    );
    expect(ids(v.contextIds)).toEqual(['c']);
    expect(v.edgeIndexes).toEqual([0, 1, 2]);
  });

  it('hide orphans drops core and context orphans', () => {
    const v = filterGraph(graph, with_({ fields: new Set([1]), hidesOrphans: true }));
    expect(ids(v.coreIds)).toEqual(['a', 'c']);
    const w = filterGraph(
      graph,
      with_({ models: new Set([0]), showsOutside: true, fields: new Set([1]), hidesOrphans: true }),
    );
    expect(ids(w.coreIds)).toEqual(['a']);
    expect(ids(w.contextIds)).toEqual(['c']);
  });
});

describe('sameVisibleSet', () => {
  it('is true for equal content and false otherwise', () => {
    const a = filterGraph(graph, allFilters(graph));
    const b = filterGraph(graph, allFilters(graph));
    expect(sameVisibleSet(a, b)).toBe(true);
    expect(sameVisibleSet(a, filterGraph(graph, with_({ models: new Set([0]) })))).toBe(false);
  });
});
