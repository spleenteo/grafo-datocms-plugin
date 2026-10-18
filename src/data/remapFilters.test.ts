import { describe, expect, it } from 'vitest';
import { allFilters } from './filterGraph';
import { remapFilters } from './remapFilters';
import type { Graph } from './types';

const m = (id: string, apiKey = id) => ({ itemTypeId: id, apiKey, name: apiKey, count: 0 });
const g = (models: string[], fields: { apiKey: string; isPseudo: boolean; model?: number }[]): Graph => ({
  models: models.map((id) => m(id)),
  fields: fields.map((x) => ({ apiKey: x.apiKey, isPseudo: x.isPseudo, model: x.model ?? 0, label: x.apiKey })),
  nodes: [],
  edges: [],
});

describe('remapFilters', () => {
  it('keeps an off model off across reordered models, new model on, removed dropped', () => {
    const prev = g(['a', 'b', 'c'], []);
    const f = { ...allFilters(prev), models: new Set([0, 2]) }; // b off
    const next = g(['d', 'c', 'b', 'a'], []); // a removed? no: a kept; d new
    const out = remapFilters(prev, next, f);
    expect([...out.models].sort()).toEqual([0, 1, 3]); // d on, c on, b(2) off, a on
    const next2 = g(['c', 'b'], []);
    expect([...remapFilters(prev, next2, f).models]).toEqual([0]);
  });
  it('keeps pseudo parent distinct from a real parent field', () => {
    const prev = g(['a'], [
      { apiKey: 'parent', isPseudo: true },
      { apiKey: 'parent', isPseudo: false },
    ]);
    const f = { ...allFilters(prev), fields: new Set([1]) };
    const next = g(['a'], [
      { apiKey: 'parent', isPseudo: false },
      { apiKey: 'parent', isPseudo: true },
      { apiKey: 'new', isPseudo: false },
    ]);
    expect([...remapFilters(prev, next, f).fields].sort()).toEqual([0, 2]);
  });
  it('keeps a per-model field off across a refresh and turns new fields on', () => {
    const prev = g(['a', 'b'], [
      { apiKey: 'category', isPseudo: false, model: 0 },
      { apiKey: 'category', isPseudo: false, model: 1 },
    ]);
    const f = { ...allFilters(prev), fields: new Set([0]) }; // b's category off
    const next = g(['b', 'a'], [
      { apiKey: 'category', isPseudo: false, model: 0 }, // b
      { apiKey: 'category', isPseudo: false, model: 1 }, // a
      { apiKey: 'tags', isPseudo: false, model: 1 },
    ]);
    expect([...remapFilters(prev, next, f).fields].sort()).toEqual([1, 2]);
  });
  it('copies scalar filters into new sets', () => {
    const prev = g(['a'], []);
    const f = { ...allFilters(prev), statuses: new Set(['draft' as const]), showsOutside: false, direction: 'out' as const, hidesOrphans: true };
    const out = remapFilters(prev, prev, f);
    expect(out.statuses).not.toBe(f.statuses);
    expect([...out.statuses]).toEqual(['draft']);
    expect(out.showsOutside).toBe(false);
    expect(out.direction).toBe('out');
    expect(out.hidesOrphans).toBe(true);
  });
});
