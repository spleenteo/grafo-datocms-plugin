import { describe, expect, it } from 'vitest';
import { expandAround } from './expandAround';
import { allFilters, filterGraph, type Filters } from './filterGraph';
import type { Graph, NodeStatus } from './types';

const node = (id: string, model: number, status: NodeStatus = 'published') => ({
  id,
  title: id,
  itemTypeId: `t${model}`,
  model,
  status,
  createdAt: null,
  updatedAt: null,
  publishedAt: null,
  creator: null,
});

// plan(0,M0) feat(1,M1) tag(2,M2) draftTag(3,M2,draft) other(4,M2)
const graph: Graph = {
  models: [0, 1, 2].map((i) => ({ itemTypeId: `t${i}`, apiKey: `m${i}`, name: `M${i}`, count: 1 })),
  fields: [
    { apiKey: 'features', isPseudo: false },
    { apiKey: 'tags', isPseudo: false },
    { apiKey: 'related', isPseudo: false },
  ],
  nodes: [node('plan', 0), node('feat', 1), node('tag', 2), node('draftTag', 2, 'draft'), node('other', 2)],
  edges: [
    { source: 0, target: 1, field: 0 }, // 0 plan->feat
    { source: 1, target: 2, field: 1 }, // 1 feat->tag
    { source: 1, target: 3, field: 1 }, // 2 feat->draftTag
    { source: 4, target: 1, field: 2 }, // 3 other->feat
    { source: 1, target: 1, field: 2 }, // 4 self
    { source: 2, target: 4, field: 2 }, // 5 tag->other (not touching feat)
  ],
};

// Isolated to M0 (pricing plans), linked records as context.
const planOnly = (patch: Partial<Filters> = {}): Filters => ({
  ...allFilters(graph),
  models: new Set([0]),
  ...patch,
});
const ids = (s: Set<string>) => [...s].sort();

describe('expandAround', () => {
  it('adds the relations of a context node, both directions', () => {
    const filters = planOnly();
    const visible = filterGraph(graph, filters);
    expect(ids(visible.contextIds)).toEqual(['feat']);
    const out = expandAround(graph, visible, 1, filters);
    expect(ids(out.coreIds)).toEqual(['plan']);
    expect(ids(out.contextIds)).toEqual(['draftTag', 'feat', 'other', 'tag']);
    expect(out.edgeIndexes).toEqual([0, 1, 2, 3]);
  });

  it('makes a node outside the visible set context itself', () => {
    const filters = planOnly({ showsOutside: false });
    const visible = filterGraph(graph, filters);
    expect(visible.contextIds.size).toBe(0);
    const out = expandAround(graph, visible, 2, filters);
    expect(ids(out.coreIds)).toEqual(['plan']);
    expect(ids(out.contextIds)).toEqual(['feat', 'other', 'tag']);
    expect(out.edgeIndexes).toEqual([1, 5]);
  });

  it('honours the status filter', () => {
    const filters = planOnly({ statuses: new Set<NodeStatus>(['published', 'updated']) });
    const out = expandAround(graph, filterGraph(graph, filters), 1, filters);
    expect(ids(out.contextIds)).toEqual(['feat', 'other', 'tag']);
    expect(out.edgeIndexes).toEqual([0, 1, 3]);
  });

  it('honours the field filter', () => {
    const filters = planOnly({ fields: new Set([0, 2]) });
    const out = expandAround(graph, filterGraph(graph, filters), 1, filters);
    expect(ids(out.contextIds)).toEqual(['feat', 'other']);
    expect(out.edgeIndexes).toEqual([0, 3]);
  });

  it('ignores self-links', () => {
    const filters = planOnly({ fields: new Set([2]), showsOutside: false });
    const visible = filterGraph(graph, filters);
    const out = expandAround(graph, visible, 1, filters);
    expect(out.edgeIndexes).toEqual([3]);
    expect(ids(out.contextIds)).toEqual(['feat', 'other']);
  });

  it('keeps core nodes core and the sets disjoint', () => {
    const filters = { ...allFilters(graph), models: new Set([0, 1]) };
    const out = expandAround(graph, filterGraph(graph, filters), 1, filters);
    expect(ids(out.coreIds)).toEqual(['feat', 'plan']);
    expect(ids(out.contextIds)).toEqual(['draftTag', 'other', 'tag']);
  });

  it('returns the same set when nothing is added', () => {
    const filters = allFilters(graph);
    const visible = filterGraph(graph, filters);
    expect(expandAround(graph, visible, 1, filters)).toBe(visible);
    const expanded = expandAround(graph, filterGraph(graph, planOnly()), 1, planOnly());
    expect(expandAround(graph, expanded, 1, planOnly())).toBe(expanded);
  });

  it('returns the same set for an unknown index', () => {
    const visible = filterGraph(graph, allFilters(graph));
    expect(expandAround(graph, visible, 99, allFilters(graph))).toBe(visible);
  });
});
