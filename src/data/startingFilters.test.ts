import { describe, expect, it } from 'vitest';
import { startingFilters } from './startingFilters';
import type { Graph } from './types';

const graph: Graph = {
  models: [0, 1, 2].map((i) => ({ itemTypeId: `t${i}`, apiKey: `m${i}`, name: `M${i}`, count: 1 })),
  fields: [{ apiKey: 'f0', isPseudo: false, model: 0, label: 'f0' }],
  nodes: [],
  edges: [],
};

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
});
