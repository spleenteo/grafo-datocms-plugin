import { describe, expect, it, vi } from 'vitest';
import { loadGraphKey } from './loadGraph';
import { createLoadMemo } from './loadMemo';

const deferred = <T>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('createLoadMemo', () => {
  it('shares one load per key and skips the loader on a hit', async () => {
    const memo = createLoadMemo<string>();
    const loader = vi.fn(async () => 'a');
    expect(await memo.load('k', loader)).toBe('a');
    expect(await memo.load('k', loader)).toBe('a');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('evicts a failed non-fresh load so the next call retries', async () => {
    const memo = createLoadMemo<string>();
    await expect(memo.load('k', () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    await flush();
    expect(await memo.load('k', async () => 'ok')).toBe('ok');
  });

  it('a fresh load bypasses the memo and replaces the entry on success', async () => {
    const memo = createLoadMemo<string>();
    await memo.load('k', async () => 'old');
    expect(await memo.load('k', async () => 'new', true)).toBe('new');
    await flush();
    const loader = vi.fn(async () => 'never');
    expect(await memo.load('k', loader)).toBe('new');
    expect(loader).not.toHaveBeenCalled();
  });

  it('a failed fresh load keeps the existing good entry', async () => {
    const memo = createLoadMemo<string>();
    await memo.load('k', async () => 'good');
    await expect(memo.load('k', () => Promise.reject(new Error('x')), true)).rejects.toThrow('x');
    await flush();
    expect(await memo.load('k', async () => 'never')).toBe('good');
  });

  it('the latest fresh load wins even when an older one finishes last', async () => {
    const memo = createLoadMemo<string>();
    const first = deferred<string>();
    const second = deferred<string>();
    const p1 = memo.load('k', () => first.promise, true);
    const p2 = memo.load('k', () => second.promise, true);
    second.resolve('second');
    await p2;
    first.resolve('first');
    await p1;
    await flush();
    expect(await memo.load('k', async () => 'never')).toBe('second');
  });

  it('keeps keys independent', async () => {
    const memo = createLoadMemo<string>();
    await memo.load('a', async () => 'A');
    expect(await memo.load('b', async () => 'B')).toBe('B');
  });
});

describe('loadGraphKey', () => {
  const perms = { positive_item_type_permissions: [], negative_item_type_permissions: [] } as never;
  const base = () => loadGraphKey('main', undefined, 'u1', perms, ['x', 'y']);

  it('is stable for equal inputs and ignores the order of excluded models', () => {
    expect(loadGraphKey('main', undefined, 'u1', perms, ['y', 'x'])).toBe(base());
  });
  it('changes with environment, endpoint, user, permissions and exclusions', () => {
    const other = {
      positive_item_type_permissions: [{ role: 'x' }],
      negative_item_type_permissions: [],
    } as never;
    const keys = [
      base(),
      loadGraphKey('sandbox', undefined, 'u1', perms, ['x', 'y']),
      loadGraphKey('main', 'https://cma.example', 'u1', perms, ['x', 'y']),
      loadGraphKey('main', undefined, 'u2', perms, ['x', 'y']),
      loadGraphKey('main', undefined, 'u1', other, ['x', 'y']),
      loadGraphKey('main', undefined, 'u1', perms, ['x']),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });
});
