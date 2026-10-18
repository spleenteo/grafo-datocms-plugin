import { describe, expect, it } from 'vitest';
import { pickLabelBudget } from './labelBudget';

const view = { x0: 0, y0: 0, x1: 100, y1: 100 };
const at = (id: string, degree: number, x = 50, y = 50) => ({ id, degree, x, y });

describe('pickLabelBudget', () => {
  it('never picks nodes outside the view', () => {
    const picked = pickLabelBudget([at('in', 1), at('out', 99, 150, 50)], view, 5);
    expect([...picked]).toEqual(['in']);
  });
  it('includes nodes on the view edge', () => {
    expect(pickLabelBudget([at('edge', 1, 0, 100)], view, 5).has('edge')).toBe(true);
  });
  it('keeps the highest degrees when more nodes than budget are in view', () => {
    const picked = pickLabelBudget([at('a', 1), at('b', 9), at('c', 5)], view, 2);
    expect([...picked].sort()).toEqual(['b', 'c']);
  });
  it('returns every in-view node when fewer than the budget', () => {
    expect(pickLabelBudget([at('a', 1), at('b', 2)], view, 10).size).toBe(2);
  });
  it('breaks degree ties by id', () => {
    const picked = pickLabelBudget([at('c', 3), at('a', 3), at('b', 3)], view, 2);
    expect([...picked].sort()).toEqual(['a', 'b']);
  });
  it('returns nothing for a budget of 0', () => {
    expect(pickLabelBudget([at('a', 1)], view, 0).size).toBe(0);
  });
});
