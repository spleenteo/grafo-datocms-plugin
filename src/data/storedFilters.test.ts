import { describe, expect, it } from 'vitest';
import { allFilters } from './filterGraph';
import { deserializeFilters, serializeFilters, startingKeyOf } from './storedFilters';
import type { Graph } from './types';

const mk = (n: number): Graph => ({
  models: Array.from({ length: n }, (_, i) => ({ itemTypeId: `t${i}`, apiKey: `m${i}`, name: `M${i}`, count: 1 })),
  fields: [
    { apiKey: 'f0', isPseudo: false, model: 0, label: 'F0' },
    { apiKey: 'f0', isPseudo: true, model: 0, label: 'parent (tree)' },
    { apiKey: 'f0', isPseudo: false, model: 1, label: 'F0 too' },
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
      fields: new Set([1, 2]),
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

  it('writes v2 with per-model keys', () => {
    const f = { ...allFilters(graph), fields: new Set([1]) };
    expect(serializeFilters(graph, f, key).offFields).toEqual([
      ['m0', 'f0', false],
      ['m1', 'f0', false],
    ]);
  });

  it('reads a v1 payload: switches off every field with that api key and pseudo flag', () => {
    const v1 = { ...serializeFilters(graph, allFilters(graph), key), v: 1, offFields: [['f0', false]] };
    expect([...deserializeFilters(graph, v1, key)!.fields]).toEqual([1]);
  });

  it('rejects a v1 payload with v2 entries and the reverse', () => {
    const ok = serializeFilters(graph, allFilters(graph), key);
    expect(deserializeFilters(graph, { ...ok, v: 1, offFields: [['m0', 'f0', false]] }, key)).toBeNull();
    expect(deserializeFilters(graph, { ...ok, offFields: [['f0', false]] }, key)).toBeNull();
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
    for (const bad of [null, 'x', 3, [], {}, { ...ok, v: 3 }, { ...ok, offModels: 'm0' }, { ...ok, offFields: [['a']] }, { ...ok, offFields: [['a', true]] }, { ...ok, showsOutside: 1 }]) {
      expect(deserializeFilters(graph, bad, key)).toBeNull();
    }
  });
});
