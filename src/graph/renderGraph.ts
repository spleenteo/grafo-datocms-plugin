import { drag } from 'd3-drag';
import type { D3DragEvent } from 'd3-drag';
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from 'd3-force';
import { select } from 'd3-selection';
// Side effect: patches `selection.transition()` and `selection.interrupt()`.
import 'd3-transition';
import type { EnterElement, Selection } from 'd3-selection';
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
import type { D3ZoomEvent, ZoomTransform } from 'd3-zoom';
import { sameSet, sameVisibleSet } from '../data/filterGraph';
import type { VisibleSet } from '../data/filterGraph';
import { buildAdjacency, diffSets } from './adjacency';
import styles from './graph.module.css';
import { modelColor } from './modelColor';
import { relativeRadius } from './prepareSimulation';
import type { prepareSimulation, SimLink, SimNode } from './prepareSimulation';

export type LabelMode = 'smart' | 'all' | 'focus';

export interface Point {
  x: number;
  y: number;
}

export interface ViewTransform {
  x: number;
  y: number;
  k: number;
}

export interface ViewState {
  transform: ViewTransform;
  userMoved: boolean;
}

export interface RenderGraphOptions {
  modelName: (model: number) => string;
  /** Node click or Enter/Space → its id; background click → null. The renderer does not change its own selection. */
  onSelect: (id: string | null) => void;
  /** Initial view state, applied at mount without reheating. */
  labelMode?: LabelMode;
  distance?: number;
  matchIds?: ReadonlySet<string>;
  /** Seeded mount (refresh): with positions the mount skips the pre-tick and the initial fit and settles at a low alpha, following and fitting at end unless `initialUserMoved`. */
  initialPositions?: ReadonlyMap<string, Point>;
  initialTransform?: ViewTransform;
  initialUserMoved?: boolean;
  /** Visible set at mount (default: every node); a following `update()` with the same set is a no-op. */
  initialVisible?: VisibleSet;
}

export interface RenderGraphHandle {
  /**
   * Applies a new visible set on the running simulation; a no-op when it equals the last applied one.
   * Entering nodes start next to the selected node (else next to a visible neighbour). With a focus
   * target the camera follows and ends on the focus box instead of the global fit; after `holdView()`
   * it stays put.
   */
  update(visible: VisibleSet): void;
  /**
   * Marks a node as selected (halo, focus when nothing is hovered); an id outside the visible set counts
   * as null until an update makes it visible. null also clears the focus target.
   */
  setSelection(id: string | null): void;
  /**
   * Sets the focus target: the camera centres a visible node, at the scale that fits its visible
   * neighbours around it (clamped to [0.5, 2]; max(current, 1.2) without neighbours). When an update
   * follows (next frame), its settle follows the focus and ends on it; otherwise it animates (450 ms;
   * instant with reduced motion). Never sets `userMoved`, cancels a pending fit-on-end. A no-op for an
   * id not visible. A user gesture, fit, reframe, relayout, zoomBy or setSelection(null) clears it.
   */
  focusOn(id: string): void;
  /** The next update (this frame) settles without moving the camera: a deselect collapsing the view. */
  holdView(): void;
  /** No-op when the mode does not change. Never reheats. */
  setLabelMode(mode: LabelMode): void;
  /** Search matches: labelled, and the rest dimmed when nothing has focus. An empty set clears. No-op when the content is unchanged. */
  setQuery(matchIds: ReadonlySet<string>): void;
  /** +/− buttons: an explicit user zoom (250 ms), so it sets `userMoved`. Interrupts a running transition. */
  zoomBy(factor: number): void;
  /** Animated fit (450 ms) of the visible nodes; resets `userMoved`. Interrupts a running transition. */
  fit(): void;
  /** Random restart of the layout, then an animated camera fit; resets `userMoved`. */
  relayout(): void;
  /**
   * Explicit "show me this": resets `userMoved` so the next `update()` follows and fits even after a
   * user zoom. When no update follows (same visible set), fits right away (animated).
   */
  reframe(): void;
  /** Node distance multiplier; reheats at alpha 0.9 and serves a pending `reframe()`. No-op when the value does not change. */
  setDistance(d: number): void;
  /** x/y of every node known to this mount, visible or not. */
  positions(): Map<string, Point>;
  viewState(): ViewState;
  destroy(): void;
}

type NodeSelection = Selection<SVGGElement, SimNode, SVGGElement, unknown>;
type LinkSelection = Selection<SVGLineElement, SimLink, SVGGElement, unknown>;

// A node group and the children join() and paint() write to.
interface NodeEls {
  g: SVGGElement;
  halo: SVGCircleElement | null;
  ring: SVGCircleElement | null;
  dot: SVGCircleElement | null;
  label: SVGTextElement | null;
}

const PRETICK_MAX_NODES = 1000;
const PRETICKS = 300;
const FIT_PADDING = 40;
const FIT_MAX_SCALE = 2;
const UPDATE_ALPHA = 0.55;
const FOCUS_MIN_SCALE = 1.2;
const FOCUS_PADDING = 60;
const FOCUS_SCALE_MIN = 0.5;
const FOCUS_SCALE_MAX = 2;
const FOCUS_DURATION = 450;
const FIT_DURATION = 450;
const ZOOM_DURATION = 250;
// Camera follow during a settle: ease factor per tick, active until the simulation's `end`.
const FOLLOW_EASE = 0.12;
// The arrow tip passes the line end by (10 − refX) viewBox units; at the `hi`
// marker size (6 px per 10 units) that is 1.8 px, added to the end offset.
const ARROW_REF_X = 7;
const ARROW_SIZE = 4.5;
const ARROW_SIZE_HI = 6;
const ARROW_OVERSHOOT = ((10 - ARROW_REF_X) * ARROW_SIZE_HI) / 10;
const LABEL_MAX = 30;
// Label geometry for the fit: x offset from the node edge, width per code point
// at the 11 px font, minimum half-height.
const LABEL_GAP = 5;
const LABEL_CHAR_W = 6.2;
const LABEL_HALF_H = 8;
const PILL_PAD_X = 6;
const PILL_PAD_Y = 3;
const PILL_RADIUS = 4;
const DISTANCE_ALPHA = 0.9;
const RELAYOUT_SPREAD = 30;
const SMART_MIN_DEGREE = 10;
const SMART_MIN_SCALE = 1.8;
const SMART_MAX_NODES = 45;

function reducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function labelText(title: string): string {
  const chars = Array.from(title);
  return chars.length > LABEL_MAX ? `${chars.slice(0, LABEL_MAX - 1).join('')}…` : title;
}

/** Estimated width of the rendered label (same truncation as `labelText`, `…` counted). */
function labelWidth(title: string): number {
  return Array.from(labelText(title)).length * LABEL_CHAR_W;
}

let markerSeq = 0;

export function renderGraph(
  svgEl: SVGSVGElement,
  data: ReturnType<typeof prepareSimulation>,
  options: RenderGraphOptions,
): RenderGraphHandle {
  const { modelName, onSelect } = options;

  // Own copies: d3 writes x/y/vx/vy on nodes and swaps link ends for objects,
  // so a second mount (StrictMode) or re-render never sees mutated input.
  const nodeById = new Map<string, SimNode>();
  for (const n of data.nodes) {
    nodeById.set(n.id, {
      id: n.id,
      title: n.title,
      itemTypeId: n.itemTypeId,
      model: n.model,
      status: n.status,
      degree: n.degree,
      r: n.r,
    });
  }
  const allNodes: SimNode[] = [...nodeById.values()];
  const labelW = new Map<string, number>(allNodes.map((n) => [n.id, labelWidth(n.title)]));
  // Link ends are node ids here; forceLink swaps them for the node objects
  // above, which are stable for the life of the mount, so a link that leaves
  // and comes back keeps pointing at the same objects.
  const endId = (end: SimLink['source']): string =>
    typeof end === 'object' ? end.id : String(end);
  const linkByEdge = new Map<number, SimLink>();
  for (const l of data.links) {
    linkByEdge.set(l.edge, {
      source: endId(l.source),
      target: endId(l.target),
      field: l.field,
      edge: l.edge,
    });
  }
  const allLinks: SimLink[] = [...linkByEdge.values()];

  // Seeded nodes keep their old place; a node new to this mount starts next
  // to a seeded neighbour (or where d3 would put it when it has none). Runs
  // before the simulation initialises the nodes.
  // A mount counts as seeded only when a node of the initial visible set got a
  // position; otherwise (e.g. an empty graph that gained records) it takes the
  // normal path and ignores the carried transform and moved flag.
  const initialIds = options.initialVisible
    ? [...options.initialVisible.coreIds, ...options.initialVisible.contextIds]
    : [...nodeById.keys()];
  const initialPositions = options.initialPositions?.size
    && initialIds.some((id) => options.initialPositions?.has(id))
    ? options.initialPositions
    : undefined;
  const initialTransform = initialPositions ? options.initialTransform : undefined;
  if (initialPositions) seedPositions(initialPositions);
  function seedPositions(seed: ReadonlyMap<string, Point>) {
    for (const n of allNodes) {
      const p = seed.get(n.id);
      if (p) {
        n.x = p.x;
        n.y = p.y;
      }
    }
    for (const l of data.links) {
      const s = nodeById.get(endId(l.source));
      const t = nodeById.get(endId(l.target));
      if (!s || !t) continue;
      const [seeded, fresh] = s.x !== undefined ? [s, t] : [t, s];
      if (seeded.x === undefined || seeded.y === undefined || fresh.x !== undefined) continue;
      fresh.x = seeded.x + (Math.random() - 0.5) * 20;
      fresh.y = seeded.y + (Math.random() - 0.5) * 20;
    }
  }

  // Mutable render state: reassigned on every update, read by draw/fit.
  let visibleNodes: SimNode[] = [];
  let visibleLinks: SimLink[] = [];
  let visibleIds = new Set<string>();
  // Neighbour ids and incident edges per node over visibleLinks; rebuilt by setVisible().
  let neighbours = new Map<string, string[]>();
  let incident = new Map<string, number[]>();
  let selectedId: string | null = null;
  // Last setSelection() id, visible or not: an update may make it visible.
  let requestedId: string | null = null;
  let hoveredId: string | null = null;
  let labelMode: LabelMode = options.labelMode ?? 'smart';
  let distance = options.distance ?? 1.6;
  let matchIds: ReadonlySet<string> = new Set(options.matchIds ?? []);
  // Set by user wheel/drag on the canvas and by zoomBy; never by fit, focusOn
  // or other programmatic transforms. When set, settles don't fit on `end`.
  let userMoved = (initialPositions && options.initialUserMoved) || false;
  let scale = 1;
  // Painted state: paint() only touches what changed since. focusSet is the
  // focus + neighbours (`near`), also read by the labels-only pass.
  let focusSet = new Set<string>();
  let paintedSel: string | null = null;
  let paintedFocus: string | null = null;
  let hiEdges = new Set<number>();
  // Hover paints coalesce into one frame.
  let paintFrame: number | null = null;
  // Nodes with the `show` class from the last paintLabels(); read by the fit.
  let shownIds = new Set<string>();
  // Last smart threshold on zoom, so a zoom only repaints labels when crossing it.
  let wasSmartScale = false;
  let destroyed = false;
  // Node the camera should end on (set by focusOn). The next update's settle
  // follows it; with no update by the next frame, focusFrame animates to it.
  let focusTarget: string | null = null;
  let focusFrame: number | null = null;
  // holdView() waiting for an update(); dropped one frame later.
  let holdPending = false;
  let holdFrame: number | null = null;
  let lastApplied: VisibleSet = options.initialVisible ?? {
    coreIds: new Set(allNodes.map((n) => n.id)),
    contextIds: new Set(),
    edgeIndexes: allLinks.map((l) => l.edge),
  };
  setVisible(lastApplied);
  applyRadii();

  // Radii relative to the most-connected visible node; the DOM follows in join().
  function applyRadii() {
    let maxDegree = 0;
    for (const n of visibleNodes) maxDegree = Math.max(maxDegree, n.degree);
    for (const n of visibleNodes) n.r = relativeRadius(n.degree, maxDegree);
  }

  function setVisible(visible: VisibleSet) {
    const isVisible = (id: string) => visible.coreIds.has(id) || visible.contextIds.has(id);
    // Graph order, not set order, so the DOM order is stable across updates.
    visibleNodes = allNodes.filter((n) => isVisible(n.id));
    visibleIds = new Set(visibleNodes.map((n) => n.id));
    visibleLinks = [];
    for (const edge of visible.edgeIndexes) {
      const l = linkByEdge.get(edge);
      // Self-links have no renderer link. A link with a hidden end is
      // skipped too: its ends may already be node objects so forceLink would
      // not throw, but it would pull on a node outside the simulation.
      if (!l || !isVisible(endId(l.source)) || !isVisible(endId(l.target))) continue;
      visibleLinks.push(l);
    }
    ({ neighbours, incident } = buildAdjacency(
      visibleLinks.map((l) => ({ source: endId(l.source), target: endId(l.target), edge: l.edge })),
    ));
  }

  // Nodes entering the visible set (also ones seen before) start next to the
  // selected node, else next to a neighbour that was already visible, so an
  // expansion grows out of the record that caused it. Before simulation.nodes().
  function seedEntering(wasVisible: ReadonlySet<string>) {
    const sel = selectedId !== null ? nodeById.get(selectedId) : undefined;
    const anchorOf = (n: SimNode): SimNode | undefined => {
      if (sel && sel !== n && sel.x !== undefined && sel.y !== undefined) return sel;
      // First neighbour in link order that was visible and has a position.
      for (const other of neighbours.get(n.id) ?? []) {
        if (!wasVisible.has(other)) continue;
        const o = nodeById.get(other);
        if (o && o.x !== undefined && o.y !== undefined) return o;
      }
      return undefined;
    };
    for (const n of visibleNodes) {
      if (wasVisible.has(n.id)) continue;
      const a = anchorOf(n);
      if (!a || a.x === undefined || a.y === undefined) continue;
      n.x = a.x + (Math.random() - 0.5) * 20;
      n.y = a.y + (Math.random() - 0.5) * 20;
      n.vx = 0;
      n.vy = 0;
    }
  }

  const svg = select(svgEl);
  svg.selectAll('*').remove();
  svg.classed(styles.root, true);
  applyLabelModeClass();

  function applyLabelModeClass() {
    svg.classed(styles.labelsAll, labelMode === 'all').classed(styles.labelsFocus, labelMode === 'focus');
  }

  const markerPrefix = `cg-${++markerSeq}`;
  const defs = svg.append('defs');
  // userSpaceOnUse: the size is in px, not multiplied by the stroke width.
  function appendMarker(id: string, className: string, size: number) {
    defs
      .append('marker')
      .attr('id', id)
      .attr('class', className)
      .attr('viewBox', '0 0 10 10')
      .attr('markerUnits', 'userSpaceOnUse')
      .attr('refX', ARROW_REF_X)
      .attr('refY', 5)
      .attr('markerWidth', size)
      .attr('markerHeight', size)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0 0 L10 5 L0 10 z');
  }
  appendMarker(`${markerPrefix}-ar`, styles.arrow, ARROW_SIZE);
  appendMarker(`${markerPrefix}-ar-hi`, styles.arrowHi, ARROW_SIZE_HI);

  const viewport = svg.append('g');
  const linkLayer = viewport.append('g');
  const nodeLayer = viewport.append('g');

  const markerUrl = `url(#${markerPrefix}-ar)`;
  const markerHiUrl = `url(#${markerPrefix}-ar-hi)`;

  function enterLinks(enter: Selection<EnterElement, SimLink, SVGGElement, unknown>) {
    return enter.append('line').attr('class', styles.link).attr('marker-end', markerUrl);
  }

  // Used by mount and update. `dragBehavior` is declared further down; it is
  // only read when join() first runs, after its declaration.
  function enterNodes(enter: Selection<EnterElement, SimNode, SVGGElement, unknown>) {
    const g = enter
      .append('g')
      .attr('class', styles.node)
      .attr('data-status', (d) => d.status)
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', (d) => `${d.title}, ${modelName(d.model)}`)
      .each(function (d) {
        this.style.setProperty('--c', modelColor(data.colorIndex[d.model] ?? 0));
      });
    g.append('title').text((d) => `${d.title} · ${modelName(d.model)}`);
    g.append('circle')
      .attr('class', styles.halo)
      .attr('r', (d) => d.r + 7);
    g.filter((d) => d.status === 'updated')
      .append('circle')
      .attr('class', styles.ring)
      .attr('r', (d) => d.r + 3.5);
    g.append('circle')
      .attr('class', styles.dot)
      .attr('r', (d) => d.r);
    g.append('text')
      .attr('class', styles.label)
      .attr('x', (d) => d.r + LABEL_GAP)
      .attr('y', 4)
      .text((d) => labelText(d.title));
    g.call(dragBehavior);
    g.on('click', (event: MouseEvent, d) => {
      event.stopPropagation();
      onSelect(d.id);
    })
      .on('keydown', (event: KeyboardEvent, d) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onSelect(d.id);
      })
      .on('mouseenter', (_event: MouseEvent, d) => {
        hoveredId = d.id;
        schedulePaint();
      })
      .on('mouseleave', (_event: MouseEvent, d) => {
        if (hoveredId !== d.id) return;
        hoveredId = null;
        schedulePaint();
      })
      .on('focus', (_event: FocusEvent, d) => {
        hoveredId = d.id;
        paint();
      })
      .on('blur', (_event: FocusEvent, d) => {
        if (hoveredId !== d.id) return;
        hoveredId = null;
        paint();
      });
    g.each(function (d) {
      nodeEls.set(d.id, {
        g: this,
        halo: this.querySelector<SVGCircleElement>(`.${styles.halo}`),
        ring: this.querySelector<SVGCircleElement>(`.${styles.ring}`),
        dot: this.querySelector<SVGCircleElement>(`.${styles.dot}`),
        label: this.querySelector<SVGTextElement>(`.${styles.label}`),
      });
    });
    return g;
  }

  let linkSel: LinkSelection = linkLayer.selectAll<SVGLineElement, SimLink>('line');
  let nodeSel: NodeSelection = nodeLayer.selectAll<SVGGElement, SimNode>('g');
  // Elements of the joined nodes and links, by id and edge.
  const nodeEls = new Map<string, NodeEls>();
  let linkEls = new Map<number, SVGLineElement>();

  function join(nodesToShow: SimNode[], linksToShow: SimLink[], contextIds: Set<string>) {
    linkSel = linkLayer
      .selectAll<SVGLineElement, SimLink>('line')
      .data(linksToShow, (d) => d.edge)
      .join(enterLinks, (u) => u, (x) => x.remove());
    nodeSel = nodeLayer
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodesToShow, (d) => d.id)
      .join(
        enterNodes,
        (u) => u,
        (x) => x.each((d) => nodeEls.delete(d.id)).remove(),
      );
    const links = new Map<number, SVGLineElement>();
    linkSel.each(function (d) {
      links.set(d.edge, this);
    });
    linkEls = links;
    // Radii change on every update (relative to the visible set).
    for (const n of nodesToShow) {
      const e = nodeEls.get(n.id);
      if (!e) continue;
      e.g.classList.toggle(styles.ctx, contextIds.has(n.id));
      e.halo?.setAttribute('r', String(n.r + 7));
      e.ring?.setAttribute('r', String(n.r + 3.5));
      e.dot?.setAttribute('r', String(n.r));
      e.label?.setAttribute('x', String(n.r + LABEL_GAP));
    }
  }

  // Focus = hovered node, else selected node. Neighbours are the other ends
  // of the focus node's visible links. Everything outside focus + neighbours
  // dims through the root `focusing` class; with no focus, search misses dim
  // through the node `dim` class.
  function currentFocus() {
    const sel = selectedId !== null && visibleIds.has(selectedId) ? selectedId : null;
    const hov = hoveredId !== null && visibleIds.has(hoveredId) ? hoveredId : null;
    return { sel, focus: hov ?? sel };
  }

  function nearOf(focus: string | null): Set<string> {
    if (focus === null) return new Set();
    return new Set([focus, ...(neighbours.get(focus) ?? [])]);
  }

  function setLinkHi(edge: number, isHi: boolean) {
    const el = linkEls.get(edge);
    if (!el || el.classList.contains(styles.hi) === isHi) return;
    el.classList.toggle(styles.hi, isHi);
    el.setAttribute('marker-end', isHi ? markerHiUrl : markerUrl);
  }

  function schedulePaint() {
    if (paintFrame !== null || destroyed) return;
    paintFrame = requestAnimationFrame(() => {
      paintFrame = null;
      paint();
    });
  }

  function cancelPaintFrame() {
    if (paintFrame !== null) cancelAnimationFrame(paintFrame);
    paintFrame = null;
  }

  // Focus or selection change: touches only the nodes and links whose state
  // changed since the last paint, O(degree).
  function paint() {
    cancelPaintFrame();
    if (destroyed) return;
    const { sel, focus } = currentFocus();
    if (sel !== paintedSel) {
      if (paintedSel !== null) nodeEls.get(paintedSel)?.g.classList.remove(styles.selected);
      if (sel !== null) nodeEls.get(sel)?.g.classList.add(styles.selected);
      paintedSel = sel;
    }
    const focusChanged = focus !== paintedFocus;
    if (focusChanged) {
      if (paintedFocus !== null) nodeEls.get(paintedFocus)?.g.classList.remove(styles.focused);
      if (focus !== null) nodeEls.get(focus)?.g.classList.add(styles.focused);
      const near = nearOf(focus);
      const { added, removed } = diffSets(focusSet, near);
      for (const id of removed) nodeEls.get(id)?.g.classList.remove(styles.near);
      for (const id of added) nodeEls.get(id)?.g.classList.add(styles.near);
      focusSet = near;
      if (labelMode === 'smart' && (scale >= SMART_MIN_SCALE) !== wasSmartScale) {
        paintLabels();
      } else {
        for (const id of removed) paintLabel(id);
        for (const id of added) paintLabel(id);
      }
      const hi = new Set(focus !== null ? (incident.get(focus) ?? []) : []);
      const links = diffSets(hiEdges, hi);
      for (const edge of links.removed) setLinkHi(edge, false);
      for (const edge of links.added) setLinkHi(edge, true);
      hiEdges = hi;
      svg.classed(styles.focusing, focus !== null);
      paintedFocus = focus;
    }
    placePill(focus, focusChanged);
  }

  // Every node and link: after a join (new elements, new radii) and a query change.
  function paintAll() {
    cancelPaintFrame();
    if (destroyed) return;
    const { sel, focus } = currentFocus();
    const near = nearOf(focus);
    const hasQuery = matchIds.size > 0;
    for (const n of visibleNodes) {
      const cl = nodeEls.get(n.id)?.g.classList;
      if (!cl) continue;
      cl.toggle(styles.selected, n.id === sel);
      cl.toggle(styles.focused, n.id === focus);
      cl.toggle(styles.near, near.has(n.id));
      cl.toggle(styles.dim, hasQuery && !matchIds.has(n.id));
    }
    focusSet = near;
    paintLabels();
    hiEdges = new Set(focus !== null ? (incident.get(focus) ?? []) : []);
    for (const l of visibleLinks) setLinkHi(l.edge, hiEdges.has(l.edge));
    svg.classed(styles.focusing, focus !== null);
    paintedSel = sel;
    paintedFocus = focus;
    placePill(focus, true);
  }

  // One pill element, moved to the focused node and measured only when the
  // focus or the label geometry changed.
  let pill: SVGRectElement | null = null;
  function placePill(focus: string | null, remeasure: boolean) {
    const e = focus !== null ? nodeEls.get(focus) : undefined;
    if (!e || !e.label) {
      pill?.remove();
      return;
    }
    // Moving a focused element in the DOM drops keyboard focus.
    if (e.g !== document.activeElement) select(e.g).raise();
    if (!remeasure && pill?.parentNode === e.g) return;
    if (!pill) {
      pill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      pill.setAttribute('class', styles.labelPill);
      pill.setAttribute('rx', String(PILL_RADIUS));
    }
    e.g.insertBefore(pill, e.label);
    const box = e.label.getBBox();
    pill.setAttribute('x', String(box.x - PILL_PAD_X));
    pill.setAttribute('y', String(box.y - PILL_PAD_Y));
    pill.setAttribute('width', String(box.width + 2 * PILL_PAD_X));
    pill.setAttribute('height', String(box.height + 2 * PILL_PAD_Y));
  }

  // Labels: focus + neighbours and matches always; "All" is a root class;
  // "Smart" adds hubs, or everything when zoomed in or the graph is small.
  function labelOn(n: SimNode): boolean {
    const isSmart = labelMode === 'smart';
    const isSmartAll = isSmart && (wasSmartScale || visibleNodes.length <= SMART_MAX_NODES);
    return (
      focusSet.has(n.id) ||
      matchIds.has(n.id) ||
      (isSmart && (isSmartAll || n.degree >= SMART_MIN_DEGREE))
    );
  }

  function paintLabel(id: string) {
    const n = nodeById.get(id);
    const el = nodeEls.get(id)?.g;
    if (!n || !el || !visibleIds.has(id)) return;
    const on = labelOn(n);
    el.classList.toggle(styles.show, on);
    if (on) shownIds.add(id);
    else shownIds.delete(id);
  }

  // Labels-only pass over every node. No link or pill work here.
  function paintLabels() {
    if (destroyed) return;
    wasSmartScale = scale >= SMART_MIN_SCALE;
    const shown = new Set<string>();
    for (const n of visibleNodes) {
      const el = nodeEls.get(n.id)?.g;
      if (!el) continue;
      const on = labelOn(n);
      el.classList.toggle(styles.show, on);
      if (on) shown.add(n.id);
    }
    shownIds = shown;
  }

  // "All" shows every label through a root class, regardless of `show`.
  function labelShown(id: string): boolean {
    return labelMode === 'all' || shownIds.has(id);
  }

  // Extents of a node including its label when `withLabel`: the label sits to the right.
  function nodeBox(n: SimNode, withLabel: boolean) {
    const x = n.x ?? 0;
    const y = n.y ?? 0;
    const half = withLabel ? Math.max(n.r, LABEL_HALF_H) : n.r;
    return {
      x0: x - n.r,
      x1: withLabel ? x + n.r + LABEL_GAP + (labelW.get(n.id) ?? 0) : x + n.r,
      y0: y - half,
      y1: y + half,
    };
  }

  interface Box {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  }

  // Grows `box` by a visible node's extents, its label included when shown.
  function extendBox(box: Box, n: SimNode) {
    const b = nodeBox(n, labelShown(n.id));
    box.x0 = Math.min(box.x0, b.x0);
    box.x1 = Math.max(box.x1, b.x1);
    box.y0 = Math.min(box.y0, b.y0);
    box.y1 = Math.max(box.y1, b.y1);
  }

  const emptyBox = (): Box => ({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });

  // Moves links and nodes; with `withBox`, also returns the fit box from the
  // same pass over the nodes (the camera follow reads it every tick).
  function draw(withBox = false): Box | null {
    linkSel.each(function (d) {
      const s = d.source;
      const t = d.target;
      if (typeof s !== 'object' || typeof t !== 'object') return;
      const sx = s.x ?? 0;
      const sy = s.y ?? 0;
      const tx = t.x ?? 0;
      const ty = t.y ?? 0;
      const dx = tx - sx;
      const dy = ty - sy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const startOff = s.r + 1;
      const endOff = t.r + (t.status === 'updated' ? 5 : 3) + ARROW_OVERSHOOT;
      this.setAttribute('x1', String(sx + (dx / len) * startOff));
      this.setAttribute('y1', String(sy + (dy / len) * startOff));
      this.setAttribute('x2', String(tx - (dx / len) * endOff));
      this.setAttribute('y2', String(ty - (dy / len) * endOff));
    });
    const box = withBox ? emptyBox() : null;
    for (const n of visibleNodes) {
      nodeEls.get(n.id)?.g.setAttribute('transform', `translate(${n.x ?? 0},${n.y ?? 0})`);
      if (box) extendBox(box, n);
    }
    return box;
  }

  const zoomBehavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 6])
    .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
      viewport.attr('transform', event.transform.toString());
      scale = event.transform.k;
      if (event.sourceEvent) {
        userMoved = true;
        clearFocusTarget();
      }
      if (labelMode === 'smart' && (scale >= SMART_MIN_SCALE) !== wasSmartScale) paintLabels();
    });
  svg.call(zoomBehavior).on('dblclick.zoom', null);
  // d3-zoom swallows the click that ends a pan, so this only fires on a plain
  // background click; node clicks stop propagation.
  svg.on('click', () => {
    if (!destroyed) onSelect(null);
  });
  // Reset any transform a previous mount left in the element's zoom state,
  // or restore the one a refresh carried over.
  svg.call(
    zoomBehavior.transform,
    initialTransform
      ? zoomIdentity.translate(initialTransform.x, initialTransform.y).scale(initialTransform.k)
      : zoomIdentity,
  );

  // Transform that fits the visible nodes in the viewport (or a box already
  // computed over them); null when there is nothing to fit.
  function fitTransform(fromBox?: Box | null): ZoomTransform | null {
    const w = svgEl.clientWidth;
    const h = svgEl.clientHeight;
    if (!w || !h || visibleNodes.length === 0) return null;
    let box = fromBox;
    if (!box) {
      box = emptyBox();
      for (const n of visibleNodes) extendBox(box, n);
    }
    const { x0, y0, x1, y1 } = box;
    const bw = Math.max(1, x1 - x0);
    const bh = Math.max(1, y1 - y0);
    const availW = Math.max(1, w - 2 * FIT_PADDING);
    const availH = Math.max(1, h - 2 * FIT_PADDING);
    const k = Math.max(0.1, Math.min(FIT_MAX_SCALE, availW / bw, availH / bh));
    const tx = w / 2 - (k * (x0 + x1)) / 2;
    const ty = h / 2 - (k * (y0 + y1)) / 2;
    return zoomIdentity.translate(tx, ty).scale(k);
  }

  // Programmatic (no sourceEvent), so userMoved stays as is. Animated unless
  // reduced motion; a user gesture, focusOn or destroy() interrupts it.
  function fit(animated = false) {
    const t = fitTransform();
    if (!t) return;
    svg.interrupt();
    if (animated && !reducedMotion()) {
      svg.transition().duration(FIT_DURATION).call(zoomBehavior.transform, t);
    } else {
      svg.call(zoomBehavior.transform, t);
    }
  }

  // Transform that centres a node at the scale fitting its visible neighbours
  // (labels included); null when the node is not visible or the SVG has no size.
  function focusTransform(id: string): ZoomTransform | null {
    if (!visibleIds.has(id)) return null;
    const n = nodeById.get(id);
    const w = svgEl.clientWidth;
    const h = svgEl.clientHeight;
    if (!n || !w || !h) return null;
    const nx = n.x ?? 0;
    const ny = n.y ?? 0;
    // Neighbours from the adjacency index (same rule as paint()).
    // Half-extents around the centred node, labels included: the focus and
    // its neighbours always get a label once selected (focusSet).
    const self = nodeBox(n, true);
    let halfW = Math.max(nx - self.x0, self.x1 - nx);
    let halfH = Math.max(ny - self.y0, self.y1 - ny);
    let hasNeighbour = false;
    for (const other of neighbours.get(id) ?? []) {
      const o = nodeById.get(other);
      if (!o) continue;
      hasNeighbour = true;
      const b = nodeBox(o, true);
      halfW = Math.max(halfW, nx - b.x0, b.x1 - nx);
      halfH = Math.max(halfH, ny - b.y0, b.y1 - ny);
    }
    let k: number;
    if (hasNeighbour) {
      const availW = Math.max(1, w - 2 * FOCUS_PADDING);
      const availH = Math.max(1, h - 2 * FOCUS_PADDING);
      const fitK = Math.min(availW / (2 * halfW), availH / (2 * halfH));
      k = Math.max(FOCUS_SCALE_MIN, Math.min(FOCUS_SCALE_MAX, fitK));
    } else {
      k = Math.max(zoomTransform(svgEl).k, FOCUS_MIN_SCALE);
    }
    return zoomIdentity.translate(w / 2 - k * nx, h / 2 - k * ny).scale(k);
  }

  // Programmatic, like fit(): userMoved stays as is.
  function animateTo(target: ZoomTransform, duration: number) {
    svg.interrupt();
    if (reducedMotion()) {
      svg.call(zoomBehavior.transform, target);
    } else {
      svg.transition().duration(duration).call(zoomBehavior.transform, target);
    }
  }

  // One step of the camera follow: ease the current transform toward the
  // focus box when there is a focus target, else toward the fit.
  function followStep(box: Box | null) {
    const target = focusTarget !== null ? focusTransform(focusTarget) : fitTransform(box);
    if (!target) return;
    const cur = zoomTransform(svgEl);
    const k = cur.k + (target.k - cur.k) * FOLLOW_EASE;
    const x = cur.x + (target.x - cur.x) * FOLLOW_EASE;
    const y = cur.y + (target.y - cur.y) * FOLLOW_EASE;
    svg.call(zoomBehavior.transform, zoomIdentity.translate(x, y).scale(k));
  }

  // Built on the initial visible subset; nodes outside it get their x/y
  // from d3 when an update first adds them.
  const linkForce = forceLink<SimNode, SimLink>(visibleLinks)
    .id((d) => d.id)
    .strength(0.55);
  const chargeForce = forceManyBody<SimNode>();
  const xForce = forceX<SimNode>(0);
  const yForce = forceY<SimNode>(0);
  const collideForce = forceCollide<SimNode>();
  const simulation = forceSimulation<SimNode, SimLink>(visibleNodes)
    .force('link', linkForce)
    .force('charge', chargeForce)
    .force('x', xForce)
    .force('y', yForce)
    .force('collide', collideForce)
    .stop();

  // Node distance D: link length and collision padding scale with D, charge
  // with D² against a constant centring pull, so spacing grows linearly and
  // the shape (core vs context links) stays the same.
  function applyForces() {
    const D = distance;
    linkForce.distance(40 * D);
    chargeForce.strength((d) => -(70 + d.r * 9) * D * D);
    xForce.strength(0.05);
    yForce.strength(0.05);
    collideForce.radius((d) => d.r + 2 + 2 * D);
  }
  applyForces();

  // 'unlessMoved': settles started by update/distance; 'always': animated relayout.
  // 'focus': a settle with a focus target, ends on the focus box.
  let fitOnEnd: 'none' | 'unlessMoved' | 'always' | 'focus' = 'none';
  // Camera follow for the current settle: set by update/setDistance/relayout
  // when not userMoved and not reduced motion; cleared by a user gesture
  // (userMoved), focusOn, fit and at `end`.
  let follow = false;
  // reframe() waiting for an update(); checked one frame later.
  let reframePending = false;
  let reframeFrame: number | null = null;

  function cancelFocusFrame() {
    if (focusFrame !== null) cancelAnimationFrame(focusFrame);
    focusFrame = null;
  }

  // A focus-driven settle ends on the focus box; once cleared it ends nowhere.
  function clearFocusTarget() {
    if (focusTarget === null) return;
    focusTarget = null;
    cancelFocusFrame();
    if (fitOnEnd === 'focus') {
      fitOnEnd = 'none';
      follow = false;
    }
  }

  simulation
    .on('tick', () => {
      const box = draw(follow && focusTarget === null && !userMoved);
      if (!follow) return;
      if (focusTarget === null && userMoved) {
        follow = false;
        return;
      }
      // Until `end`, so the final glide only corrects a small residue.
      followStep(box);
    })
    .on('end', () => {
      const mode = fitOnEnd;
      fitOnEnd = 'none';
      follow = false;
      if (mode === 'focus') {
        const target = focusTarget !== null ? focusTransform(focusTarget) : null;
        focusTarget = null;
        if (target) animateTo(target, FOCUS_DURATION);
      } else if (mode === 'always') {
        userMoved = false;
        fit(true);
      } else if (mode === 'unlessMoved' && !userMoved) {
        fit(true);
      }
    });

  // Settle started by update/setDistance: fit at end unless moved, follow meanwhile.
  function settle(alpha: number) {
    fitOnEnd = 'unlessMoved';
    follow = !userMoved && !reducedMotion();
    simulation.alpha(alpha).restart();
  }

  // Drag (POC pattern on `event.active`): pin on `start`, reheat on the first
  // `drag` event of a gesture (not on `start`) so a plain click leaves the
  // layout alone, release on `end`. d3-drag counts the current gesture in
  // `active` during `drag` (but not during `start`/`end`), so "no other
  // gesture" is `active === 1` there. d3-drag suppresses the click after a
  // real drag.
  const pendingReheat = new Set<SimNode>();
  const dragBehavior = drag<SVGGElement, SimNode>()
    .on('start', (_event: D3DragEvent<SVGGElement, SimNode, SimNode>, d) => {
      if (destroyed) return;
      pendingReheat.add(d);
      // A node drag is a user action: the view must not move under the cursor
      // nor refit when the drag's settle ends.
      follow = false;
      fitOnEnd = 'none';
      clearFocusTarget();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on('drag', (event: D3DragEvent<SVGGElement, SimNode, SimNode>, d) => {
      if (destroyed) return;
      if (pendingReheat.delete(d) && event.active === 1) {
        simulation.alphaTarget(0.25).restart();
      }
      d.fx = event.x;
      d.fy = event.y;
    })
    .on('end', (event: D3DragEvent<SVGGElement, SimNode, SimNode>, d) => {
      if (destroyed) return;
      pendingReheat.delete(d);
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    });

  join(visibleNodes, visibleLinks, lastApplied.contextIds);
  paintAll();

  if (visibleNodes.length > 0) {
    if (initialPositions) {
      // Follows and fits at end unless the seed says the user moved the view.
      settle(UPDATE_ALPHA);
    } else if (visibleNodes.length <= PRETICK_MAX_NODES) {
      simulation.alpha(1);
      simulation.tick(PRETICKS);
      draw();
      fit();
    } else {
      fitOnEnd = 'unlessMoved';
      simulation.alpha(1).restart();
    }
  }

  return {
    update(visible: VisibleSet) {
      if (destroyed || sameVisibleSet(visible, lastApplied)) return;
      const hold = holdPending;
      holdPending = false;
      // The focus target (if any) is followed by this settle instead.
      cancelFocusFrame();
      lastApplied = visible;
      const wasVisible = visibleIds;
      setVisible(visible);
      selectedId = requestedId !== null && visibleIds.has(requestedId) ? requestedId : null;
      seedEntering(wasVisible);

      // Order matters: nodes first (re-indexes them, keeps x/y/vx/vy), then
      // links (forceLink resolves ends against the current nodes).
      applyRadii();
      simulation.nodes(visibleNodes);
      linkForce.links(visibleLinks);
      // Re-reads the new radii in the charge and collide accessors.
      applyForces();
      join(visibleNodes, visibleLinks, visible.contextIds);
      // A removed node never fires mouseleave.
      if (hoveredId !== null && !visibleIds.has(hoveredId)) hoveredId = null;
      if (focusTarget !== null && !visibleIds.has(focusTarget)) focusTarget = null;
      paintAll();

      const reframing = reframePending;
      reframePending = false;
      if (visibleNodes.length === 0) {
        fitOnEnd = 'none';
        follow = false;
        focusTarget = null;
        simulation.stop();
        return;
      }
      draw();
      if (hold && !reframing) {
        fitOnEnd = 'none';
        follow = false;
        simulation.alpha(UPDATE_ALPHA).restart();
      } else if (focusTarget !== null) {
        // No initial transition: the follow eases toward the focus box.
        svg.interrupt();
        fitOnEnd = 'focus';
        follow = !reducedMotion();
        simulation.alpha(UPDATE_ALPHA).restart();
      } else {
        settle(UPDATE_ALPHA);
      }
    },
    setSelection(id: string | null) {
      if (destroyed) return;
      requestedId = id;
      if (id === null) clearFocusTarget();
      const next = id !== null && visibleIds.has(id) ? id : null;
      if (next === selectedId) return;
      selectedId = next;
      paint();
    },
    focusOn(id: string) {
      if (destroyed || !visibleIds.has(id) || !nodeById.has(id)) return;
      // A settling fit or follow would overwrite the focus.
      fitOnEnd = 'none';
      follow = false;
      reframePending = false;
      focusTarget = id;
      cancelFocusFrame();
      // The selection reaches update() through a React effect; if none
      // arrives by the next frame the visible set did not change.
      focusFrame = requestAnimationFrame(() => {
        focusFrame = null;
        if (destroyed || focusTarget !== id) return;
        focusTarget = null;
        const target = focusTransform(id);
        if (target) animateTo(target, FOCUS_DURATION);
      });
    },
    holdView() {
      if (destroyed) return;
      holdPending = true;
      if (holdFrame !== null) cancelAnimationFrame(holdFrame);
      holdFrame = requestAnimationFrame(() => {
        holdFrame = null;
        holdPending = false;
      });
    },
    setLabelMode(mode: LabelMode) {
      if (destroyed || mode === labelMode) return;
      labelMode = mode;
      applyLabelModeClass();
      paintLabels();
    },
    setQuery(next: ReadonlySet<string>) {
      if (destroyed || sameSet(next, matchIds)) return;
      matchIds = new Set(next);
      paintAll();
    },
    zoomBy(factor: number) {
      if (destroyed) return;
      userMoved = true;
      follow = false;
      clearFocusTarget();
      svg.interrupt();
      svg
        .transition()
        .duration(reducedMotion() ? 0 : ZOOM_DURATION)
        .call(zoomBehavior.scaleBy, factor);
    },
    fit() {
      if (destroyed) return;
      userMoved = false;
      clearFocusTarget();
      // The explicit fit wins over the follow; a running settle still fits at end.
      follow = false;
      fit(true);
    },
    reframe() {
      if (destroyed) return;
      userMoved = false;
      clearFocusTarget();
      reframePending = true;
      if (reframeFrame !== null) cancelAnimationFrame(reframeFrame);
      // The filter change reaches update() through a React effect; if none
      // arrives by the next frame the visible set did not change.
      reframeFrame = requestAnimationFrame(() => {
        reframeFrame = null;
        if (destroyed || !reframePending) return;
        reframePending = false;
        if (!userMoved) fit(true);
      });
    },
    relayout() {
      if (destroyed) return;
      simulation.stop();
      fitOnEnd = 'none';
      follow = false;
      userMoved = false;
      clearFocusTarget();
      if (visibleNodes.length === 0) return;
      for (const n of allNodes) {
        n.fx = null;
        n.fy = null;
      }
      for (const n of visibleNodes) {
        n.x = (Math.random() - 0.5) * 2 * RELAYOUT_SPREAD;
        n.y = (Math.random() - 0.5) * 2 * RELAYOUT_SPREAD;
        n.vx = 0;
        n.vy = 0;
      }
      simulation.alpha(1);
      if (visibleNodes.length <= PRETICK_MAX_NODES) {
        simulation.tick(PRETICKS);
        draw();
        fit(true);
      } else {
        draw();
        fitOnEnd = 'always';
        follow = !reducedMotion();
        simulation.restart();
      }
    },
    setDistance(d: number) {
      if (destroyed || d === distance) return;
      distance = d;
      applyForces();
      if (visibleNodes.length === 0) return;
      // A pending reframe is served by this settle (follow, fit at end), not by
      // a separate animated fit fighting the follow.
      reframePending = false;
      settle(DISTANCE_ALPHA);
    },
    positions() {
      const out = new Map<string, Point>();
      for (const n of allNodes) {
        if (n.x !== undefined && n.y !== undefined) out.set(n.id, { x: n.x, y: n.y });
      }
      return out;
    },
    viewState() {
      const t = zoomTransform(svgEl);
      return { transform: { x: t.x, y: t.y, k: t.k }, userMoved };
    },
    destroy() {
      destroyed = true;
      follow = false;
      reframePending = false;
      if (reframeFrame !== null) cancelAnimationFrame(reframeFrame);
      reframeFrame = null;
      focusTarget = null;
      cancelFocusFrame();
      holdPending = false;
      if (holdFrame !== null) cancelAnimationFrame(holdFrame);
      holdFrame = null;
      cancelPaintFrame();
      hoveredId = null;
      selectedId = null;
      pendingReheat.clear();
      simulation.stop();
      simulation.on('tick', null).on('end', null);
      nodeSel
        .on('.drag', null)
        .on('click', null)
        .on('keydown', null)
        .on('mouseenter', null)
        .on('mouseleave', null)
        .on('focus', null)
        .on('blur', null);
      svg.on('.zoom', null).on('click', null);
      // Stops a running focusOn transition before the SVG is cleared.
      svg.interrupt();
      svg.selectAll('*').remove();
      nodeEls.clear();
      linkEls.clear();
      pill = null;
      svg
        .classed(styles.root, false)
        .classed(styles.labelsAll, false)
        .classed(styles.labelsFocus, false)
        .classed(styles.focusing, false);
    },
  };
}
