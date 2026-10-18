import { describe, expect, it } from 'vitest';
import { autoDistance } from './autoDistance';

describe('autoDistance', () => {
  it('packs a large view', () => {
    expect(autoDistance(197, 1100)).toBe(0.6);
  });
  it('spreads a small view', () => {
    expect(autoDistance(25, 1100)).toBeCloseTo(1.7, 5);
  });
  it('clamps a single node at the maximum', () => {
    expect(autoDistance(1, 1100)).toBe(2.5);
  });
  it('falls back to 1.6 with no nodes', () => {
    expect(autoDistance(0, 1100)).toBe(1.6);
    expect(autoDistance(-3, 1100)).toBe(1.6);
  });
  it('clamps a tiny canvas at the minimum', () => {
    expect(autoDistance(197, 100)).toBe(0.4);
  });
  it('rounds to steps of 0.05', () => {
    const d = autoDistance(60, 900);
    expect(Math.round(d * 20) / 20).toBe(d);
  });
});
