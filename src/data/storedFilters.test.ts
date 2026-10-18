import { describe, expect, it } from 'vitest';
import { allFilters } from './filterGraph';
import { deserializeFilters, serializeFilters, startingKeyOf } from './storedFilters';
import type { Graph } from './types';

const mk = (n: number): Graph => ({
  models: Array.from({ length: n }, (_, i) => ({ itemTypeId: `t${i}`, apiKey: `m${i}`, name: `M${i}`, count: 1 })),
  fields: [
    { apiKey: 'f0', isPseudo: false },
    { apiKey: 'f0', isPseudo: true },
  ],
  nodes: [],
  edges: [],
});
const graph = mk(3);
const key = startingKeyOf(['b', 'a']);

describe('storedFilters', () => {
  it('builds the starting key sorted', () => {
    expect(key).toBe('a,b');
  });

  it('round-trips through JSON', () => {
    const f = {
      ...allFilters(graph),
      models: new Set([0, 2]),
      fields: new Set([1]),
      statuses: new Set(['draft' as const]),
      showsOutside: false,
      direction: 'in' as const,
      hidesOrphans: true,
    };
    const stored = JSON.parse(JSON.stringify(serializeFilters(graph, f, key)));
    expect(deserializeFilters(graph, stored, key)).toEqual(f);
  });

  it('brings up a model added after saving', () => {
    const f = { ...allFilters(graph), models: new Set([0]) };
    const stored = serializeFilters(graph, f, key);
    const out = deserializeFilters(mk(4), stored, key);
    expect([...out!.models]).toEqual([0, 3]);
  });

  it('ignores unknown models', () => {
    const stored = { ...serializeFilters(graph, allFilters(graph), key), offModels: ['gone', 'm1'] };
    expect([...deserializeFilters(graph, stored, key)!.models]).toEqual([0, 2]);
  });

  it('returns null on starting key mismatch', () => {
    expect(deserializeFilters(graph, serializeFilters(graph, allFilters(graph), key), 'a')).toBeNull();
  });

  it('returns null when no model is left on', () => {
    const stored = { ...serializeFilters(graph, allFilters(graph), key), offModels: ['m0', 'm1', 'm2'] };
    expect(deserializeFilters(graph, stored, key)).toBeNull();
  });

  it('returns null on bad status or direction', () => {
    const ok = serializeFilters(graph, allFilters(graph), key);
    expect(deserializeFilters(graph, { ...ok, statuses: ['nope'] }, key)).toBeNull();
    expect(deserializeFilters(graph, { ...ok, direction: 'up' }, key)).toBeNull();
  });

  it('returns null on bad shape', () => {
    const ok = serializeFilters(graph, allFilters(graph), key);
    for (const bad of [null, 'x', 3, [], {}, { ...ok, v: 2 }, { ...ok, offModels: 'm0' }, { ...ok, offFields: [['a']] }, { ...ok, showsOutside: 1 }]) {
      expect(deserializeFilters(graph, bad, key)).toBeNull();
    }
  });
});
