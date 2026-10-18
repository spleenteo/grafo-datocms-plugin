import { describe, expect, it } from 'vitest';
import { fieldStats, linksInto } from './fieldStats';
import type { Graph } from './types';

const node = (id: string, model: number) => ({
  id,
  title: id,
  itemTypeId: String(model),
  model,
  status: 'published' as const,
  createdAt: null,
  updatedAt: null,
  publishedAt: null,
  creator: null,
});

const graph: Graph = {
  models: [
    { itemTypeId: '0', apiKey: 'a', name: 'A', count: 2 },
    { itemTypeId: '1', apiKey: 'b', name: 'B', count: 1 },
  ],
  fields: [
    { apiKey: 'f', isPseudo: false, model: 0, label: 'F' },
    { apiKey: 'g', isPseudo: false, model: 1, label: 'G' },
  ],
  nodes: [node('a1', 0), node('a2', 0), node('b1', 1)],
  edges: [
    { source: 0, target: 2, field: 0 },
    { source: 0, target: 1, field: 0 },
    { source: 2, target: 0, field: 1 },
    { source: 2, target: 2, field: 1 },
  ],
};

describe('fieldStats', () => {
  it('counts relations per field without self-links', () => {
    expect(fieldStats(graph).counts).toEqual([2, 1]);
  });

  it('collects the models each field links to', () => {
    const { targets } = fieldStats(graph);
    expect([...targets[0]].sort()).toEqual([0, 1]);
    expect([...targets[1]]).toEqual([0]);
  });
});

describe('linksInto', () => {
  it('is true when a target model is selected', () => {
    expect(linksInto(new Set([0, 1]), new Set([1]))).toBe(true);
  });

  it('is false when no target model is selected', () => {
    expect(linksInto(new Set([0]), new Set([1]))).toBe(false);
  });
});
