import { describe, expect, it } from 'vitest';
import { createGenerationGuard } from './generationGuard';

describe('createGenerationGuard', () => {
  it('accepts only the latest token', () => {
    const guard = createGenerationGuard();
    const a = guard.next();
    expect(guard.isCurrent(a)).toBe(true);
    const b = guard.next();
    expect(guard.isCurrent(a)).toBe(false);
    expect(guard.isCurrent(b)).toBe(true);
  });
  it('next() without a run of its own invalidates the previous one (cleanup)', () => {
    const guard = createGenerationGuard();
    const a = guard.next();
    guard.next();
    expect(guard.isCurrent(a)).toBe(false);
  });
});
