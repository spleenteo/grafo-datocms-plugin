import { describe, expect, it } from 'vitest';
import { nodeIndexById, relationsOf } from './relationsOf';
import type { Graph } from './types';

const node = (id: string, title: string) => ({
  id,
  title,
  itemTypeId: 't',
  model: 0,
  status: 'published' as const,
});

const graph: Graph = {
  models: [{ itemTypeId: 't', apiKey: 'm', name: 'M', count: 4 }],
  fields: [
    { apiKey: 'zeta', isPseudo: false },
    { apiKey: 'alpha', isPseudo: false },
  ],
  nodes: [node('a', 'A'), node('b', 'B'), node('c', 'C'), node('d', 'D')],
  edges: [
    { source: 0, target: 2, field: 0 }, // a->c zeta
    { source: 0, target: 1, field: 0 }, // a->b zeta
    { source: 0, target: 3, field: 1 }, // a->d alpha
    { source: 0, target: 0, field: 0 }, // self
    { source: 3, target: 0, field: 1 }, // d->a alpha
    { source: 1, target: 2, field: 0 }, // unrelated
  ],
};

describe('nodeIndexById', () => {
  it('maps ids to indexes', () => {
    expect(nodeIndexById(graph).get('c')).toBe(2);
  });
});

describe('relationsOf', () => {
  it('splits in/out, drops self-links, sorts by field then title', () => {
    const { outgoing, incoming } = relationsOf(graph, 0);
    expect(outgoing).toEqual([
      { nodeIndex: 3, field: 1 },
      { nodeIndex: 1, field: 0 },
      { nodeIndex: 2, field: 0 },
    ]);
    expect(incoming).toEqual([{ nodeIndex: 3, field: 1 }]);
  });
});
