/** A node the renderer offers for a Smart label. Callers skip nodes with no position yet. */
export interface LabelCandidate {
  id: string;
  /** The record's total relations (the same value that sizes the node). */
  degree: number;
  x: number;
  y: number;
}

/** Visible rectangle in graph units, edges inclusive. */
export interface ViewBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Ids of the `budget` highest-degree nodes inside `view`; ties go to the smaller id. */
export function pickLabelBudget(
  nodes: readonly LabelCandidate[],
  view: ViewBox,
  budget: number,
): Set<string> {
  if (!(budget > 0)) return new Set();
  const inView = nodes.filter(
    (n) => n.x >= view.x0 && n.x <= view.x1 && n.y >= view.y0 && n.y <= view.y1,
  );
  inView.sort((a, b) => b.degree - a.degree || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return new Set(inView.slice(0, budget).map((n) => n.id));
}
