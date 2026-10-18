/**
 * Colour for the model at `colorPosition` (its rank in `colorIndex`): golden-angle
 * hue, lightness alternating between two steps. Saturation and lightness come
 * from `--node-*` custom properties on `:root`, so the theme switch recolours
 * the rail and the graph alike.
 */
export function modelColor(colorPosition: number): string {
  const hue = Math.round((colorPosition * 137.508 + 12) % 360);
  const l = colorPosition % 2 === 0 ? 'var(--node-l0)' : 'var(--node-l1)';
  return `hsl(${hue} var(--node-s) ${l})`;
}
