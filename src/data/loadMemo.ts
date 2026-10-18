/**
 * Per-key memo of in-flight and finished loads. A normal load shares the entry;
 * a fresh load bypasses it, and only the latest fresh load of a key may replace
 * it on success. A failed fresh load keeps the existing entry, a failed normal
 * one is evicted.
 */
export type LoadMemo<T> = {
  load(key: string, loader: () => Promise<T>, fresh?: boolean): Promise<T>;
};

export function createLoadMemo<T>(): LoadMemo<T> {
  const memo = new Map<string, Promise<T>>();
  // Latest fresh load per key: only that one may write its result to the memo.
  const freshTokens = new Map<string, number>();
  let freshSeq = 0;

  return {
    load(key, loader, fresh) {
      if (fresh) {
        freshSeq += 1;
        const token = freshSeq;
        freshTokens.set(key, token);
        const promise = loader();
        promise.then(
          (result) => {
            if (freshTokens.get(key) === token) memo.set(key, Promise.resolve(result));
          },
          () => {},
        );
        return promise;
      }
      const cached = memo.get(key);
      if (cached) return cached;
      const promise = loader();
      memo.set(key, promise);
      promise.catch(() => {
        if (memo.get(key) === promise) memo.delete(key);
      });
      return promise;
    },
  };
}
