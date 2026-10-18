/** Counter for "latest wins": a result applies only if no newer run started since. */
export type GenerationGuard = {
  /** Starts a run and returns its token; every earlier token becomes stale. */
  next(): number;
  isCurrent(token: number): boolean;
};

export function createGenerationGuard(): GenerationGuard {
  let current = 0;
  return {
    next: () => ++current,
    isCurrent: (token) => token === current,
  };
}
