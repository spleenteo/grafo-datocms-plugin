import { describe, expect, it } from 'vitest';
import { buildAdjacency, diffSets } from './adjacency';

describe('buildAdjacency', () => {
  it('lists neighbours both ways, once each, in first-link order', () => {
    const { neighbours } = buildAdjacency([
      { source: 'a', target: 'b', edge: 0 },
      { source: 'c', target: 'a', edge: 1 },
      { source: 'a', target: 'b', edge: 2 },
    ]);
    expect(neighbours.get('a')).toEqual(['b', 'c']);
    expect(neighbours.get('b')).toEqual(['a']);
    expect(neighbours.get('c')).toEqual(['a']);
  });
  it('keeps every incident edge, parallel links included', () => {
    const { incident } = buildAdjacency([
      { source: 'a', target: 'b', edge: 0 },
      { source: 'b', target: 'a', edge: 5 },
    ]);
    expect(incident.get('a')).toEqual([0, 5]);
    expect(incident.get('b')).toEqual([0, 5]);
  });
  it('never lists a node as its own neighbour', () => {
    const { neighbours, incident } = buildAdjacency([{ source: 'a', target: 'a', edge: 3 }]);
    expect(neighbours.get('a')).toBeUndefined();
    expect(incident.get('a')).toEqual([3]);
  });
});

describe('diffSets', () => {
  it('splits the symmetric difference', () => {
    expect(diffSets(new Set(['a', 'b']), new Set(['b', 'c']))).toEqual({ added: ['c'], removed: ['a'] });
  });
  it('is empty for equal sets', () => {
    expect(diffSets(new Set([1, 2]), new Set([2, 1]))).toEqual({ added: [], removed: [] });
  });
});
