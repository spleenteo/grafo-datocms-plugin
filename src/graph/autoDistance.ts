// Calibrated on the owner's checks (canvas ≈ 1100 px): the layout extent grows
// as √n · 40 · D, so the distance that fills the canvas side is side / (k · √n).
const SCALE = 130;
const MIN = 0.4;
const MAX = 2.5;
const FALLBACK = 1.6;

/** Node distance for `visibleCount` nodes on a square canvas of side `canvasSide` px, in steps of 0.05. */
export function autoDistance(visibleCount: number, canvasSide: number): number {
  if (!(visibleCount > 0) || !(canvasSide > 0)) return FALLBACK;
  const raw = canvasSide / (SCALE * Math.sqrt(visibleCount));
  const clamped = Math.min(MAX, Math.max(MIN, raw));
  return Math.round(clamped * 20) / 20;
}
