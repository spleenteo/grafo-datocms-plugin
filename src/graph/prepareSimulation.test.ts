import { describe, expect, it } from 'vitest';
import type { Graph } from '../data/types';
import { prepareSimulation, relativeRadius } from './prepareSimulation';

const model = (apiKey: string, count: number) => ({
  itemTypeId: apiKey,
  apiKey,
  name: apiKey,
  count,
});
const node = (id: string, m = 0) => ({
  id,
  title: id,
  itemTypeId: 'x',
  model: m,
  status: 'published' as const,
});

function graph(overrides: Partial<Graph> = {}): Graph {
  return {
    models: [model('a', 3)],
    fields: [{ apiKey: 'f', isPseudo: false }],
    nodes: [node('1'), node('2'), node('3')],
    edges: [
      { source: 0, target: 1, field: 0 },
      { source: 1, target: 2, field: 0 },
      { source: 2, target: 2, field: 0 },
    ],
    ...overrides,
  };
}

describe('prepareSimulation', () => {
  it('does not mutate the input graph', () => {
    const g = graph();
    const copy = structuredClone(g);
    prepareSimulation(g);
    expect(g).toEqual(copy);
  });

  it('excludes self-links from links and degree', () => {
    const { nodes, links } = prepareSimulation(graph());
    expect(links).toHaveLength(2);
    expect(nodes.map((n) => n.degree)).toEqual([1, 2, 1]);
    expect(links[0]).toMatchObject({ source: '1', target: '2', field: 0, edge: 0 });
    expect(links[1]).toMatchObject({ source: '2', target: '3', field: 0, edge: 1 });
  });

  it('keeps the original edge index when a self-link comes first', () => {
    const { links } = prepareSimulation(
      graph({
        edges: [
          { source: 0, target: 0, field: 0 },
          { source: 0, target: 1, field: 0 },
          { source: 1, target: 1, field: 0 },
          { source: 1, target: 2, field: 0 },
        ],
      }),
    );
    expect(links.map((l) => l.edge)).toEqual([1, 3]);
    expect(links[1]).toMatchObject({ source: '2', target: '3', edge: 3 });
  });

  it('counts duplicate edges on different fields separately', () => {
    const { nodes, links } = prepareSimulation(
      graph({
        fields: [
          { apiKey: 'f', isPseudo: false },
          { apiKey: 'g', isPseudo: false },
        ],
        edges: [
          { source: 0, target: 1, field: 0 },
          { source: 0, target: 1, field: 1 },
        ],
      }),
    );
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.field)).toEqual([0, 1]);
    expect(nodes[0].degree).toBe(2);
  });

  it('sizes radii relative to the most-connected node', () => {
    const nodes = Array.from({ length: 101 }, (_, i) => node(String(i)));
    const edges = Array.from({ length: 100 }, (_, i) => ({ source: 0, target: i + 1, field: 0 }));
    const res = prepareSimulation(graph({ nodes, edges }));
    expect(res.nodes[0].degree).toBe(100);
    expect(res.nodes[0].r).toBe(24);
    expect(res.nodes[1].r).toBeCloseTo(3 + 21 * 0.1);
  });

  it('orders colours by count desc then apiKey, including empty models', () => {
    const { colorIndex } = prepareSimulation(
      graph({
        models: [model('b', 5), model('a', 5), model('z', 9), model('empty', 0)],
        nodes: [],
        edges: [],
      }),
    );
    expect(colorIndex).toEqual([2, 1, 0, 3]);
  });
});

describe('relativeRadius', () => {
  it('is 3 with no relations', () => {
    expect(relativeRadius(0, 10)).toBe(3);
  });

  it('is 24 at the max degree', () => {
    expect(relativeRadius(10, 10)).toBe(24);
  });

  it('is 13.5 at a quarter of the max degree', () => {
    expect(relativeRadius(5, 20)).toBe(13.5);
  });

  it('is 3 when the max degree is 0', () => {
    expect(relativeRadius(0, 0)).toBe(3);
  });
});
