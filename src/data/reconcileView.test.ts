import { describe, expect, it } from 'vitest';
import { allFilters } from './filterGraph';
import { reconcileFilters, reconcileSelection } from './reconcileView';
import type { Graph } from './types';

const g = (ids: string[]): Graph => ({
  models: ids.map((id) => ({ itemTypeId: id, apiKey: id, name: id, count: 0 })),
  fields: [],
  nodes: [],
  edges: [],
});
const visible = (core: string[], context: string[] = []) => ({
  coreIds: new Set(core),
  contextIds: new Set(context),
});

describe('reconcileFilters', () => {
  it('returns the stored filters untouched for the same graph', () => {
    const graph = g(['a']);
    const stored = allFilters(graph);
    const out = reconcileFilters(graph, graph, stored);
    expect(out.isRemap).toBe(false);
    expect(out.filters).toBe(stored);
  });
  it('remaps onto a refreshed graph', () => {
    const prev = g(['a', 'b']);
    const stored = { ...allFilters(prev), models: new Set([1]) }; // a off
    const out = reconcileFilters(prev, g(['b', 'a']), stored);
    expect(out.isRemap).toBe(true);
    expect([...out.filters.models]).toEqual([0]);
  });
});

describe('reconcileSelection', () => {
  it('Reload keeps a selection even if outside the filtered set', () => {
    expect(reconcileSelection('r1', true, visible([]))).toBe('r1');
  });
  it('user filter change clears a selection not in the filtered set', () => {
    expect(reconcileSelection('r1', false, visible(['r2'], ['r3']))).toBeNull();
  });
  it('user filter change keeps a selection in core or context', () => {
    expect(reconcileSelection('r1', false, visible(['r1']))).toBe('r1');
    expect(reconcileSelection('r1', false, visible([], ['r1']))).toBe('r1');
  });
  it('no selection stays none', () => {
    expect(reconcileSelection(null, false, visible([]))).toBeNull();
  });
});
