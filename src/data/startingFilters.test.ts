import { describe, expect, it } from 'vitest';
import { LARGE_GRAPH_RECORDS, startingFilters } from './startingFilters';
import type { Graph } from './types';

const graph: Graph = {
  models: [0, 1, 2].map((i) => ({ itemTypeId: `t${i}`, apiKey: `m${i}`, name: `M${i}`, count: 1 })),
  fields: [{ apiKey: 'f0', isPseudo: false, model: 0, label: 'f0' }],
  nodes: [],
  edges: [],
};

// `linked` records joined in a chain, the rest orphans.
function chain(total: number, linked: number): Graph {
  const nodes = Array.from({ length: total }, (_, i) => ({
    id: String(i),
    title: `n${i}`,
    itemTypeId: 't0',
    model: i % 3,
    status: 'published' as const,
    createdAt: null,
    updatedAt: null,
    publishedAt: null,
    creator: null,
  }));
  const edges = Array.from({ length: linked - 1 }, (_, i) => ({ source: i, target: i + 1, field: 0 }));
  return { ...graph, nodes, edges };
}

describe('startingFilters', () => {
  it('selects the configured model', () => {
    const f = startingFilters(graph, ['m1']);
    expect([...f.models]).toEqual([1]);
    expect(f.showsOutside).toBe(true);
    expect(f.direction).toBe('both');
  });

  it('falls back to all models for unknown or empty keys', () => {
    expect([...startingFilters(graph, ['nope']).models]).toEqual([0, 1, 2]);
    expect([...startingFilters(graph, []).models]).toEqual([0, 1, 2]);
  });

  it('ignores unknown keys next to known ones', () => {
    expect([...startingFilters(graph, ['m0', 'nope']).models]).toEqual([0]);
  });

  it('shows orphans on a small graph unless they are over half the records', () => {
    expect(startingFilters(graph, []).hidesOrphans).toBe(false);
    expect(startingFilters(chain(10, 5), []).hidesOrphans).toBe(false);
    expect(startingFilters(chain(10, 4), []).hidesOrphans).toBe(true);
  });

  it('starts a large graph without models, or on the configured ones without orphans', () => {
    const large = chain(LARGE_GRAPH_RECORDS + 1, 2);
    expect([...startingFilters(large, []).models]).toEqual([]);
    expect([...startingFilters(large, ['nope']).models]).toEqual([]);
    const configured = startingFilters(large, ['m1']);
    expect([...configured.models]).toEqual([1]);
    expect(configured.hidesOrphans).toBe(true);
  });
});
