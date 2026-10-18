import { describe, expect, it } from 'vitest';
import { readAccess } from './readAccess';

const ENV = 'main';
const models = ['m1', 'm2', 'm3'];
const pos = (extra: Record<string, unknown> = {}) => ({
  action: 'read',
  environment: ENV,
  on_creator: 'anyone',
  ...extra,
});
const run = (positive: unknown[], negative: unknown[] = [], ids = models) =>
  readAccess(
    { positive_item_type_permissions: positive, negative_item_type_permissions: negative },
    ENV,
    ids,
  );
const ids = (r: ReturnType<typeof run>) => [...r.readableModelIds].sort();

describe('readAccess', () => {
  it('admin-like all on every model is full read', () => {
    const r = run([pos({ action: 'all', item_type: null })]);
    expect(ids(r)).toEqual(models);
    expect(r.isFullRead).toBe(true);
  });

  it('per-model entries covering every model are full read', () => {
    const r = run(models.map((m) => pos({ item_type: m })));
    expect(r.isFullRead).toBe(true);
  });

  it('read on one model is that model only, not full read', () => {
    const r = run([pos({ item_type: 'm2' })]);
    expect(ids(r)).toEqual(['m2']);
    expect(r.isFullRead).toBe(false);
  });

  it('negative read on one model removes it and breaks full read', () => {
    const r = run([pos({ item_type: null })], [{ action: 'read', environment: ENV, item_type: 'm2' }]);
    expect(ids(r)).toEqual(['m1', 'm3']);
    expect(r.isFullRead).toBe(false);
  });

  it('negative entry without item_type covers every model', () => {
    const neg = { action: 'all', environment: ENV };
    expect(ids(run([pos()], [neg]))).toEqual([]);
    expect(ids(run([pos()], [{ ...neg, item_type: null }]))).toEqual([]);
    expect(run([pos()], [neg]).isFullRead).toBe(false);
  });

  it('ignores entries for other environments', () => {
    const r = run([pos({ environment: 'other' })], [
      { action: 'all', environment: 'other' },
    ]);
    expect(ids(r)).toEqual([]);
    const r2 = run([pos()], [{ action: 'all', environment: 'other' }]);
    expect(r2.isFullRead).toBe(true);
  });

  it('on_creator self is readable but not full read', () => {
    const r = run([pos({ on_creator: 'self' })]);
    expect(ids(r)).toEqual(models);
    expect(r.isFullRead).toBe(false);
  });

  it('workflow entry is neither readable nor full read', () => {
    const r = run([pos({ workflow: 'w1' })]);
    expect(ids(r)).toEqual([]);
    expect(r.isFullRead).toBe(false);
    const r2 = run([pos(), pos({ item_type: 'm1', workflow: 'w1' })]);
    expect(r2.isFullRead).toBe(true);
  });

  it('on_stage makes it not full read but still readable', () => {
    const r = run([pos({ action: 'all', on_stage: 's1' })]);
    expect(ids(r)).toEqual(models);
    expect(r.isFullRead).toBe(false);
  });

  it('malformed entry is not full read', () => {
    const r = run([pos(), 'junk', { action: 1, environment: ENV }]);
    expect(ids(r)).toEqual(models);
    expect(r.isFullRead).toBe(false);
    expect(run([pos(), { action: 'read' }]).isFullRead).toBe(false);
    expect(run([pos(), null], []).isFullRead).toBe(false);
  });

  it('malformed negative entry is not full read', () => {
    expect(run([pos()], [42]).isFullRead).toBe(false);
  });

  it('empty lists read nothing', () => {
    const r = run([]);
    expect(ids(r)).toEqual([]);
    expect(r.isFullRead).toBe(false);
  });

  it('non-read actions are ignored', () => {
    const r = run([pos({ action: 'update' })]);
    expect(ids(r)).toEqual([]);
    expect(r.isFullRead).toBe(false);
  });
});
